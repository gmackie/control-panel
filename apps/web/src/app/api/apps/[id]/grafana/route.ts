import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbAsync } from "@/lib/db";
import { and, appIntegrations, applications, eq } from "@repo/db";
import { GrafanaClient } from "@/lib/grafana/client";
import { resolveAppK8sSelector } from "@/lib/applications/resolve-app-k8s-selector";
import { K3sService } from "@/lib/k3s/k3s-service";

const grafana = new GrafanaClient();
const k3s = new K3sService();

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
    const appIdOrSlug = decodeURIComponent(id);
    const environment = new URL(request.url).searchParams.get("environment") || "production";

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    }

    const application = await resolveApplication(db, appIdOrSlug);
    if (!application) {
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    }

    const selector = await resolveAppK8sSelector(application.id);
    const namespace = (await resolveNamespace(selector)) || application.k8sNamespace || "default";

    const [integration] = await db
      .select()
      .from(appIntegrations)
      .where(and(eq(appIntegrations.applicationId, application.id), eq(appIntegrations.provider, "grafana"), eq(appIntegrations.environment, environment)))
      .limit(1);

    const cfg = safeJsonParse<Record<string, unknown>>(integration?.config || "") || {};

    const dashboards = await safeSearchDashboards(selector.appLabel);
    const configuredDashboardUid = typeof cfg.dashboardUid === "string" ? cfg.dashboardUid : undefined;
    const configuredDashboardSlug = typeof cfg.dashboardSlug === "string" ? cfg.dashboardSlug : undefined;

    // Prefer a direct dashboard URL if we know the UID.
    const dashboardUrl = configuredDashboardUid ? grafana.getDashboardUrl({ dashboardUid: configuredDashboardUid }) : undefined;

    return NextResponse.json({
      success: true,
      data: {
        environment,
        namespace,
        appLabel: selector.appLabel,
        configured: {
          enabled: integration?.enabled ?? false,
          dashboardUid: configuredDashboardUid,
          dashboardSlug: configuredDashboardSlug,
          dashboardUrl,
          updatedAt: integration?.updatedAt ? integration.updatedAt.toISOString() : undefined,
        },
        dashboards: dashboards.map((d) => ({
          uid: d.uid,
          slug: d.slug,
          title: d.title,
          url: `${grafana.getExternalBaseUrl().replace(/\/$/, "")}${d.url}`,
          tags: d.tags,
        })),
        previews: {
          panels: [
            { id: 1, title: "CPU Usage" },
            { id: 2, title: "Memory" },
            { id: 3, title: "Restarts" },
          ],
        },
      },
    });
  } catch (error) {
    console.error("Error fetching Grafana integration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Grafana integration",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function resolveApplication(db: any, appIdOrSlug: string): Promise<any | null> {
  const [byId] = await db.select().from(applications).where(eq(applications.id, appIdOrSlug)).limit(1);
  if (byId) return byId;
  const [bySlug] = await db.select().from(applications).where(eq(applications.slug, appIdOrSlug)).limit(1);
  return bySlug || null;
}

async function resolveNamespace(selector: { appLabel: string; namespaces?: string[] }): Promise<string | undefined> {
  if (selector.namespaces && selector.namespaces.length > 0) return selector.namespaces[0];
  const deployments = await k3s.getDeployments({ labels: { app: selector.appLabel } });
  return deployments[0]?.namespace;
}

async function safeSearchDashboards(appLabel: string) {
  try {
    const dashboards = await grafana.searchDashboards(appLabel);
    return dashboards;
  } catch {
    return [];
  }
}

function safeJsonParse<T>(value: string): T | null {
  try {
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
