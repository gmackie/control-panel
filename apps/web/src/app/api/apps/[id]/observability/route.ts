import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GrafanaClient } from "@/lib/grafana/client";
import { K3sService } from "@/lib/k3s/k3s-service";
import { resolveAppK8sSelector } from "@/lib/applications/resolve-app-k8s-selector";

const grafana = new GrafanaClient();
const k3s = new K3sService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const appId = decodeURIComponent(id);
    const selector = await resolveAppK8sSelector(appId);

    const namespace = (await resolveNamespace(selector)) || "default";

    const lokiQuery = `{namespace="${namespace}",app="${selector.appLabel}"}`;
    const promLabels = `{namespace="${namespace}",pod=~"${escapeRegex(selector.podPrefix)}.*"}`;

    const dashboardUrl = grafana.getDashboardUrl({ namespace, app: selector.appLabel });
    const exploreLogsUrl = grafana.getExploreUrl(lokiQuery, "loki");

    // Provide an actually useful default query instead of a raw label selector.
    const cpuQuery = `sum(rate(container_cpu_usage_seconds_total${promLabels}{container!="POD"}[5m]))`;
    const memQuery = `sum(container_memory_working_set_bytes${promLabels}{container!="POD"})`;
    const exploreMetricsUrl = grafana.getExploreUrl(cpuQuery, "prometheus");
    const alertsUrl = `${grafana.getExternalBaseUrl().replace(/\/$/, "")}/alerting/list?queryString=${encodeURIComponent(selector.appLabel)}`;

    return NextResponse.json({
      success: true,
      data: {
        namespace,
        appLabel: selector.appLabel,
        grafana: {
          dashboardUrl,
          alertsUrl,
        },
        loki: {
          query: lokiQuery,
          exploreUrl: exploreLogsUrl,
        },
        prometheus: {
          labels: promLabels,
          exploreUrl: exploreMetricsUrl,
          queries: {
            cpu: cpuQuery,
            memory: memQuery,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error building observability links:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to build observability links",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function resolveNamespace(selector: { appLabel: string; namespaces?: string[] }): Promise<string | undefined> {
  if (selector.namespaces && selector.namespaces.length > 0) {
    return selector.namespaces[0];
  }

  const deployments = await k3s.getDeployments({ labels: { app: selector.appLabel } });
  return deployments[0]?.namespace;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
