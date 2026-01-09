/**
 * Integrations Router
 * 
 * tRPC procedures for discovering, linking, and managing integration resources
 * across providers (Vercel, Neon, Turso, Expo, GitHub, Gitea, etc.)
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { 
  applications, 
  orgIntegrations, 
  appIntegrations,
  vercelProjects, 
  expoProjects, 
  neonProjects, 
  tursoDatabases,
  integrationResources,
  eq, 
  isNull,
  and,
  desc,
} from "@repo/db";
import { TRPCError } from "@trpc/server";

export interface DiscoveredResource {
  id: string;
  provider: string;
  resourceType: string;
  resourceId: string;
  name: string;
  metadata: Record<string, unknown>;
  applicationId: string | null;
  integrationId: string;
}

export interface ApplicationResource {
  provider: string;
  resourceType: string;
  resourceId: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface IntegrationSecret {
  provider: string;
  integrationName: string;
  secrets: { key: string; value: string; description?: string }[];
}

export const integrationsRouter = router({
  /**
   * Discover all resources across org integrations
   * Returns resources grouped by provider, indicating which are linked to apps
   */
  discover: publicProcedure
    .input(z.object({
      unlinkedOnly: z.boolean().optional().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const unlinkedOnly = input?.unlinkedOnly ?? false;

      const [vercel, expo, neon, turso, genericResources] = await Promise.all([
        ctx.db.select().from(vercelProjects).orderBy(desc(vercelProjects.updatedAt)),
        ctx.db.select().from(expoProjects).orderBy(desc(expoProjects.updatedAt)),
        ctx.db.select().from(neonProjects).orderBy(desc(neonProjects.updatedAt)),
        ctx.db.select().from(tursoDatabases).orderBy(desc(tursoDatabases.updatedAt)),
        ctx.db.select().from(integrationResources).orderBy(desc(integrationResources.updatedAt)),
      ]);

      const resources: DiscoveredResource[] = [];

      for (const v of vercel) {
        if (unlinkedOnly && v.applicationId) continue;
        resources.push({
          id: v.id,
          provider: "vercel",
          resourceType: "project",
          resourceId: v.vercelProjectId,
          name: v.name,
          metadata: { framework: v.framework, productionUrl: v.productionUrl },
          applicationId: v.applicationId,
          integrationId: v.orgIntegrationId || "",
        });
      }

      for (const e of expo) {
        if (unlinkedOnly && e.applicationId) continue;
        resources.push({
          id: e.id,
          provider: "expo",
          resourceType: "project",
          resourceId: e.expoProjectId,
          name: e.name,
          metadata: { slug: e.slug, platform: e.platform },
          applicationId: e.applicationId,
          integrationId: e.orgIntegrationId || "",
        });
      }

      for (const n of neon) {
        if (unlinkedOnly && n.applicationId) continue;
        resources.push({
          id: n.id,
          provider: "neon",
          resourceType: "database",
          resourceId: n.neonProjectId,
          name: n.name,
          metadata: { regionId: n.regionId },
          applicationId: n.applicationId,
          integrationId: n.orgIntegrationId || "",
        });
      }

      for (const t of turso) {
        if (unlinkedOnly && t.applicationId) continue;
        resources.push({
          id: t.id,
          provider: "turso",
          resourceType: "database",
          resourceId: t.tursoDbId,
          name: t.name,
          metadata: { group: t.group, primaryRegion: t.primaryRegion, hostname: t.hostname },
          applicationId: t.applicationId,
          integrationId: t.orgIntegrationId || "",
        });
      }

      for (const g of genericResources) {
        if (unlinkedOnly && g.applicationId) continue;
        resources.push({
          id: g.id,
          provider: "generic",
          resourceType: g.resourceType,
          resourceId: g.resourceId,
          name: g.resourceName,
          metadata: g.metadata ? JSON.parse(g.metadata) : {},
          applicationId: g.applicationId,
          integrationId: g.integrationId,
        });
      }

      const byProvider: Record<string, DiscoveredResource[]> = {};
      for (const r of resources) {
        if (!byProvider[r.provider]) byProvider[r.provider] = [];
        byProvider[r.provider].push(r);
      }

      return {
        total: resources.length,
        unlinked: resources.filter(r => !r.applicationId).length,
        byProvider,
        resources,
      };
    }),

  /**
   * Get all resources linked to a specific application
   */
  applicationResources: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input: applicationId }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const app = await ctx.db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
      if (!app[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      const [vercel, expo, neon, turso, appIntegrationsList, genericResources] = await Promise.all([
        ctx.db.select().from(vercelProjects).where(eq(vercelProjects.applicationId, applicationId)),
        ctx.db.select().from(expoProjects).where(eq(expoProjects.applicationId, applicationId)),
        ctx.db.select().from(neonProjects).where(eq(neonProjects.applicationId, applicationId)),
        ctx.db.select().from(tursoDatabases).where(eq(tursoDatabases.applicationId, applicationId)),
        ctx.db.select().from(appIntegrations).where(eq(appIntegrations.applicationId, applicationId)),
        ctx.db.select().from(integrationResources).where(eq(integrationResources.applicationId, applicationId)),
      ]);

      const resources: ApplicationResource[] = [];

      for (const v of vercel) {
        resources.push({
          provider: "vercel",
          resourceType: "project",
          resourceId: v.vercelProjectId,
          name: v.name,
          metadata: { framework: v.framework, productionUrl: v.productionUrl },
        });
      }

      for (const e of expo) {
        resources.push({
          provider: "expo",
          resourceType: "project",
          resourceId: e.expoProjectId,
          name: e.name,
          metadata: { slug: e.slug, platform: e.platform },
        });
      }

      for (const n of neon) {
        resources.push({
          provider: "neon",
          resourceType: "database",
          resourceId: n.neonProjectId,
          name: n.name,
          metadata: { regionId: n.regionId },
        });
      }

      for (const t of turso) {
        resources.push({
          provider: "turso",
          resourceType: "database",
          resourceId: t.tursoDbId,
          name: t.name,
          metadata: { group: t.group, primaryRegion: t.primaryRegion, hostname: t.hostname },
        });
      }

      for (const g of genericResources) {
        resources.push({
          provider: "generic",
          resourceType: g.resourceType,
          resourceId: g.resourceId,
          name: g.resourceName,
          metadata: g.metadata ? JSON.parse(g.metadata) : {},
        });
      }

      const integrations = appIntegrationsList.map(i => ({
        provider: i.provider,
        name: i.name,
        enabled: i.enabled,
        hasCredentials: !!i.credentials,
      }));

      return {
        application: app[0],
        resources,
        integrations,
        summary: {
          totalResources: resources.length,
          totalIntegrations: integrations.length,
          byProvider: resources.reduce((acc, r) => {
            acc[r.provider] = (acc[r.provider] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      };
    }),

  /**
   * Link resources to an application
   */
  linkResources: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      resources: z.array(z.object({
        provider: z.string(),
        resourceId: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const app = await ctx.db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
      if (!app[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      const results = { linked: 0, failed: 0, errors: [] as string[] };

      for (const resource of input.resources) {
        try {
          switch (resource.provider) {
            case "vercel":
              await ctx.db
                .update(vercelProjects)
                .set({ applicationId: input.applicationId, updatedAt: new Date() })
                .where(eq(vercelProjects.vercelProjectId, resource.resourceId));
              break;
            case "expo":
              await ctx.db
                .update(expoProjects)
                .set({ applicationId: input.applicationId, updatedAt: new Date() })
                .where(eq(expoProjects.expoProjectId, resource.resourceId));
              break;
            case "neon":
              await ctx.db
                .update(neonProjects)
                .set({ applicationId: input.applicationId, updatedAt: new Date() })
                .where(eq(neonProjects.neonProjectId, resource.resourceId));
              break;
            case "turso":
              await ctx.db
                .update(tursoDatabases)
                .set({ applicationId: input.applicationId, updatedAt: new Date() })
                .where(eq(tursoDatabases.tursoDbId, resource.resourceId));
              break;
            default:
              await ctx.db
                .update(integrationResources)
                .set({ applicationId: input.applicationId, updatedAt: new Date() })
                .where(eq(integrationResources.resourceId, resource.resourceId));
          }
          results.linked++;
        } catch (err) {
          results.failed++;
          results.errors.push(`Failed to link ${resource.provider}:${resource.resourceId}: ${err}`);
        }
      }

      return results;
    }),

  /**
   * Get all secrets/credentials for an application from its integrations
   */
  applicationSecrets: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input: applicationId }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const app = await ctx.db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
      if (!app[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      const appIntegrationsList = await ctx.db
        .select()
        .from(appIntegrations)
        .where(eq(appIntegrations.applicationId, applicationId));

      const [vercel, neon, turso] = await Promise.all([
        ctx.db.select().from(vercelProjects).where(eq(vercelProjects.applicationId, applicationId)),
        ctx.db.select().from(neonProjects).where(eq(neonProjects.applicationId, applicationId)),
        ctx.db.select().from(tursoDatabases).where(eq(tursoDatabases.applicationId, applicationId)),
      ]);

      const secrets: IntegrationSecret[] = [];

      for (const integration of appIntegrationsList) {
        if (!integration.credentials) continue;

        try {
          const creds = JSON.parse(integration.credentials);
          const secretsList: { key: string; value: string; description?: string }[] = [];

          for (const [key, value] of Object.entries(creds)) {
            if (typeof value === "string" && value) {
              secretsList.push({ key, value });
            }
          }

          if (secretsList.length > 0) {
            secrets.push({
              provider: integration.provider,
              integrationName: integration.name,
              secrets: secretsList,
            });
          }
        } catch {
          // Skip invalid JSON
        }
      }

      for (const n of neon) {
        const orgIntegration = n.orgIntegrationId
          ? await ctx.db.select().from(orgIntegrations).where(eq(orgIntegrations.id, n.orgIntegrationId)).limit(1)
          : [];
        
        if (orgIntegration[0]?.credentials) {
          try {
            const creds = JSON.parse(orgIntegration[0].credentials);
            if (creds.apiKey) {
              secrets.push({
                provider: "neon",
                integrationName: n.name,
                secrets: [
                  { key: "NEON_API_KEY", value: creds.apiKey },
                  { key: "NEON_PROJECT_ID", value: n.neonProjectId },
                ],
              });
            }
          } catch {}
        }
      }

      for (const t of turso) {
        const orgIntegration = t.orgIntegrationId
          ? await ctx.db.select().from(orgIntegrations).where(eq(orgIntegrations.id, t.orgIntegrationId)).limit(1)
          : [];
        
        if (orgIntegration[0]?.credentials) {
          try {
            const creds = JSON.parse(orgIntegration[0].credentials);
            secrets.push({
              provider: "turso",
              integrationName: t.name,
              secrets: [
                { key: "TURSO_DATABASE_URL", value: `libsql://${t.hostname}` },
                ...(creds.authToken ? [{ key: "TURSO_AUTH_TOKEN", value: creds.authToken }] : []),
              ],
            });
          } catch {}
        }
      }

      return {
        applicationId,
        applicationName: app[0].name,
        secrets,
        totalSecrets: secrets.reduce((sum, s) => sum + s.secrets.length, 0),
      };
    }),

  /**
   * Export secrets as .env file content
   */
  exportEnv: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      format: z.enum(["dotenv", "json", "yaml"]).optional().default("dotenv"),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const app = await ctx.db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
      if (!app[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      const appIntegrationsList = await ctx.db
        .select()
        .from(appIntegrations)
        .where(eq(appIntegrations.applicationId, input.applicationId));

      const [neon, turso] = await Promise.all([
        ctx.db.select().from(neonProjects).where(eq(neonProjects.applicationId, input.applicationId)),
        ctx.db.select().from(tursoDatabases).where(eq(tursoDatabases.applicationId, input.applicationId)),
      ]);

      const envVars: Record<string, string> = {};

      for (const integration of appIntegrationsList) {
        if (!integration.credentials) continue;
        try {
          const creds = JSON.parse(integration.credentials);
          for (const [key, value] of Object.entries(creds)) {
            if (typeof value === "string" && value) {
              envVars[key.toUpperCase()] = value;
            }
          }
        } catch {}
      }

      for (const n of neon) {
        const orgIntegration = n.orgIntegrationId
          ? await ctx.db.select().from(orgIntegrations).where(eq(orgIntegrations.id, n.orgIntegrationId)).limit(1)
          : [];
        
        if (orgIntegration[0]?.credentials) {
          try {
            const creds = JSON.parse(orgIntegration[0].credentials);
            if (creds.apiKey) envVars["NEON_API_KEY"] = creds.apiKey;
            if (creds.connectionString) envVars["DATABASE_URL"] = creds.connectionString;
            envVars["NEON_PROJECT_ID"] = n.neonProjectId;
          } catch {}
        }
      }

      for (const t of turso) {
        if (t.hostname) {
          envVars["TURSO_DATABASE_URL"] = `libsql://${t.hostname}`;
        }
        
        const orgIntegration = t.orgIntegrationId
          ? await ctx.db.select().from(orgIntegrations).where(eq(orgIntegrations.id, t.orgIntegrationId)).limit(1)
          : [];
        
        if (orgIntegration[0]?.credentials) {
          try {
            const creds = JSON.parse(orgIntegration[0].credentials);
            if (creds.authToken) envVars["TURSO_AUTH_TOKEN"] = creds.authToken;
          } catch {}
        }
      }

      let content: string;
      
      switch (input.format) {
        case "json":
          content = JSON.stringify(envVars, null, 2);
          break;
        case "yaml":
          content = Object.entries(envVars)
            .map(([k, v]) => `${k}: "${v.replace(/"/g, '\\"')}"`)
            .join("\n");
          break;
        case "dotenv":
        default:
          content = Object.entries(envVars)
            .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
            .join("\n");
      }

      return {
        applicationId: input.applicationId,
        applicationName: app[0].name,
        format: input.format,
        content,
        variableCount: Object.keys(envVars).length,
      };
    }),

  /**
   * List all org-level integrations
   */
  listOrgIntegrations: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const integrations = await ctx.db
        .select()
        .from(orgIntegrations)
        .orderBy(desc(orgIntegrations.createdAt));

      return integrations.map(i => ({
        id: i.id,
        provider: i.provider,
        name: i.name,
        description: i.description,
        enabled: i.enabled,
        hasCredentials: !!i.credentials,
        lastSyncAt: i.lastSyncAt,
        lastSyncStatus: i.lastSyncStatus,
      }));
    }),
});
