import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { K3sService } from "@/lib/k3s/k3s-service";
import { PrometheusClient } from "@/lib/prometheus/client";
import { resolveAppK8sSelector } from "@/lib/applications/resolve-app-k8s-selector";

const k3sService = new K3sService();
const prometheus = new PrometheusClient();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("range") || "1h";

    const appId = decodeURIComponent(id);
    const selector = await resolveAppK8sSelector(appId);

    const time = parseTimeRange(timeRange);
    const deployments = await tryGetDeployments(selector);

    if (deployments.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    const namespaceMatcher = selector.namespaces && selector.namespaces.length > 0
      ? selector.namespaces
      : Array.from(new Set(deployments.map((d) => d.namespace).filter(Boolean)));

    const nsRegex = namespaceMatcher.length > 0 ? namespaceMatcher.map(escapeRegex).join("|") : undefined;
    const podRegex = `${escapeRegex(selector.podPrefix)}.*`;

    const labels = nsRegex
      ? `{namespace=~"${nsRegex}",pod=~"${podRegex}"}`
      : `{pod=~"${podRegex}"}`;

    const range = time.range;

    const [
      cpuUsedCores,
      cpuLimitCores,
      cpuRequestCores,
      memUsedBytes,
      memLimitBytes,
      rxBytes,
      txBytes,
      rxRate,
      txRate,
      reqTotal,
      reqRate,
      errPct,
      latAvgMs,
      latP95Ms,
      latP99Ms,
      restarts,
    ] = await Promise.all([
      qNumber(`sum(rate(container_cpu_usage_seconds_total${labels}{container!="POD"}[5m]))`),
      qNumber(`sum(kube_pod_container_resource_limits${labels}{resource="cpu",unit="core"})`),
      qNumber(`sum(kube_pod_container_resource_requests${labels}{resource="cpu",unit="core"})`),
      qNumber(`sum(container_memory_working_set_bytes${labels}{container!="POD"})`),
      qNumber(`sum(kube_pod_container_resource_limits${labels}{resource="memory",unit="byte"})`),
      qNumber(`sum(increase(container_network_receive_bytes_total${labels}[${range}]))`),
      qNumber(`sum(increase(container_network_transmit_bytes_total${labels}[${range}]))`),
      qNumber(`sum(rate(container_network_receive_bytes_total${labels}[5m]))`),
      qNumber(`sum(rate(container_network_transmit_bytes_total${labels}[5m]))`),
      qNumber(`sum(increase(http_requests_total${labels}[${range}])) or vector(0)`),
      qNumber(`sum(rate(http_requests_total${labels}[5m])) or vector(0)`),
      qNumber(
        `(
          sum(rate(http_requests_total${labels}{status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total${labels}[5m]))
        ) * 100 or vector(0)`
      ),
      qNumber(
        `(sum(rate(http_request_duration_seconds_sum${labels}[5m])) / sum(rate(http_request_duration_seconds_count${labels}[5m]))) * 1000 or vector(0)`
      ),
      qNumber(
        `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket${labels}[5m])) by (le)) * 1000 or vector(0)`
      ),
      qNumber(
        `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket${labels}[5m])) by (le)) * 1000 or vector(0)`
      ),
      qNumber(`sum(increase(kube_pod_container_status_restarts_total${labels}[${range}]))`),
    ]);

    const totalReplicas = deployments.reduce((sum, d) => sum + (d.replicas || 0), 0);
    const readyReplicas = deployments.reduce((sum, d) => sum + (d.readyReplicas || 0), 0);

    const cpuUsagePct = cpuLimitCores > 0 ? (cpuUsedCores / cpuLimitCores) * 100 : 0;
    const memUsagePct = memLimitBytes > 0 ? (memUsedBytes / memLimitBytes) * 100 : 0;

    const uptime = totalReplicas > 0 ? (readyReplicas / totalReplicas) * 100 : 0;

    const metrics = {
      cpu: {
        usage: clamp(cpuUsagePct, 0, 100),
        limit: formatCpuCores(cpuLimitCores),
        request: formatCpuCores(cpuRequestCores),
      },
      memory: {
        usage: clamp(memUsagePct, 0, 100),
        usedBytes: Math.max(0, Math.trunc(memUsedBytes)),
        limitBytes: Math.max(0, Math.trunc(memLimitBytes)),
      },
      network: {
        rxBytes: Math.max(0, Math.trunc(rxBytes)),
        txBytes: Math.max(0, Math.trunc(txBytes)),
        rxRate: Math.max(0, Math.trunc(rxRate)),
        txRate: Math.max(0, Math.trunc(txRate)),
      },
      requests: {
        total: Math.max(0, Math.trunc(reqTotal)),
        rate: Math.max(0, reqRate),
        errorRate: clamp(errPct, 0, 100),
        avgLatency: Math.max(0, Math.trunc(latAvgMs)),
        p95Latency: Math.max(0, Math.trunc(latP95Ms)),
        p99Latency: Math.max(0, Math.trunc(latP99Ms)),
      },
      pods: {
        running: readyReplicas,
        total: totalReplicas,
        restarts: Math.max(0, Math.trunc(restarts)),
      },
      uptime: clamp(uptime, 0, 100),
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error("Error fetching app metrics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}

async function tryGetDeployments(selector: { appLabel: string; namespaces?: string[] }) {
  if (selector.namespaces && selector.namespaces.length > 0) {
    const perNs = await Promise.all(
      selector.namespaces.map((ns) =>
        k3sService.getDeployments({
          namespace: ns,
          labels: { app: selector.appLabel },
        })
      )
    );
    return perNs.flat();
  }

  return await k3sService.getDeployments({
    labels: { app: selector.appLabel },
  });
}

function parseTimeRange(range: string): { range: string } {
  // Accepted: 15m, 1h, 6h, 24h, 7d
  if (/^\d+[smhdw]$/.test(range)) return { range };
  return { range: "1h" };
}

async function qNumber(query: string): Promise<number> {
  try {
    const res = await prometheus.instantQuery(query);
    if (res.length === 0) return 0;
    const raw = res[0]?.value?.[1];
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCpuCores(cores: number): string {
  if (!Number.isFinite(cores) || cores <= 0) return "0m";
  const millicores = Math.round(cores * 1000);
  return `${millicores}m`;
}
