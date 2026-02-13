import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDbAsync } from "@/lib/db";
import {
  appIntegrations,
  applications,
  eq,
  giteaRepositories,
  githubRepositories,
  k3sDeployments,
} from "@repo/db";

import type {
  ApplicationStatus,
  DeploymentInfo,
  IntegrationConfig,
  IntegrationType,
  RepositoryInfo,
  UnifiedApplication,
} from "@/types/unified-app";

const authBypassEnabled =
  process.env.NODE_ENV !== "production" &&
  (process.env.AUTH_BYPASS === "1" || process.env.AUTH_BYPASS === "true");

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function inferDeploymentEnvironment(namespace: string): DeploymentInfo["environment"] {
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

function toDeploymentStatus(dep: { status: string | null; replicas: number; readyReplicas: number }): DeploymentInfo["status"] {
  const status = dep.status ?? "unknown";
  if (status === "pending") return "deploying";
  if (status === "failed") return "unhealthy";
  if (dep.replicas > 0 && dep.readyReplicas >= dep.replicas) return "healthy";
  if (dep.readyReplicas > 0) return "degraded";
  return status === "running" ? "degraded" : "unhealthy";
}

function integrationTypeFromProvider(provider: string): IntegrationType {
  switch (provider) {
    case "turso":
      return "database_turso";
    case "supabase":
      return "database_supabase";
    case "neon":
    case "database":
    case "postgres":
      return "database_postgres";
    case "clerk":
      return "auth_clerk";
    case "stripe":
      return "payments_stripe";
    case "posthog":
      return "analytics_posthog";
    case "sentry":
      return "errors_sentry";
    case "sendgrid":
      return "email_sendgrid";
    case "twilio":
      return "sms_twilio";
    case "openrouter":
      return "ai_openrouter";
    case "elevenlabs":
      return "voice_elevenlabs";
    case "vercel":
      return "hosting_vercel";
    default:
      return "custom_webhook";
  }
}

function safeParseJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function computeEnvStatus(deployments: DeploymentInfo[]): ApplicationStatus["staging"] {
  if (deployments.length === 0) return "not_deployed";
  if (deployments.some((d) => d.status === "deploying")) return "deploying";
  if (deployments.some((d) => d.status === "unhealthy")) return "unhealthy";
  if (deployments.some((d) => d.status === "degraded")) return "degraded";
  return "healthy";
}

/**
 * GET /api/apps/[id]
 * 
 * Returns full details for a single application including:
 * - Basic app info from database
 * 
 * TODO: Add Gitea, K8s, and Harbor integration when needed
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Decode the ID (could be "owner/repo" format)
    const appId = decodeURIComponent(params.id);
    
    const db = await getDbAsync();
    
    if (!db) {
      return NextResponse.json(
        { 
          success: false,
          error: "Database not available",
        },
        { status: 503 }
      );
    }
    
    let application = null as (typeof applications.$inferSelect) | null;

    if (isUuid(appId)) {
      const [byId] = await db.select().from(applications).where(eq(applications.id, appId)).limit(1);
      application = byId ?? null;
    }
    
    if (!application) {
      // Try to find by slug
      const [appBySlug] = await db
        .select()
        .from(applications)
        .where(eq(applications.slug, appId))
        .limit(1);
      
      if (!appBySlug) {
        return NextResponse.json(
          { 
            success: false,
            error: "Application not found",
          },
          { status: 404 }
        );
      }

      application = appBySlug;
    }

    const [giteaRepos, githubRepos, deployments, integrations] = await Promise.all([
      db.select().from(giteaRepositories).where(eq(giteaRepositories.applicationId, application.id)),
      db.select().from(githubRepositories).where(eq(githubRepositories.applicationId, application.id)),
      db.select().from(k3sDeployments).where(eq(k3sDeployments.applicationId, application.id)),
      db.select().from(appIntegrations).where(eq(appIntegrations.applicationId, application.id)),
    ]);

    const candidateRepos = [
      ...giteaRepos.map((r) => ({ provider: "gitea" as const, repo: r })),
      ...githubRepos.map((r) => ({ provider: "github" as const, repo: r })),
    ];

    const preferredRepo =
      candidateRepos.find((r) => r.repo.name === application.slug) ??
      candidateRepos.find((r) => r.provider === "gitea") ??
      candidateRepos[0];

    const repository: RepositoryInfo | null = preferredRepo
      ? (() => {
          const repo = preferredRepo.repo;
          const [ownerFromFullName, nameFromFullName] = (repo.fullName || "").split("/");
          const owner = repo.owner || ownerFromFullName || "gmackie";
          const name = repo.name || nameFromFullName || application.slug;
          const fullName = repo.fullName || `${owner}/${name}`;
          const url = repo.htmlUrl || repo.cloneUrl || repo.sshUrl || "";
          const cloneUrl = repo.cloneUrl || repo.sshUrl || url;

          return {
            provider: preferredRepo.provider,
            owner,
            name,
            fullName,
            url,
            cloneUrl,
            defaultBranch: repo.defaultBranch || "main",
            isPrivate: !!repo.private,
            branches: [],
            openPullRequests: 0,
            stars: repo.stars ?? 0,
            forks: repo.forks ?? 0,
            openIssues: repo.openIssues ?? 0,
          };
        })()
      : null;

    const mappedDeployments: DeploymentInfo[] = deployments
      .map((dep) => {
        const replicas = dep.replicas ?? 0;
        const readyReplicas = dep.readyReplicas ?? 0;
        const environment = inferDeploymentEnvironment(dep.namespace);
        const currentImage = dep.image ?? undefined;
        const currentVersion = currentImage?.includes(":") ? currentImage.split(":").pop() : undefined;

        return {
          environment,
          namespace: dep.namespace,
          name: dep.name,
          status: toDeploymentStatus({
            status: dep.status ?? "unknown",
            replicas,
            readyReplicas,
          }),
          replicas,
          readyReplicas,
          availableReplicas: readyReplicas,
          currentImage,
          currentVersion,
          lastDeployedAt: dep.updatedAt?.toISOString(),
          url: dep.ingressHost ? `https://${dep.ingressHost}` : undefined,
          pods: [],
        };
      })
      .sort((a, b) => {
        const order: Record<string, number> = { production: 0, staging: 1, development: 2, preview: 3 };
        return (order[a.environment] ?? 99) - (order[b.environment] ?? 99) || a.name.localeCompare(b.name);
      });

    const mappedIntegrations: IntegrationConfig[] = integrations.map((integration) => {
      const type = integrationTypeFromProvider(integration.provider);
      const config = safeParseJson(integration.config);
      const credentialsPresent = !!integration.credentials;

      return {
        id: integration.id,
        type,
        name: integration.name,
        status: integration.enabled ? "active" : "inactive",
        config: {
          provider: integration.provider,
          environment: integration.environment,
          detectedFromK8s: integration.detectedFromK8s,
          k8sNamespace: integration.k8sNamespace,
          hasCredentials: credentialsPresent,
          ...config,
        },
        healthStatus: "unknown",
        createdAt: integration.createdAt.toISOString(),
        updatedAt: integration.updatedAt.toISOString(),
      };
    });

    const stagingDeployments = mappedDeployments.filter((d) => d.environment === "staging");
    const productionDeployments = mappedDeployments.filter((d) => d.environment === "production");

    const stagingStatus = computeEnvStatus(stagingDeployments);
    const productionStatus = computeEnvStatus(productionDeployments);

    const repositoryStatus: ApplicationStatus["repository"] = repository ? "connected" : "disconnected";

    const overall: ApplicationStatus["overall"] = (() => {
      if (productionStatus === "unhealthy") return "unhealthy";
      if (stagingStatus === "unhealthy") return "degraded";
      if (productionStatus === "degraded" || stagingStatus === "degraded") return "degraded";
      if (productionStatus === "deploying" || stagingStatus === "deploying") return "degraded";
      if (productionStatus === "healthy") return "healthy";
      if (repositoryStatus === "connected") return "degraded";
      return "unknown";
    })();

    const createdBy = authBypassEnabled
      ? "local-dev"
      : (session!.user as { login?: string }).login || session!.user.email || "unknown";

    const unifiedApp: UnifiedApplication = {
      id: application.id,
      name: application.name,
      slug: application.slug,
      description: application.description ?? undefined,
      repository,
      deployments: mappedDeployments,
      images: [],
      integrations: mappedIntegrations,
      status: {
        overall,
        repository: repositoryStatus,
        ci: "unknown",
        staging: stagingStatus,
        production: productionStatus,
        lastActivity: application.updatedAt.toISOString(),
      },
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      createdBy,
      tags: [],
    };

    return NextResponse.json({
      success: true,
      data: unifiedApp,
    });
  } catch (error) {
    console.error("Failed to fetch application:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch application",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
