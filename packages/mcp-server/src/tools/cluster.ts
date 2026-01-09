import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "../context.js";
import { executeTool, NotFoundError } from "../tool-wrapper.js";

export function registerClusterTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    "list_clusters",
    "List all Kubernetes clusters with status and basic info",
    {},
    async () => {
      return executeTool("list_clusters", async () => {
        const clusters = await ctx.api.clusters.list();
        return {
          count: clusters.length,
          clusters: clusters.map((c) => ({
            id: c.id,
            name: c.name,
            provider: c.provider,
            region: c.region,
            version: c.version,
            status: c.status,
            nodeCount: c.nodeCount,
            createdAt: c.createdAt,
          })),
        };
      });
    }
  );

  server.tool(
    "get_cluster",
    "Get detailed information about a specific cluster",
    {
      clusterId: z.string().describe("Cluster ID"),
    },
    async (args) => {
      return executeTool("get_cluster", async () => {
        const cluster = await ctx.api.clusters.byId(args.clusterId);
        if (!cluster) {
          throw new NotFoundError(`Cluster not found: ${args.clusterId}`);
        }
        return cluster;
      });
    }
  );

  server.tool(
    "list_cluster_nodes",
    "List all nodes in a cluster with their status",
    {
      clusterId: z.string().describe("Cluster ID"),
    },
    async (args) => {
      return executeTool("list_cluster_nodes", async () => {
        const nodes = await ctx.api.clusters.nodes(args.clusterId);
        return {
          clusterId: args.clusterId,
          count: nodes.length,
          nodes: nodes.map((n) => ({
            id: n.id,
            name: n.name,
            status: n.status,
            role: n.role,
            ip: n.ip,
            cpu: n.cpu,
            memory: n.memory,
            pods: n.pods,
            createdAt: n.createdAt,
          })),
        };
      });
    }
  );

  server.tool(
    "get_cluster_health",
    "Get overall health status of all clusters",
    {},
    async () => {
      return executeTool("get_cluster_health", async () => {
        return await ctx.api.clusters.health();
      });
    }
  );

  server.tool(
    "get_cluster_costs",
    "Get cost breakdown for clusters",
    {
      clusterId: z.string().optional().describe("Filter by cluster ID"),
      period: z.enum(["day", "week", "month"]).optional().describe("Cost period (default: month)"),
    },
    async (args) => {
      return executeTool("get_cluster_costs", async () => {
        return await ctx.api.clusters.costs({
          clusterId: args.clusterId,
          period: args.period,
        });
      });
    }
  );

  server.tool(
    "scale_cluster",
    "Scale a cluster to a target node count",
    {
      clusterId: z.string().describe("Cluster ID"),
      nodeCount: z.number().min(1).describe("Target number of nodes"),
    },
    async (args) => {
      return executeTool("scale_cluster", async () => {
        return await ctx.api.clusters.scale({
          clusterId: args.clusterId,
          nodeCount: args.nodeCount,
        });
      });
    }
  );

  server.tool(
    "list_vps_servers",
    "List all Hetzner VPS servers",
    {},
    async () => {
      return executeTool("list_vps_servers", async () => {
        const servers = await ctx.api.infrastructure.servers();
        return {
          count: servers.length,
          servers: servers.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            type: s.type,
            datacenter: s.datacenter,
            publicIp: s.publicIp,
            privateIp: s.privateIp,
            cpu: s.cpu,
            memory: s.memory,
            disk: s.disk,
            monthlyPrice: s.monthlyPrice,
            createdAt: s.createdAt,
          })),
        };
      });
    }
  );

  server.tool(
    "get_vps_server",
    "Get detailed information about a specific VPS server",
    {
      serverId: z.string().describe("Server ID"),
    },
    async (args) => {
      return executeTool("get_vps_server", async () => {
        const server = await ctx.api.infrastructure.server(args.serverId);
        if (!server) {
          throw new NotFoundError(`Server not found: ${args.serverId}`);
        }
        return server;
      });
    }
  );

  server.tool(
    "server_power_action",
    "Perform a power action on a VPS server",
    {
      serverId: z.string().describe("Server ID"),
      action: z.enum(["start", "stop", "reboot"]).describe("Power action"),
      confirm: z.string().describe("Confirmation string: '<action>:<serverId>'"),
    },
    async (args) => {
      return executeTool("server_power_action", async () => {
        const expectedConfirm = `${args.action}:${args.serverId}`;
        if (args.confirm !== expectedConfirm) {
          throw new Error(`Confirmation required. Please provide confirm: '${expectedConfirm}'`);
        }
        return await ctx.api.infrastructure.serverPower({
          serverId: args.serverId,
          action: args.action,
        });
      });
    }
  );
}
