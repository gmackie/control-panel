import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbAsync } from "@/lib/db";
import {
  applications,
  eq,
  giteaRepositories,
  githubRepositories,
  k3sDeployments,
} from "@repo/db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const authBypassEnabled =
  process.env.NODE_ENV !== "production" &&
  (process.env.AUTH_BYPASS === "1" || process.env.AUTH_BYPASS === "true");

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeJson<T>(value: T): T {
  // Remove undefined values to satisfy undici/NextResponse.json serializer
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function inferDeploymentEnvironment(namespace: string): "production" | "staging" | "development" {
  if (namespace === "development") return "development";
  if (
    namespace === "staging" ||
    namespace.includes("-staging") ||
    namespace.includes("-beta") ||
    namespace.includes("-dev")
  ) {
    return "staging";
  }
  return "production";
}

function toEnvStatus(dep: { status: string | null; replicas: number; readyReplicas: number }): string {
  const status = dep.status ?? "unknown";
  if (status === "pending") return "deploying";
  if (status === "failed") return "unhealthy";
  if (dep.replicas > 0 && dep.readyReplicas >= dep.replicas) return "healthy";
  if (dep.readyReplicas > 0) return "degraded";
  return status === "running" ? "degraded" : "unhealthy";
}

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appIdOrSlug = decodeURIComponent(params.id);
    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    }

    let application = null as (typeof applications.$inferSelect) | null;

    if (isUuid(appIdOrSlug)) {
      const [byId] = await db.select().from(applications).where(eq(applications.id, appIdOrSlug)).limit(1);
      application = byId ?? null;
    }

    if (!application) {
      const [bySlug] = await db
        .select()
        .from(applications)
        .where(eq(applications.slug, appIdOrSlug))
        .limit(1);
      if (!bySlug) {
        return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
      }
      application = bySlug;
    }

    const [giteaRepos, githubRepos, deployments] = await Promise.all([
      db.select().from(giteaRepositories).where(eq(giteaRepositories.applicationId, application.id)),
      db.select().from(githubRepositories).where(eq(githubRepositories.applicationId, application.id)),
      db.select().from(k3sDeployments).where(eq(k3sDeployments.applicationId, application.id)),
    ]);

    const candidateRepos = [
      ...giteaRepos.map((r) => ({ provider: "gitea" as const, repo: r })),
      ...githubRepos.map((r) => ({ provider: "github" as const, repo: r })),
    ];

    const preferredRepo =
      candidateRepos.find((r) => r.repo.name === application.slug) ??
      candidateRepos.find((r) => r.provider === "gitea") ??
      candidateRepos[0];

    const repoUrl = preferredRepo?.repo.htmlUrl || preferredRepo?.repo.cloneUrl || preferredRepo?.repo.sshUrl || null;
    const repoFullName = preferredRepo?.repo.fullName || null;
    const defaultBranch = preferredRepo?.repo.defaultBranch || null;

    const environments = deployments
      .map((dep) => {
        const replicas = dep.replicas ?? 0;
        const readyReplicas = dep.readyReplicas ?? 0;
        const environment = inferDeploymentEnvironment(dep.namespace);
        const image = dep.image ?? null;
        const imageTag = image && image.includes(":") ? image.split(":").pop() ?? null : null;

        return {
          environment,
          status: toEnvStatus({ status: dep.status, replicas, readyReplicas }),
          currentCommitSha: null,
          currentCommitMessage: null,
          currentImageTag: imageTag,
          replicas,
          readyReplicas,
          lastDeployedAt: dep.updatedAt?.toISOString() ?? null,
          lastDeployedBy: null,
          url: dep.ingressHost ? `https://${dep.ingressHost}` : null,
        };
      })
      .sort((a, b) => {
        const order: Record<string, number> = { production: 0, staging: 1, development: 2 };
        return (order[a.environment] ?? 99) - (order[b.environment] ?? 99);
      });

    const totalDeployments = environments.length;
    const healthyDeployments = environments.filter((e) => e.status === "healthy").length;
    const successRate = totalDeployments ? Math.round((healthyDeployments / totalDeployments) * 100) : 0;

    const lastActivityAt = (() => {
      const lastDeployment = deployments
        .map((d) => d.updatedAt)
        .filter(Boolean)
        .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];
      return (lastDeployment ?? application.updatedAt).toISOString();
    })();

    const giteaBaseUrl = process.env.GITEA_BASE_URL || "https://gitea.gmac.io";
    const harborBaseUrl = process.env.HARBOR_BASE_URL || process.env.HARBOR_URL || "https://harbor.gmac.io";
    const grafanaBaseUrl = process.env.GRAFANA_EXTERNAL_URL || process.env.GRAFANA_URL || "https://grafana.gmac.io";
    const org = process.env.GITEA_ORG || "gmackie";

    const appSlug = application.slug;
    const giteaLink = repoUrl || `${giteaBaseUrl}/${org}/${appSlug}`;
    const harborLink = harborBaseUrl;
    const grafanaLink = `${grafanaBaseUrl}/d/app-overview/application-overview?var-app=${encodeURIComponent(appSlug)}`;

    return NextResponse.json(
      safeJson({
        success: true,
        data: {
          app: {
            id: application.id,
            name: application.name,
            slug: application.slug,
            description: application.description ?? null,
            repositoryUrl: repoUrl || application.repositoryUrl || null,
            repositoryFullName: repoFullName,
            defaultBranch,
            language: null,
            framework: null,
            status: application.status,
            createdAt: application.createdAt.toISOString(),
            updatedAt: application.updatedAt.toISOString(),
          },
          environments,
          metrics: {
            totalCommits: 0,
            totalDeployments,
            totalPipelines: 0,
            successRate,
            lastActivityAt,
          },
          externalLinks: {
            gitea: giteaLink,
            harbor: harborLink,
            grafana: grafanaLink,
          },
          screenshotUrl: null,
        },
      }),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to fetch application dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
