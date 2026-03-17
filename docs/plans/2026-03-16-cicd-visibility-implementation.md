# CI/CD Visibility Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give Control Panel real-time visibility into CI/CD status for 3 pilot apps (control-panel, playpath, habit) by pulling from Gitea and ArgoCD APIs, and expose Prometheus-scrapable metrics.

**Architecture:** New tRPC routers in `packages/api/` query Gitea CI runs and ArgoCD app state. A merged `appOverview` router joins them with Prometheus health data. The existing `/deployments` page gets an Overview tab showing real data. ForgeGraph endpoints move from web-v2 to web/. A `/api/metrics` endpoint exposes request + webhook counters.

**Tech Stack:** tRPC 11 RC, Zod, Next.js 15 App Router, React 19, Tailwind, existing Gitea client, new ArgoCD client

**Design doc:** `docs/plans/2026-03-16-cicd-visibility-design.md`

---

## Task 1: ArgoCD API Client

**Files:**
- Create: `packages/api/src/lib/argocd-client.ts`
- Test: `packages/api/src/__tests__/argocd-client.test.ts`

**Step 1: Write the test**

```typescript
// packages/api/src/__tests__/argocd-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArgoCDClient, getArgoCDClient } from "../lib/argocd-client";

describe("ArgoCDClient", () => {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...savedEnv };
  });

  afterEach(() => {
    process.env = savedEnv;
    globalThis.fetch = originalFetch;
  });

  it("getArgoCDClient returns null when ARGOCD_SERVER not set", () => {
    delete process.env.ARGOCD_SERVER;
    delete process.env.ARGOCD_TOKEN;
    expect(getArgoCDClient()).toBeNull();
  });

  it("getArgoCDClient returns client when configured", () => {
    process.env.ARGOCD_SERVER = "https://cd.gmac.io";
    process.env.ARGOCD_TOKEN = "test-token";
    const client = getArgoCDClient();
    expect(client).toBeInstanceOf(ArgoCDClient);
  });

  it("listApplications calls correct endpoint", async () => {
    process.env.ARGOCD_SERVER = "https://cd.gmac.io";
    process.env.ARGOCD_TOKEN = "test-token";

    const mockApps = {
      items: [
        {
          metadata: { name: "control-panel", namespace: "argocd" },
          spec: { source: { repoURL: "https://git.gmac.io/gmackie/control-panel" } },
          status: {
            sync: { status: "Synced", revision: "abc123" },
            health: { status: "Healthy" },
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApps,
    });

    const client = new ArgoCDClient("https://cd.gmac.io", "test-token");
    const apps = await client.listApplications();
    expect(apps).toHaveLength(1);
    expect(apps[0]!.metadata.name).toBe("control-panel");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://cd.gmac.io/api/v1/applications",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("getApplication calls correct endpoint with name", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: { name: "playpath" },
        status: { sync: { status: "OutOfSync" }, health: { status: "Progressing" } },
      }),
    });

    const client = new ArgoCDClient("https://cd.gmac.io", "test-token");
    const app = await client.getApplication("playpath");
    expect(app.metadata.name).toBe("playpath");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @repo/api test -- src/__tests__/argocd-client.test.ts
```
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// packages/api/src/lib/argocd-client.ts

export interface ArgoCDApplication {
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp?: string;
  };
  spec: {
    source: {
      repoURL: string;
      path?: string;
      targetRevision?: string;
    };
    destination: {
      server?: string;
      namespace?: string;
    };
    project?: string;
  };
  status: {
    sync: {
      status: "Synced" | "OutOfSync" | "Unknown";
      revision?: string;
      comparedTo?: {
        source: { repoURL: string; path?: string; targetRevision?: string };
        destination: { server?: string; namespace?: string };
      };
    };
    health: {
      status: "Healthy" | "Progressing" | "Degraded" | "Suspended" | "Missing" | "Unknown";
      message?: string;
    };
    operationState?: {
      phase: "Running" | "Succeeded" | "Failed" | "Error" | "Terminating";
      message?: string;
      startedAt?: string;
      finishedAt?: string;
    };
    summary?: {
      images?: string[];
    };
    resources?: Array<{
      group?: string;
      version: string;
      kind: string;
      namespace?: string;
      name: string;
      status?: string;
      health?: { status: string; message?: string };
    }>;
  };
}

export class ArgoCDClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`ArgoCD API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async listApplications(): Promise<ArgoCDApplication[]> {
    const result = await this.request<{ items: ArgoCDApplication[] }>(
      "/api/v1/applications",
    );
    return result.items || [];
  }

  async getApplication(name: string): Promise<ArgoCDApplication> {
    return this.request<ArgoCDApplication>(
      `/api/v1/applications/${encodeURIComponent(name)}`,
    );
  }

  async getApplicationSyncHistory(
    name: string,
  ): Promise<Array<{ revision: string; deployedAt: string; id: number }>> {
    const app = await this.getApplication(name);
    // ArgoCD doesn't have a direct sync history endpoint in v1 API
    // Return current state as single entry
    return app.status.operationState
      ? [
          {
            revision: app.status.sync.revision || "unknown",
            deployedAt: app.status.operationState.finishedAt || app.status.operationState.startedAt || new Date().toISOString(),
            id: 0,
          },
        ]
      : [];
  }
}

export function getArgoCDClient(): ArgoCDClient | null {
  const server = (process.env.ARGOCD_SERVER || "").trim();
  const token = (process.env.ARGOCD_TOKEN || "").trim();

  if (!server || !token) {
    return null;
  }

  return new ArgoCDClient(server, token);
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @repo/api test -- src/__tests__/argocd-client.test.ts
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add packages/api/src/lib/argocd-client.ts packages/api/src/__tests__/argocd-client.test.ts
git commit -m "feat(api): add ArgoCD API client"
```

---

## Task 2: tRPC Router — ciPipelines (Gitea CI)

**Files:**
- Create: `packages/api/src/routers/ci-pipelines.ts`
- Modify: `packages/api/src/routers/index.ts` (add to appRouter)

The existing Gitea client at `apps/web/src/lib/gitea/client.ts` has `listWorkflowRuns()` already. But it lives in `apps/web/`, not `packages/api/`. Rather than moving it, we'll make a thin Gitea API caller directly in the router (same pattern — just fetch with token).

**Step 1: Write the router**

```typescript
// packages/api/src/routers/ci-pipelines.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

interface GiteaWorkflowRun {
  id: number;
  display_title: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string;
  head_sha: string;
  html_url: string;
  run_number: number;
  started_at: string;
  completed_at: string | null;
  path: string;
}

async function fetchGiteaAPI<T>(path: string): Promise<T> {
  const baseUrl = (process.env.GITEA_URL || "https://git.gmac.io").replace(/\/$/, "");
  const token = process.env.GITEA_TOKEN || "";

  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Gitea API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const ciPipelinesRouter = router({
  byRepo: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
        limit: z.number().min(1).max(20).default(5),
      }),
    )
    .query(async ({ input }) => {
      const runs = await fetchGiteaAPI<{ workflow_runs: GiteaWorkflowRun[] }>(
        `/repos/${input.owner}/${input.repo}/actions/runs?limit=${input.limit}`,
      );
      return (runs.workflow_runs || []).map((run) => ({
        id: run.id,
        title: run.display_title,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        branch: run.head_branch,
        commitSha: run.head_sha,
        url: run.html_url,
        runNumber: run.run_number,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        workflow: run.path,
      }));
    }),

  latestRun: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const runs = await fetchGiteaAPI<{ workflow_runs: GiteaWorkflowRun[] }>(
        `/repos/${input.owner}/${input.repo}/actions/runs?limit=1`,
      );
      const run = runs.workflow_runs?.[0];
      if (!run) return null;
      return {
        id: run.id,
        title: run.display_title,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        branch: run.head_branch,
        commitSha: run.head_sha,
        url: run.html_url,
        runNumber: run.run_number,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        workflow: run.path,
      };
    }),
});
```

**Step 2: Register the router**

Add to `packages/api/src/routers/index.ts`:
```typescript
import { ciPipelinesRouter } from "./ci-pipelines";
// ... in appRouter:
ciPipelines: ciPipelinesRouter,
```

**Step 3: Typecheck**

```bash
pnpm --filter @repo/api typecheck
```
Expected: PASS

**Step 4: Commit**

```bash
git add packages/api/src/routers/ci-pipelines.ts packages/api/src/routers/index.ts
git commit -m "feat(api): add ciPipelines tRPC router for Gitea CI runs"
```

---

## Task 3: tRPC Router — argoApps

**Files:**
- Create: `packages/api/src/routers/argo-apps.ts`
- Modify: `packages/api/src/routers/index.ts`

**Step 1: Write the router**

```typescript
// packages/api/src/routers/argo-apps.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getArgoCDClient } from "../lib/argocd-client";
import { TRPCError } from "@trpc/server";

export const argoAppsRouter = router({
  list: publicProcedure.query(async () => {
    const client = getArgoCDClient();
    if (!client) {
      return { configured: false, apps: [] };
    }

    try {
      const apps = await client.listApplications();
      return {
        configured: true,
        apps: apps.map((app) => ({
          name: app.metadata.name,
          namespace: app.spec.destination?.namespace || "default",
          project: app.spec.project || "default",
          repoURL: app.spec.source.repoURL,
          path: app.spec.source.path,
          targetRevision: app.spec.source.targetRevision,
          syncStatus: app.status.sync.status,
          healthStatus: app.status.health.status,
          healthMessage: app.status.health.message,
          revision: app.status.sync.revision,
          operationPhase: app.status.operationState?.phase,
          images: app.status.summary?.images || [],
        })),
      };
    } catch (error) {
      console.error("Failed to fetch ArgoCD apps:", error);
      return { configured: true, apps: [], error: "Failed to connect to ArgoCD" };
    }
  }),

  byName: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const client = getArgoCDClient();
      if (!client) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ArgoCD not configured" });
      }

      const app = await client.getApplication(input.name);
      return {
        name: app.metadata.name,
        namespace: app.spec.destination?.namespace || "default",
        project: app.spec.project || "default",
        repoURL: app.spec.source.repoURL,
        path: app.spec.source.path,
        targetRevision: app.spec.source.targetRevision,
        syncStatus: app.status.sync.status,
        healthStatus: app.status.health.status,
        healthMessage: app.status.health.message,
        revision: app.status.sync.revision,
        operationPhase: app.status.operationState?.phase,
        operationMessage: app.status.operationState?.message,
        operationStarted: app.status.operationState?.startedAt,
        operationFinished: app.status.operationState?.finishedAt,
        images: app.status.summary?.images || [],
        resources: (app.status.resources || []).map((r) => ({
          kind: r.kind,
          name: r.name,
          namespace: r.namespace,
          status: r.status,
          health: r.health?.status,
        })),
      };
    }),
});
```

**Step 2: Register in index.ts**

```typescript
import { argoAppsRouter } from "./argo-apps";
// in appRouter:
argoApps: argoAppsRouter,
```

**Step 3: Typecheck**

```bash
pnpm --filter @repo/api typecheck
```

**Step 4: Commit**

```bash
git add packages/api/src/routers/argo-apps.ts packages/api/src/routers/index.ts
git commit -m "feat(api): add argoApps tRPC router for ArgoCD application state"
```

---

## Task 4: tRPC Router — appOverview (merged view)

**Files:**
- Create: `packages/api/src/routers/app-overview.ts`
- Modify: `packages/api/src/routers/index.ts`

This router reads from the `applications` DB table to know which apps to show, then fans out to ciPipelines and argoApps data.

**Step 1: Write the router**

```typescript
// packages/api/src/routers/app-overview.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { applications, eq } from "@repo/db";
import { getArgoCDClient } from "../lib/argocd-client";

// Pilot apps config — used as fallback when DB is empty
const PILOT_APPS = [
  { name: "Control Panel", slug: "control-panel", owner: "gmackie", repo: "control-panel", k8sNamespace: "control-panel", k8sDeploymentName: "control-panel", argoAppName: "control-panel" },
  { name: "Playpath", slug: "playpath", owner: "gmackie", repo: "playpath", k8sNamespace: "playpath", k8sDeploymentName: "playpath", argoAppName: "playpath" },
  { name: "Habit", slug: "habit", owner: "gmackie", repo: "habit", k8sNamespace: "habit", k8sDeploymentName: "habit", argoAppName: "habit" },
];

async function fetchLatestCIRun(owner: string, repo: string) {
  const baseUrl = (process.env.GITEA_URL || "https://git.gmac.io").replace(/\/$/, "");
  const token = process.env.GITEA_TOKEN || "";

  try {
    const response = await fetch(`${baseUrl}/api/v1/repos/${owner}/${repo}/actions/runs?limit=1`, {
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json() as { workflow_runs?: Array<{ id: number; display_title: string; status: string; conclusion: string | null; head_sha: string; html_url: string; started_at: string; completed_at: string | null }> };
    return data.workflow_runs?.[0] || null;
  } catch {
    return null;
  }
}

async function fetchArgoAppStatus(appName: string) {
  const client = getArgoCDClient();
  if (!client) return null;

  try {
    const app = await client.getApplication(appName);
    return {
      syncStatus: app.status.sync.status,
      healthStatus: app.status.health.status,
      healthMessage: app.status.health.message,
      revision: app.status.sync.revision,
      operationPhase: app.status.operationState?.phase,
      images: app.status.summary?.images || [],
    };
  } catch {
    return null;
  }
}

export const appOverviewRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    // Try DB first, fall back to pilot config
    let appConfigs = PILOT_APPS;

    if (ctx.db) {
      try {
        const dbApps = await ctx.db
          .select()
          .from(applications)
          .where(eq(applications.status, "active"));

        if (dbApps.length > 0) {
          appConfigs = dbApps
            .filter((a) => PILOT_APPS.some((p) => p.slug === a.slug))
            .map((a) => {
              const pilot = PILOT_APPS.find((p) => p.slug === a.slug)!;
              return {
                name: a.name,
                slug: a.slug,
                owner: pilot.owner,
                repo: pilot.repo,
                k8sNamespace: a.k8sNamespace || pilot.k8sNamespace,
                k8sDeploymentName: a.k8sDeploymentName || pilot.k8sDeploymentName,
                argoAppName: pilot.argoAppName,
              };
            });

          // If no pilot apps in DB yet, use defaults
          if (appConfigs.length === 0) appConfigs = PILOT_APPS;
        }
      } catch {
        // DB unavailable, use defaults
      }
    }

    const results = await Promise.allSettled(
      appConfigs.map(async (app) => {
        const [ci, argo] = await Promise.all([
          fetchLatestCIRun(app.owner, app.repo),
          fetchArgoAppStatus(app.argoAppName),
        ]);

        return {
          name: app.name,
          slug: app.slug,
          repo: `${app.owner}/${app.repo}`,
          repoUrl: `https://git.gmac.io/${app.owner}/${app.repo}`,
          ci: ci
            ? {
                id: ci.id,
                title: ci.display_title,
                status: ci.conclusion || ci.status,
                commitSha: ci.head_sha?.slice(0, 7),
                url: ci.html_url,
                startedAt: ci.started_at,
                completedAt: ci.completed_at,
              }
            : null,
          deploy: argo
            ? {
                syncStatus: argo.syncStatus,
                healthStatus: argo.healthStatus,
                healthMessage: argo.healthMessage,
                revision: argo.revision?.slice(0, 7),
                images: argo.images,
              }
            : null,
        };
      }),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value);
  }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const app = PILOT_APPS.find((a) => a.slug === input.slug);
      if (!app) return null;

      const [ci, argo] = await Promise.all([
        fetchLatestCIRun(app.owner, app.repo),
        fetchArgoAppStatus(app.argoAppName),
      ]);

      return {
        name: app.name,
        slug: app.slug,
        repo: `${app.owner}/${app.repo}`,
        repoUrl: `https://git.gmac.io/${app.owner}/${app.repo}`,
        ci,
        deploy: argo,
      };
    }),
});
```

**Step 2: Register in index.ts**

```typescript
import { appOverviewRouter } from "./app-overview";
// in appRouter:
appOverview: appOverviewRouter,
```

**Step 3: Typecheck**

```bash
pnpm --filter @repo/api typecheck
```

**Step 4: Commit**

```bash
git add packages/api/src/routers/app-overview.ts packages/api/src/routers/index.ts
git commit -m "feat(api): add appOverview tRPC router merging CI + ArgoCD state"
```

---

## Task 5: Move ForgeGraph Endpoints from web-v2 to web/

**Files:**
- Copy: `apps/web-v2/src/app/api/forge/` → `apps/web/src/app/api/forge/`
- Adapt imports for web/ conventions

**Step 1: Copy the 3 route files**

```bash
mkdir -p apps/web/src/app/api/forge/health
mkdir -p apps/web/src/app/api/forge/build-status
mkdir -p apps/web/src/app/api/forge/deployment-status
```

Copy each file, changing only the db import:
- `import { getDb } from "@/lib/db"` → `import { getDb } from "@repo/db"` (web/ uses @repo/db directly)

**Step 2: Verify build**

```bash
pnpm --filter @repo/web typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/forge/
git commit -m "feat: move ForgeGraph endpoints from web-v2 to web/"
```

---

## Task 6: `/api/metrics` Endpoint

**Files:**
- Create: `apps/web/src/lib/metrics/collector.ts`
- Create: `apps/web/src/app/api/metrics/route.ts`
- Test: manual curl verification

**Step 1: Write the metrics collector**

```typescript
// apps/web/src/lib/metrics/collector.ts

interface CounterEntry {
  labels: Record<string, string>;
  value: number;
}

interface HistogramEntry {
  labels: Record<string, string>;
  sum: number;
  count: number;
  buckets: Map<number, number>;
}

const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

class MetricsCollector {
  private counters = new Map<string, CounterEntry[]>();
  private histograms = new Map<string, HistogramEntry[]>();
  private startTime = Date.now();

  incrementCounter(name: string, labels: Record<string, string> = {}, amount = 1): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, []);
    }
    const entries = this.counters.get(name)!;
    const key = JSON.stringify(labels);
    const existing = entries.find((e) => JSON.stringify(e.labels) === key);
    if (existing) {
      existing.value += amount;
    } else {
      entries.push({ labels, value: amount });
    }
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    const entries = this.histograms.get(name)!;
    const key = JSON.stringify(labels);
    let existing = entries.find((e) => JSON.stringify(e.labels) === key);
    if (!existing) {
      existing = { labels, sum: 0, count: 0, buckets: new Map(HISTOGRAM_BUCKETS.map((b) => [b, 0])) };
      entries.push(existing);
    }
    existing.sum += value;
    existing.count += 1;
    for (const bucket of HISTOGRAM_BUCKETS) {
      if (value <= bucket) {
        existing.buckets.set(bucket, (existing.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  format(): string {
    const lines: string[] = [];

    // Uptime
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    lines.push("# HELP control_panel_uptime_seconds Time since process start");
    lines.push("# TYPE control_panel_uptime_seconds gauge");
    lines.push(`control_panel_uptime_seconds ${uptimeSeconds.toFixed(1)}`);
    lines.push("");

    // Counters
    for (const [name, entries] of this.counters) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      for (const entry of entries) {
        const labelStr = this.formatLabels(entry.labels);
        lines.push(`${name}${labelStr} ${entry.value}`);
      }
      lines.push("");
    }

    // Histograms
    for (const [name, entries] of this.histograms) {
      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);
      for (const entry of entries) {
        const labelStr = this.formatLabels(entry.labels);
        for (const [bucket, count] of entry.buckets) {
          lines.push(`${name}_bucket${this.formatLabels({ ...entry.labels, le: String(bucket) })} ${count}`);
        }
        lines.push(`${name}_bucket${this.formatLabels({ ...entry.labels, le: "+Inf" })} ${entry.count}`);
        lines.push(`${name}_sum${labelStr} ${entry.sum}`);
        lines.push(`${name}_count${labelStr} ${entry.count}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return "";
    return `{${entries.map(([k, v]) => `${k}="${v}"`).join(",")}}`;
  }
}

// Global singleton
export const metrics = new MetricsCollector();
```

**Step 2: Write the route handler**

```typescript
// apps/web/src/app/api/metrics/route.ts
import { metrics } from "@/lib/metrics/collector";

export async function GET() {
  return new Response(metrics.format(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
```

**Step 3: Instrument webhook handlers**

Add to each webhook route's POST handler (argocd, harbor, prometheus, forge/*):
```typescript
import { metrics } from "@/lib/metrics/collector";
// At start of POST:
metrics.incrementCounter("webhook_received_total", { source: "argocd" });
// At end of POST (before return):
metrics.observeHistogram("webhook_processing_duration_seconds", (Date.now() - startMs) / 1000, { source: "argocd" });
// On error:
metrics.incrementCounter("webhook_errors_total", { source: "argocd" });
```

**Step 4: Typecheck and verify**

```bash
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web build
```

**Step 5: Commit**

```bash
git add apps/web/src/lib/metrics/collector.ts apps/web/src/app/api/metrics/route.ts
git commit -m "feat: add /api/metrics endpoint with Prometheus exposition format"
```

---

## Task 7: Instrument Webhook Routes with Metrics

**Files:**
- Modify: `apps/web/src/app/api/webhooks/argocd/route.ts`
- Modify: `apps/web/src/app/api/webhooks/harbor/route.ts`
- Modify: `apps/web/src/app/api/webhooks/prometheus/alerts/route.ts`
- Modify: `apps/web/src/app/api/forge/build-status/route.ts`
- Modify: `apps/web/src/app/api/forge/deployment-status/route.ts`

For each file, add 3 lines:
1. `import { metrics } from "@/lib/metrics/collector";`
2. At start of POST: `metrics.incrementCounter("webhook_received_total", { source: "<name>" });`
3. Before return: `metrics.observeHistogram("webhook_processing_duration_seconds", (Date.now() - startMs) / 1000, { source: "<name>" });`
4. In catch block: `metrics.incrementCounter("webhook_errors_total", { source: "<name>" });`

Sources: `argocd`, `harbor`, `prometheus`, `forge-build`, `forge-deploy`

**Step 1: Add instrumentation to all 5 routes**

(Each route already has `startMs` or can add `const startMs = Date.now()` at top)

**Step 2: Typecheck**

```bash
pnpm --filter @repo/web typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/webhooks/ apps/web/src/app/api/forge/
git commit -m "feat: instrument webhook routes with Prometheus metrics counters"
```

---

## Task 8: Dashboard UI — App Overview Cards

**Files:**
- Create: `apps/web/src/components/dashboard/app-overview-cards.tsx`
- Modify: `apps/web/src/app/deployments/page.tsx` (add Overview tab)

**Step 1: Write the overview cards component**

This component uses the `trpc.appOverview.list` query to render a card per pilot app showing CI status, deploy state, and health.

Key UI elements per card:
- App name + repo link
- CI badge: green check / red X / yellow spinner based on conclusion
- Deploy badge: "Synced" green / "OutOfSync" yellow / "Unknown" gray
- Health badge: "Healthy" green / "Degraded" red / "Progressing" yellow
- Last commit SHA + message
- Timestamp of last CI run

Use existing Tailwind classes and Lucide icons (already in the project).

**Step 2: Add "Overview" tab to deployments page**

Add a new tab at the beginning of the existing tabs in `/deployments/page.tsx` that renders the `AppOverviewCards` component.

**Step 3: Typecheck and build**

```bash
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web build
```

**Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/app-overview-cards.tsx apps/web/src/app/deployments/page.tsx
git commit -m "feat: add app overview cards to deployments dashboard"
```

---

## Task 9: Run All Tests + Build

**Step 1: Run all package tests**

```bash
pnpm --filter @repo/webhooks test
pnpm --filter @repo/forgegraph test
pnpm --filter @repo/api test
pnpm --filter @repo/web test
```

**Step 2: Typecheck everything**

```bash
pnpm --filter @repo/api typecheck
pnpm --filter @repo/web typecheck
```

**Step 3: Build**

```bash
pnpm --filter @repo/web build
```

**Step 4: Commit any fixes needed, then final commit**

```bash
git add -A
git commit -m "chore: verification pass — all tests and builds clean"
```

---

## Verification Checklist

After all tasks complete:

1. `pnpm --filter @repo/api test` — all tests pass including ArgoCD client tests
2. `pnpm --filter @repo/web test` — all 41+ tests pass
3. `pnpm --filter @repo/web build` — builds clean
4. Local dev: `pnpm --filter @repo/web dev` then visit `http://localhost:3000/deployments` — Overview tab shows real CI/ArgoCD data for 3 pilot apps
5. `curl http://localhost:3000/api/metrics` — returns Prometheus exposition format
6. `curl http://localhost:3000/api/forge/health` — returns ForgeGraph config
