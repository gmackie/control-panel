import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "../context.js";
import { executeTool, NotFoundError } from "../tool-wrapper.js";

export function registerAppSetupTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    "discover_resources",
    "Discover all resources across org integrations (Vercel, Neon, Turso, Expo, etc.). Returns resources grouped by provider, indicating which are linked to applications.",
    {
      unlinkedOnly: z.boolean().optional().describe("Only return resources not linked to any application (default: false)"),
    },
    async (args) => {
      return executeTool("discover_resources", async () => {
        const result = await ctx.api.integrations.discover({ unlinkedOnly: args.unlinkedOnly });
        return {
          total: result.total,
          unlinked: result.unlinked,
          summary: Object.entries(result.byProvider).map(([provider, resources]) => ({
            provider,
            total: resources.length,
            linked: resources.filter(r => r.applicationId).length,
            unlinked: resources.filter(r => !r.applicationId).length,
          })),
          resources: result.resources.map(r => ({
            id: r.id,
            provider: r.provider,
            resourceType: r.resourceType,
            resourceId: r.resourceId,
            name: r.name,
            isLinked: !!r.applicationId,
            applicationId: r.applicationId,
          })),
        };
      });
    }
  );

  server.tool(
    "get_application_resources",
    "Get all resources and integrations linked to a specific application",
    {
      applicationId: z.string().describe("Application ID (UUID)"),
    },
    async (args) => {
      return executeTool("get_application_resources", async () => {
        const result = await ctx.api.integrations.applicationResources(args.applicationId);
        return {
          application: {
            id: result.application.id,
            name: result.application.name,
            slug: result.application.slug,
            localRepoPath: result.application.localRepoPath,
          },
          resources: result.resources,
          integrations: result.integrations,
          summary: result.summary,
        };
      });
    }
  );

  server.tool(
    "link_resources_to_application",
    "Link discovered resources to an application. Use discover_resources first to find available resources.",
    {
      applicationId: z.string().describe("Application ID to link resources to"),
      resources: z.array(z.object({
        provider: z.string().describe("Provider name (vercel, neon, turso, expo, etc.)"),
        resourceId: z.string().describe("Resource ID from the provider"),
      })).describe("List of resources to link"),
    },
    async (args) => {
      return executeTool("link_resources_to_application", async () => {
        const resources = args.resources.map(r => ({
          provider: r.provider!,
          resourceId: r.resourceId!,
        }));
        const result = await ctx.api.integrations.linkResources({
          applicationId: args.applicationId,
          resources,
        });
        return result;
      });
    }
  );

  server.tool(
    "get_application_secrets",
    "Get all secrets and credentials for an application from its linked integrations. Returns API keys, database URLs, auth tokens, etc.",
    {
      applicationId: z.string().describe("Application ID (UUID)"),
    },
    async (args) => {
      return executeTool("get_application_secrets", async () => {
        const result = await ctx.api.integrations.applicationSecrets(args.applicationId);
        return {
          applicationId: result.applicationId,
          applicationName: result.applicationName,
          totalSecrets: result.totalSecrets,
          byProvider: result.secrets.map(s => ({
            provider: s.provider,
            integrationName: s.integrationName,
            secretCount: s.secrets.length,
            keys: s.secrets.map(sec => sec.key),
          })),
          secrets: result.secrets,
        };
      });
    }
  );

  server.tool(
    "export_application_env",
    "Export all secrets for an application as environment variable content (.env, JSON, or YAML format)",
    {
      applicationId: z.string().describe("Application ID (UUID)"),
      format: z.enum(["dotenv", "json", "yaml"]).optional().describe("Output format (default: dotenv)"),
    },
    async (args) => {
      return executeTool("export_application_env", async () => {
        const result = await ctx.api.integrations.exportEnv({
          applicationId: args.applicationId,
          format: args.format,
        });
        return result;
      });
    }
  );

  server.tool(
    "update_application",
    "Update an application's settings including name, description, repository URL, or local repo path",
    {
      id: z.string().describe("Application ID (UUID)"),
      name: z.string().optional().describe("New application name"),
      description: z.string().optional().describe("New description"),
      repositoryUrl: z.string().optional().describe("Git repository URL"),
      localRepoPath: z.string().optional().describe("Local filesystem path to the repository (for LLM agent access)"),
      status: z.string().optional().describe("Application status (active, inactive, archived)"),
    },
    async (args) => {
      return executeTool("update_application", async () => {
        const result = await ctx.api.applications.update({
          id: args.id,
          name: args.name,
          description: args.description,
          repositoryUrl: args.repositoryUrl,
          localRepoPath: args.localRepoPath,
          status: args.status,
        });
        return {
          id: result.id,
          name: result.name,
          slug: result.slug,
          description: result.description,
          repositoryUrl: result.repositoryUrl,
          localRepoPath: result.localRepoPath,
          status: result.status,
          updatedAt: result.updatedAt,
        };
      });
    }
  );

  server.tool(
    "list_org_integrations",
    "List all organization-level integrations (Vercel, Neon, Turso, GitHub, etc.) with their sync status",
    {},
    async () => {
      return executeTool("list_org_integrations", async () => {
        const integrations = await ctx.api.integrations.listOrgIntegrations();
        return {
          count: integrations.length,
          integrations: integrations.map(i => ({
            id: i.id,
            provider: i.provider,
            name: i.name,
            description: i.description,
            enabled: i.enabled,
            hasCredentials: i.hasCredentials,
            lastSyncAt: i.lastSyncAt,
            lastSyncStatus: i.lastSyncStatus,
          })),
        };
      });
    }
  );

  server.tool(
    "sync_integration",
    "Sync resources from an org integration (Vercel, Neon, Expo, Gitea, GitHub, etc.). This pulls the latest resources from the provider API and stores them locally for discovery.",
    {
      integrationId: z.string().describe("Integration ID (UUID) from list_org_integrations"),
    },
    async (args) => {
      return executeTool("sync_integration", async () => {
        const result = await ctx.api.integrations.syncIntegration(args.integrationId);
        return {
          success: result.success,
          resourcesSynced: result.projectsCount,
          message: result.success 
            ? `Successfully synced ${result.projectsCount} resources`
            : `Sync failed: ${result.error || result.details || 'Unknown error'}`,
        };
      });
    }
  );

  server.tool(
    "discover_k8s_deployments",
    "Discover K8s deployments from all namespaces, create k3sDeployments records, and auto-link to applications by matching namespace/deployment names to app slugs. Also detects integrations from secrets.",
    {
      linkToApplications: z.boolean().optional().default(true).describe("Auto-link deployments to applications by matching slugs (default: true)"),
      syncIntegrations: z.boolean().optional().default(true).describe("Detect integrations from K8s secrets (default: true)"),
    },
    async (args) => {
      return executeTool("discover_k8s_deployments", async () => {
        const result = await ctx.api.integrations.discoverK8sDeployments({
          linkToApplications: args.linkToApplications ?? true,
          syncIntegrations: args.syncIntegrations ?? true,
        });
        return {
          success: result.success,
          namespacesScanned: result.namespacesScanned,
          deploymentsDiscovered: result.deploymentsDiscovered,
          deploymentsCreated: result.deploymentsCreated,
          deploymentsUpdated: result.deploymentsUpdated,
          applicationsLinked: result.applicationsLinked,
          integrationsDetected: result.integrationsDetected,
          errors: result.errors,
          deployments: result.deployments.map((d: Record<string, unknown>) => ({
            namespace: d.namespace,
            name: d.name,
            status: d.status,
            application: d.applicationName,
            environment: d.environment,
            integrations: d.integrations,
          })),
        };
      });
    }
  );

  server.tool(
    "sync_k8s_integrations",
    "Sync integrations from Kubernetes secrets. Detects CLERK_, STRIPE_, TURSO_, NEON_, AWS_, etc. prefixes in K8s secrets and creates corresponding appIntegration entries linked to deployments.",
    {
      applicationId: z.string().optional().describe("Sync for a specific application ID (optional - syncs all if not provided)"),
    },
    async (args) => {
      return executeTool("sync_k8s_integrations", async () => {
        const result = await ctx.api.integrations.syncK8sIntegrations({ applicationId: args.applicationId });
        return {
          success: result.success,
          applicationsProcessed: result.applicationsProcessed,
          integrationsCreated: result.integrationsCreated,
          integrationsUpdated: result.integrationsUpdated,
          deploymentsLinked: result.deploymentsLinked,
          errors: result.errors,
          details: result.details.map(d => ({
            application: d.applicationName,
            namespace: d.namespace,
            environment: d.environment,
            integrations: d.integrations,
          })),
        };
      });
    }
  );

  server.tool(
    "get_app_integrations_by_environment",
    "Get all integrations for an application grouped by environment (production, staging, shared). Shows which integrations were detected from K8s secrets.",
    {
      applicationId: z.string().describe("Application ID (UUID)"),
    },
    async (args) => {
      return executeTool("get_app_integrations_by_environment", async () => {
        const result = await ctx.api.integrations.getAppIntegrationsByEnvironment(args.applicationId);
        
        const formatIntegrations = (integrations: typeof result.byEnvironment[string]) =>
          integrations.map(i => ({
            id: i.id,
            provider: i.provider,
            name: i.name,
            namespace: i.k8sNamespace,
            detectedFromK8s: i.detectedFromK8s,
            enabled: i.enabled,
          }));

        return {
          applicationId: result.applicationId,
          totalIntegrations: result.totalIntegrations,
          environments: result.environments,
          byEnvironment: Object.fromEntries(
            Object.entries(result.byEnvironment).map(([env, integrations]) => [
              env,
              formatIntegrations(integrations),
            ])
          ),
        };
      });
    }
  );

  server.tool(
    "setup_application_from_resources",
    "Create a new application and link discovered resources to it in one step. Combines create_application + link_resources.",
    {
      name: z.string().describe("Application name"),
      slug: z.string().describe("URL-friendly slug"),
      description: z.string().optional().describe("Application description"),
      repositoryUrl: z.string().optional().describe("Git repository URL"),
      localRepoPath: z.string().optional().describe("Local filesystem path to the repository"),
      resources: z.array(z.object({
        provider: z.string(),
        resourceId: z.string(),
      })).optional().describe("Resources to link immediately"),
    },
    async (args) => {
      return executeTool("setup_application_from_resources", async () => {
        const app = await ctx.api.applications.create({
          name: args.name,
          slug: args.slug,
          description: args.description,
          repositoryUrl: args.repositoryUrl,
        });

        if (args.localRepoPath) {
          await ctx.api.applications.update({
            id: app.id,
            localRepoPath: args.localRepoPath,
          });
        }

        let linkResult = { linked: 0, failed: 0, errors: [] as string[] };
        if (args.resources && args.resources.length > 0) {
          const resources = args.resources.map(r => ({
            provider: r.provider!,
            resourceId: r.resourceId!,
          }));
          linkResult = await ctx.api.integrations.linkResources({
            applicationId: app.id,
            resources,
          });
        }

        return {
          application: {
            id: app.id,
            name: app.name,
            slug: app.slug,
            status: app.status,
          },
          resourcesLinked: linkResult.linked,
          resourcesFailed: linkResult.failed,
          errors: linkResult.errors,
        };
      });
    }
  );
}
