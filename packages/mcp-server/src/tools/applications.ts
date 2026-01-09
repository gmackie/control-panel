import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "../context.js";
import { executeTool, NotFoundError } from "../tool-wrapper.js";

export function registerApplicationsTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    "list_applications",
    "List all applications with their status and basic metadata",
    {},
    async () => {
      return executeTool("list_applications", async () => {
        const apps = await ctx.api.applications.list();
        return {
          count: apps.length,
          applications: apps.map((app) => ({
            id: app.id,
            name: app.name,
            slug: app.slug,
            status: app.status,
            description: app.description,
            repositoryUrl: app.repositoryUrl,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
          })),
        };
      });
    }
  );

  server.tool(
    "list_applications_with_health",
    "List all applications with their health status and alert counts",
    {},
    async () => {
      return executeTool("list_applications_with_health", async () => {
        const apps = await ctx.api.applications.listWithHealth();
        return {
          count: apps.length,
          applications: apps.map((app) => ({
            id: app.id,
            name: app.name,
            slug: app.slug,
            status: app.status,
            alertCounts: app.alertCounts,
            latestAlert: app.latestAlert,
            lastActivity: app.lastActivity,
          })),
        };
      });
    }
  );

  server.tool(
    "get_application",
    "Get detailed information about a specific application by ID",
    {
      id: z.string().describe("Application ID"),
    },
    async (args) => {
      return executeTool("get_application", async () => {
        const app = await ctx.api.applications.byId(args.id);
        if (!app) {
          throw new NotFoundError(`Application not found: ${args.id}`);
        }
        return app;
      });
    }
  );

  server.tool(
    "get_application_by_slug",
    "Get an application by its URL-friendly slug",
    {
      slug: z.string().describe("Application slug (e.g., 'my-saas-app')"),
    },
    async (args) => {
      return executeTool("get_application_by_slug", async () => {
        const app = await ctx.api.applications.bySlug(args.slug);
        if (!app) {
          throw new NotFoundError(`Application not found with slug: ${args.slug}`);
        }
        return app;
      });
    }
  );

  server.tool(
    "create_application",
    "Create a new application",
    {
      name: z.string().describe("Application name"),
      slug: z.string().describe("URL-friendly slug"),
      description: z.string().optional().describe("Application description"),
      repositoryUrl: z.string().optional().describe("Git repository URL"),
    },
    async (args) => {
      return executeTool("create_application", async () => {
        const app = await ctx.api.applications.create({
          name: args.name,
          slug: args.slug,
          description: args.description,
          repositoryUrl: args.repositoryUrl,
        });
        return {
          id: app.id,
          name: app.name,
          slug: app.slug,
          status: app.status,
          createdAt: app.createdAt,
        };
      });
    }
  );
}
