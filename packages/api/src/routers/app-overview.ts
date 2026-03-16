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
