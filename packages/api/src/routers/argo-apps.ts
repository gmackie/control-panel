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
