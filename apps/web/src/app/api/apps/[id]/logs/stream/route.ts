import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { K3sService } from "@/lib/k3s/k3s-service";
import { LokiClient } from "@/lib/loki/client";
import { resolveAppK8sSelector } from "@/lib/applications/resolve-app-k8s-selector";

export const runtime = "nodejs";

const k3sService = new K3sService();
const loki = new LokiClient();

interface RouteParams {
  params: Promise<{ id: string }>;
}

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  pod?: string;
  container?: string;
  metadata?: Record<string, string>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const level = searchParams.get("level") || undefined;
  const podFilter = searchParams.get("pod") || undefined;

  const appId = decodeURIComponent(id);
  const selector = await resolveAppK8sSelector(appId);
  const appName = selector.appLabel;
  const namespaces = selector.namespaces ?? (await tryGetNamespacesForApp(appName));

  const query = buildLogQL({
    app: appName,
    namespaces,
    pod: podFilter,
    level,
  });

  const encoder = new TextEncoder();
  let lastSeenNs = String(BigInt(Date.now() - 5 * 60 * 1000) * 1_000_000n);

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      controller.enqueue(encoder.encode(`event: ready\ndata: {}\n\n`));

      while (!request.signal.aborted) {
        try {
          const endNs = String(BigInt(Date.now()) * 1_000_000n);
          const res = await loki.queryRange({
            query,
            startNs: bumpNs(lastSeenNs),
            endNs,
            limit: 200,
            direction: "forward",
          });

          const rows = flattenLokiStreams(res)
            .map(toLogEntry)
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

          for (const entry of rows) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
            lastSeenNs = isoToNs(entry.timestamp);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`));
        }

        await sleep(2000, request.signal);
      }

      controller.close();
    },
    cancel: () => {
      // request.signal should handle shutdown; this is just a safety net.
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function tryGetNamespacesForApp(appName: string): Promise<string[] | undefined> {
  try {
    const deployments = await k3sService.getDeployments({
      labels: { app: appName },
    });
    const namespaces = Array.from(new Set(deployments.map((d) => d.namespace).filter(Boolean)));
    return namespaces.length > 0 ? namespaces : undefined;
  } catch {
    return undefined;
  }
}

function buildLogQL(args: {
  app: string;
  namespaces?: string[];
  pod?: string;
  level?: string;
}): string {
  const matchers: string[] = [];
  matchers.push(`app=${quoteLabelValue(args.app)}`);
  if (args.namespaces && args.namespaces.length > 0) {
    matchers.push(`namespace=~${quoteLabelValue(args.namespaces.map(escapeRegex).join("|"))}`);
  }
  if (args.pod && args.pod !== "all") {
    matchers.push(`pod=${quoteLabelValue(args.pod)}`);
  }

  let query = `{${matchers.join(", ")}}`;
  if (args.level && args.level !== "all") {
    query += ` |~ ${quoteLabelValue(`(?i)\\b${escapeRegex(args.level)}\\b`)}`;
  }
  return query;
}

function quoteLabelValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/\"/g, '\\"')}"`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function flattenLokiStreams(res: { data?: { result?: Array<{ stream: Record<string, string>; values: [string, string][] }> } }) {
  const streams = res.data?.result ?? [];
  const rows: Array<{ labels: Record<string, string>; tsNs: string; line: string }> = [];

  for (const s of streams) {
    for (const [tsNs, line] of s.values) {
      rows.push({ labels: s.stream, tsNs, line });
    }
  }

  return rows;
}

function toLogEntry(row: { labels: Record<string, string>; tsNs: string; line: string }): LogEntry {
  const parsed = tryParseJson(row.line);
  const level = normalizeLevel(parsed?.level ?? parsed?.severity ?? inferLevel(row.line));
  const message =
    (typeof parsed?.message === "string" && parsed.message) ||
    (typeof parsed?.msg === "string" && parsed.msg) ||
    (typeof parsed?.log === "string" && parsed.log) ||
    row.line;

  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.labels)) {
    if (k === "pod" || k === "container") continue;
    metadata[k] = v;
  }

  return {
    timestamp: nsToISOString(row.tsNs),
    level,
    message,
    pod: row.labels.pod,
    container: row.labels.container,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

function tryParseJson(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function normalizeLevel(value: unknown): LogLevel {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  if (v === "debug") return "debug";
  if (v === "info") return "info";
  if (v === "warn" || v === "warning") return "warn";
  if (v === "error" || v === "err") return "error";
  if (v === "fatal" || v === "crit" || v === "critical") return "fatal";
  return "info";
}

function inferLevel(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes("fatal")) return "fatal";
  if (lower.includes("error")) return "error";
  if (lower.includes("warn")) return "warn";
  if (lower.includes("debug")) return "debug";
  return "info";
}

function nsToISOString(tsNs: string): string {
  const ms = BigInt(tsNs) / 1_000_000n;
  return new Date(Number(ms)).toISOString();
}

function isoToNs(iso: string): string {
  return String(BigInt(new Date(iso).getTime()) * 1_000_000n);
}

function bumpNs(ns: string): string {
  try {
    return String(BigInt(ns) + 1n);
  } catch {
    return ns;
  }
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}
