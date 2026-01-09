import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "../context.js";
import { executeTool, NotFoundError } from "../tool-wrapper.js";

export function registerActivityTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    "get_recent_activity",
    "Get recent activity events across all systems",
    {
      limit: z.number().optional().describe("Maximum events to return (default: 20)"),
    },
    async (args) => {
      return executeTool("get_recent_activity", async () => {
        const events = await ctx.api.activity.recent({
          limit: args.limit,
        });
        return {
          count: events.length,
          events: events.map((e) => ({
            id: e.id,
            type: e.type,
            severity: e.severity,
            title: e.title,
            description: e.description,
            source: e.source,
            appId: e.appId,
            timestamp: e.timestamp,
            links: e.links,
          })),
        };
      });
    }
  );

  server.tool(
    "get_activity_stats",
    "Get activity statistics",
    {},
    async () => {
      return executeTool("get_activity_stats", async () => {
        return await ctx.api.activity.stats();
      });
    }
  );

  server.tool(
    "list_notifications",
    "List notifications with optional filtering",
    {
      limit: z.number().optional().describe("Maximum notifications to return (default: 50)"),
      offset: z.number().optional().describe("Offset for pagination"),
      statuses: z.array(z.string()).optional().describe("Filter by status (e.g., ['new', 'seen'])"),
    },
    async (args) => {
      return executeTool("list_notifications", async () => {
        const response = await ctx.api.notifications.list({
          limit: args.limit,
          offset: args.offset,
          statuses: args.statuses,
        });
        return {
          count: response.notifications.length,
          total: response.total,
          hasMore: response.hasMore,
          notifications: response.notifications.map((n) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            category: n.category,
            severity: n.severity,
            status: n.status,
            appId: n.appId,
            source: n.source,
            actionUrl: n.actionUrl,
            createdAt: n.createdAt,
          })),
        };
      });
    }
  );

  server.tool(
    "get_notification",
    "Get a specific notification by ID",
    {
      notificationId: z.string().describe("Notification ID"),
    },
    async (args) => {
      return executeTool("get_notification", async () => {
        const notification = await ctx.api.notifications.byId(args.notificationId);
        if (!notification) {
          throw new NotFoundError(`Notification not found: ${args.notificationId}`);
        }
        return notification;
      });
    }
  );

  server.tool(
    "get_unread_notification_count",
    "Get the count of unread notifications",
    {},
    async () => {
      return executeTool("get_unread_notification_count", async () => {
        const count = await ctx.api.notifications.unreadCount();
        return { unreadCount: count };
      });
    }
  );

  server.tool(
    "get_notification_stats",
    "Get notification statistics",
    {},
    async () => {
      return executeTool("get_notification_stats", async () => {
        return await ctx.api.notifications.stats();
      });
    }
  );

  server.tool(
    "mark_notification_as_read",
    "Mark a notification as read",
    {
      notificationId: z.string().describe("Notification ID to mark as read"),
    },
    async (args) => {
      return executeTool("mark_notification_as_read", async () => {
        return await ctx.api.notifications.markAsRead(args.notificationId);
      });
    }
  );

  server.tool(
    "mark_all_notifications_as_read",
    "Mark all notifications as read",
    {},
    async () => {
      return executeTool("mark_all_notifications_as_read", async () => {
        return await ctx.api.notifications.markAllAsRead();
      });
    }
  );
}
