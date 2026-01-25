import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "../context.js";
import { executeTool, NotFoundError } from "../tool-wrapper.js";

export function registerCicdTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    "list_repositories",
    "List all Git repositories from Gitea",
    {
      limit: z.number().optional().describe("Maximum number of repos to return"),
      owner: z.string().optional().describe("Filter by owner"),
    },
    async (args) => {
      return executeTool("list_repositories", async () => {
        const repos = await ctx.api.infrastructure.repositories({
          limit: args.limit,
          owner: args.owner,
        });
        return {
          count: repos.length,
          repositories: repos.map((r) => ({
            id: r.id,
            name: r.name,
            fullName: r.fullName,
            description: r.description,
            url: r.url,
            defaultBranch: r.defaultBranch,
            stars: r.stars,
            forks: r.forks,
            openIssues: r.openIssues,
            lastCommit: r.lastCommit,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })),
        };
      });
    }
  );

  server.tool(
    "get_repository",
    "Get detailed information about a Git repository",
    {
      name: z.string().describe("Repository name (e.g., 'owner/repo' or just 'repo')"),
    },
    async (args) => {
      return executeTool("get_repository", async () => {
        const repo = await ctx.api.infrastructure.repository(args.name);
        if (!repo) {
          throw new NotFoundError(`Repository not found: ${args.name}`);
        }
        return repo;
      });
    }
  );

  server.tool(
    "list_container_images",
    "List container images from Harbor registry",
    {
      limit: z.number().optional().describe("Maximum number of images to return"),
      repository: z.string().optional().describe("Filter by repository name"),
    },
    async (args) => {
      return executeTool("list_container_images", async () => {
        const images = await ctx.api.infrastructure.images({
          limit: args.limit,
          repository: args.repository,
        });
        return {
          count: images.length,
          images: images.map((img) => ({
            id: img.id,
            name: img.name,
            repository: img.repository,
            tags: img.tags,
            size: img.size,
            digest: img.digest,
            pushedAt: img.pushedAt,
            pullCount: img.pullCount,
          })),
        };
      });
    }
  );

  server.tool(
    "get_container_image",
    "Get detailed information about a container image",
    {
      name: z.string().describe("Image name"),
    },
    async (args) => {
      return executeTool("get_container_image", async () => {
        const image = await ctx.api.infrastructure.image(args.name);
        if (!image) {
          throw new NotFoundError(`Image not found: ${args.name}`);
        }
        return image;
      });
    }
  );

  server.tool(
    "delete_image_tag",
    "Delete a tag from a container image",
    {
      repository: z.string().describe("Repository name"),
      tag: z.string().describe("Tag to delete"),
      confirm: z.string().describe("Confirmation string: 'delete:<tag>'"),
    },
    async (args) => {
      return executeTool("delete_image_tag", async () => {
        const expectedConfirm = `delete:${args.tag}`;
        if (args.confirm !== expectedConfirm) {
          throw new Error(`Confirmation required. Please provide confirm: '${expectedConfirm}'`);
        }
        return await ctx.api.infrastructure.deleteImageTag({
          repository: args.repository,
          tag: args.tag,
        });
      });
    }
  );

  server.tool(
    "get_infrastructure_health",
    "Get health status of all infrastructure components (Gitea, Harbor, Hetzner)",
    {},
    async () => {
      return executeTool("get_infrastructure_health", async () => {
        return await ctx.api.infrastructure.health();
      });
    }
  );

  server.tool(
    "list_deployments",
    "List deployments with optional filtering. When projectId is provided along with appId, fetches real deployments from the configured provider (Vercel, K8s, etc.).",
    {
      limit: z.number().optional().describe("Maximum number of deployments to return"),
      environment: z.enum(["development", "staging", "production"]).optional().describe("Filter by environment"),
      status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]).optional().describe("Filter by status"),
      appId: z.string().optional().describe("Filter by application ID"),
      projectId: z.string().optional().describe("Provider project ID (e.g., Vercel project ID) - enables provider-based deployment listing"),
    },
    async (args) => {
      return executeTool("list_deployments", async () => {
        const deployments = await ctx.api.deployments.list({
          limit: args.limit,
          environment: args.environment,
          status: args.status,
          appId: args.appId,
          projectId: args.projectId,
        });
        return {
          count: deployments.length,
          deployments,
        };
      });
    }
  );

  server.tool(
    "get_deployment",
    "Get details of a specific deployment. When appId is provided, fetches from the configured provider (Vercel, K8s, etc.).",
    {
      deploymentId: z.string().describe("Deployment ID"),
      appId: z.string().optional().describe("Application ID - enables provider-based deployment lookup"),
    },
    async (args) => {
      return executeTool("get_deployment", async () => {
        const deployment = await ctx.api.deployments.byId({
          deploymentId: args.deploymentId,
          appId: args.appId,
        });
        if (!deployment) {
          throw new NotFoundError(`Deployment not found: ${args.deploymentId}`);
        }
        return deployment;
      });
    }
  );

  server.tool(
    "get_deployment_stats",
    "Get deployment statistics",
    {
      period: z.enum(["day", "week", "month"]).optional().describe("Time period for stats"),
    },
    async (args) => {
      return executeTool("get_deployment_stats", async () => {
        return await ctx.api.deployments.stats({
          period: args.period,
        });
      });
    }
  );

  server.tool(
    "trigger_deployment",
    "Trigger a new deployment for an application. When projectId is provided, triggers deployment via the configured provider (Vercel, K8s, etc.).",
    {
      appId: z.string().describe("Application ID"),
      environment: z.enum(["development", "staging", "production"]).describe("Target environment"),
      imageTag: z.string().optional().describe("Specific image tag to deploy"),
      commitSha: z.string().optional().describe("Specific commit SHA to deploy"),
      projectId: z.string().optional().describe("Provider project ID (e.g., Vercel project ID) - enables provider-based deployment"),
    },
    async (args) => {
      return executeTool("trigger_deployment", async () => {
        return await ctx.api.deployments.trigger({
          appId: args.appId,
          environment: args.environment,
          imageTag: args.imageTag,
          commitSha: args.commitSha,
          projectId: args.projectId,
        });
      });
    }
  );

  server.tool(
    "rollback_deployment",
    "Rollback a deployment to a previous version. When appId and projectId are provided, performs rollback via the configured provider (Vercel, K8s, etc.).",
    {
      deploymentId: z.string().describe("Deployment ID to rollback from"),
      targetVersion: z.string().optional().describe("Specific version to rollback to"),
      appId: z.string().optional().describe("Application ID - enables provider-based rollback"),
      projectId: z.string().optional().describe("Provider project ID - enables provider-based rollback"),
    },
    async (args) => {
      return executeTool("rollback_deployment", async () => {
        return await ctx.api.deployments.rollback({
          deploymentId: args.deploymentId,
          targetVersion: args.targetVersion,
          appId: args.appId,
          projectId: args.projectId,
        });
      });
    }
  );

  server.tool(
    "cancel_deployment",
    "Cancel a running deployment. When appId is provided, cancels via the configured provider (Vercel, K8s, etc.).",
    {
      deploymentId: z.string().describe("Deployment ID to cancel"),
      appId: z.string().optional().describe("Application ID - enables provider-based cancellation"),
    },
    async (args) => {
      return executeTool("cancel_deployment", async () => {
        return await ctx.api.deployments.cancel({
          deploymentId: args.deploymentId,
          appId: args.appId,
        });
      });
    }
  );
}
