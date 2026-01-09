import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "../context.js";
import { executeTool, NotFoundError } from "../tool-wrapper.js";

export function registerMonitoringTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    "get_health_summary",
    "Get overall system health summary including services, alerts, and metrics",
    {},
    async () => {
      return executeTool("get_health_summary", async () => {
        return await ctx.api.monitoring.healthSummary();
      });
    }
  );

  server.tool(
    "list_alerts",
    "List alerts with optional filtering",
    {
      status: z.enum(["firing", "resolved", "acknowledged"]).optional().describe("Filter by status"),
      severity: z.enum(["critical", "warning", "info"]).optional().describe("Filter by severity"),
      limit: z.number().optional().describe("Maximum number of alerts to return"),
    },
    async (args) => {
      return executeTool("list_alerts", async () => {
        const alerts = await ctx.api.monitoring.alerts({
          status: args.status,
          severity: args.severity,
          limit: args.limit,
        });
        return {
          count: alerts.length,
          alerts,
        };
      });
    }
  );

  server.tool(
    "get_alert",
    "Get details of a specific alert",
    {
      alertId: z.string().describe("Alert ID"),
    },
    async (args) => {
      return executeTool("get_alert", async () => {
        const alert = await ctx.api.monitoring.alertById(args.alertId);
        if (!alert) {
          throw new NotFoundError(`Alert not found: ${args.alertId}`);
        }
        return alert;
      });
    }
  );

  server.tool(
    "get_alert_stats",
    "Get statistics about alerts",
    {},
    async () => {
      return executeTool("get_alert_stats", async () => {
        return await ctx.api.monitoring.alertStats();
      });
    }
  );

  server.tool(
    "acknowledge_alert",
    "Acknowledge an alert",
    {
      alertId: z.string().describe("Alert ID to acknowledge"),
      comment: z.string().optional().describe("Optional comment"),
    },
    async (args) => {
      return executeTool("acknowledge_alert", async () => {
        return await ctx.api.monitoring.acknowledgeAlert({
          alertId: args.alertId,
          comment: args.comment,
        });
      });
    }
  );

  server.tool(
    "get_metrics",
    "Get current system metrics",
    {},
    async () => {
      return executeTool("get_metrics", async () => {
        return await ctx.api.monitoring.metrics();
      });
    }
  );

  server.tool(
    "list_services",
    "List all services with their health status",
    {},
    async () => {
      return executeTool("list_services", async () => {
        const services = await ctx.api.monitoring.services();
        return {
          count: services.length,
          services,
        };
      });
    }
  );

  server.tool(
    "get_service_health",
    "Get health status of a specific service",
    {
      serviceName: z.string().describe("Service name"),
    },
    async (args) => {
      return executeTool("get_service_health", async () => {
        const service = await ctx.api.monitoring.serviceByName(args.serviceName);
        if (!service) {
          throw new NotFoundError(`Service not found: ${args.serviceName}`);
        }
        return service;
      });
    }
  );
}
