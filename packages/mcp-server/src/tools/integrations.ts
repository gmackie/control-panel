import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "../context.js";
import { executeTool } from "../tool-wrapper.js";

export function registerIntegrationsTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    "get_control_panel_status",
    "Check the connection status to the control panel API",
    {},
    async () => {
      return executeTool("get_control_panel_status", async () => {
        const startTime = Date.now();
        const healthy = await ctx.api.healthCheck();
        return {
          connected: healthy,
          responseTimeMs: Date.now() - startTime,
          controlPanelUrl: ctx.config.controlPanelUrl,
        };
      });
    }
  );

  server.tool(
    "get_infrastructure_status",
    "Get status of all infrastructure services (Gitea, Harbor, Hetzner)",
    {},
    async () => {
      return executeTool("get_infrastructure_status", async () => {
        const health = await ctx.api.infrastructure.health();
        return {
          gitea: {
            status: health.gitea.status,
            repositoryCount: health.gitea.repositoryCount,
            lastSync: health.gitea.lastSync,
          },
          harbor: {
            status: health.harbor.status,
            imageCount: health.harbor.imageCount,
            storageUsedBytes: health.harbor.storageUsed,
            lastSync: health.harbor.lastSync,
          },
          hetzner: {
            status: health.hetzner.status,
            serverCount: health.hetzner.serverCount,
            runningServers: health.hetzner.runningServers,
            totalMonthlyCost: health.hetzner.totalMonthlyCost,
          },
        };
      });
    }
  );

  server.tool(
    "get_system_overview",
    "Get a comprehensive overview of the entire system",
    {},
    async () => {
      return executeTool("get_system_overview", async () => {
        const [health, apps, clusters, deploymentStats, alertStats] = await Promise.all([
          ctx.api.monitoring.healthSummary(),
          ctx.api.applications.list(),
          ctx.api.clusters.list(),
          ctx.api.deployments.stats({ period: "week" }),
          ctx.api.monitoring.alertStats(),
        ]);

        return {
          systemHealth: health.status,
          applications: {
            total: apps.length,
            byStatus: countByField(apps, "status"),
          },
          clusters: {
            total: clusters.length,
            healthy: clusters.filter((c) => c.status === "healthy").length,
            totalNodes: clusters.reduce((sum, c) => sum + c.nodeCount, 0),
          },
          deploymentsThisWeek: {
            total: deploymentStats.total,
            succeeded: deploymentStats.succeeded,
            failed: deploymentStats.failed,
            successRate: deploymentStats.successRate,
          },
          alerts: {
            critical: alertStats.bySeverity.critical,
            warning: alertStats.bySeverity.warning,
            firing: alertStats.firing,
          },
        };
      });
    }
  );
}

function countByField<T>(items: T[], field: keyof T): Record<string, number> {
  return items.reduce((acc, item) => {
    const value = String(item[field]);
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
