import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbAsync } from "@/lib/db";
import { and, appIntegrations, applications, eq } from "@repo/db";
import { GrafanaClient } from "@/lib/grafana/client";
import { resolveAppK8sSelector } from "@/lib/applications/resolve-app-k8s-selector";
import { K3sService } from "@/lib/k3s/k3s-service";
import { buildAppDashboardTemplate } from "@/lib/grafana/app-dashboard-template";

const grafana = new GrafanaClient();
const k3s = new K3sService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const appIdOrSlug = decodeURIComponent(id);

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    }

    const application = await resolveApplication(db, appIdOrSlug);
    if (!application) {
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    }

    const environment = (await safeReadJson(request))?.environment || "production";
    const selector = await resolveAppK8sSelector(application.id);
    const namespace = (await resolveNamespace(selector)) || application.k8sNamespace || "default";

    const uid = `app-${selector.appLabel}`.slice(0, 40);
    const title = `${application.name || selector.appLabel} - Overview`;

    const dashboard = buildAppDashboardTemplate({
      uid,
      title,
      tags: ["application", selector.appLabel, namespace],
      namespace,
      podPrefix: selector.podPrefix,
    });

    const upserted = await grafana.upsertDashboard({
      dashboard,
      message: `control-panel: setup dashboard for ${selector.appLabel}`,
      overwrite: true,
    });

    const config = {
      dashboardUid: upserted.uid,
      dashboardSlug: upserted.slug,
      dashboardTitle: title,
      namespace,
      appLabel: selector.appLabel,
      podPrefix: selector.podPrefix,
      updatedAt: new Date().toISOString(),
    };

    const existing = await db
      .select({ id: appIntegrations.id })
      .from(appIntegrations)
      .where(and(eq(appIntegrations.applicationId, application.id), eq(appIntegrations.provider, "grafana"), eq(appIntegrations.environment, environment)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(appIntegrations)
        .set({
          enabled: true,
          config: JSON.stringify(config),
          k8sNamespace: namespace,
          detectedFromK8s: true,
          updatedAt: new Date(),
        })
        .where(eq(appIntegrations.id, existing[0].id));
    } else {
      await db.insert(appIntegrations).values({
        applicationId: application.id,
        provider: "grafana",
        name: "Grafana",
        enabled: true,
        environment,
        k8sNamespace: namespace,
        detectedFromK8s: true,
        config: JSON.stringify(config),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        environment,
        namespace,
        dashboardUid: upserted.uid,
        dashboardSlug: upserted.slug,
        dashboardUrl: upserted.url,
      },
    });
  } catch (error) {
    console.error("Error setting up Grafana dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to set up Grafana dashboard",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function safeReadJson(request: NextRequest): Promise<any | null> {
  try {
    return await request.json();
  } catch {
    return null;
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
