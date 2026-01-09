import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "../context.js";
import { executeTool, NotFoundError } from "../tool-wrapper.js";

export function registerAiDevTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    "list_ai_dev_sessions",
    "List AI development sessions (automated bug fixing)",
    {
      limit: z.number().optional().describe("Maximum sessions to return (default: 20)"),
      status: z.enum([
        "pending", "cloning", "analyzing", "fixing", "testing",
        "review", "approved", "merged", "failed", "cancelled"
      ]).optional().describe("Filter by status"),
      applicationId: z.string().optional().describe("Filter by application ID"),
    },
    async (args) => {
      return executeTool("list_ai_dev_sessions", async () => {
        const sessions = await ctx.api.aiDev.list({
          limit: args.limit,
          status: args.status,
          applicationId: args.applicationId,
        });
        return {
          count: sessions.length,
          sessions: sessions.map((s) => ({
            id: s.id,
            issueTitle: s.issueTitle,
            issueSource: s.issueSource,
            issueSeverity: s.issueSeverity,
            applicationName: s.applicationName,
            agentType: s.agentType,
            status: s.status,
            prUrl: s.prUrl,
            prStatus: s.prStatus,
            createdAt: s.createdAt,
            completedAt: s.completedAt,
          })),
        };
      });
    }
  );

  server.tool(
    "get_ai_dev_session",
    "Get detailed information about an AI dev session",
    {
      sessionId: z.string().describe("Session ID (UUID)"),
    },
    async (args) => {
      return executeTool("get_ai_dev_session", async () => {
        const session = await ctx.api.aiDev.byId(args.sessionId);
        if (!session) {
          throw new NotFoundError(`AI dev session not found: ${args.sessionId}`);
        }
        return session;
      });
    }
  );

  server.tool(
    "get_ai_dev_stats",
    "Get statistics for AI development sessions",
    {},
    async () => {
      return executeTool("get_ai_dev_stats", async () => {
        return await ctx.api.aiDev.stats();
      });
    }
  );

  server.tool(
    "list_active_ai_sessions",
    "List currently active AI dev sessions (pending, in progress, or review)",
    {},
    async () => {
      return executeTool("list_active_ai_sessions", async () => {
        const sessions = await ctx.api.aiDev.activeSessions();
        return {
          count: sessions.length,
          sessions: sessions.map((s) => ({
            id: s.id,
            issueTitle: s.issueTitle,
            issueSource: s.issueSource,
            applicationName: s.applicationName,
            agentType: s.agentType,
            status: s.status,
            createdAt: s.createdAt,
            startedAt: s.startedAt,
          })),
        };
      });
    }
  );

  server.tool(
    "get_ai_session_logs",
    "Get logs from an AI dev session",
    {
      sessionId: z.string().describe("Session ID (UUID)"),
      limit: z.number().optional().describe("Maximum logs to return (default: 100)"),
    },
    async (args) => {
      return executeTool("get_ai_session_logs", async () => {
        const logs = await ctx.api.aiDev.logs({
          sessionId: args.sessionId,
          limit: args.limit,
        });
        return {
          sessionId: args.sessionId,
          count: logs.length,
          logs: logs.map((l) => ({
            level: l.level,
            phase: l.phase,
            message: l.message,
            progress: l.progress,
            timestamp: l.timestamp,
          })),
        };
      });
    }
  );

  server.tool(
    "get_ai_session_comments",
    "Get review comments from an AI dev session",
    {
      sessionId: z.string().describe("Session ID (UUID)"),
    },
    async (args) => {
      return executeTool("get_ai_session_comments", async () => {
        const comments = await ctx.api.aiDev.comments(args.sessionId);
        return {
          sessionId: args.sessionId,
          count: comments.length,
          comments,
        };
      });
    }
  );

  server.tool(
    "create_ai_dev_session",
    "Create a new AI dev session to fix an issue",
    {
      issueSource: z.enum(["sentry", "posthog", "manual"]).describe("Source of the issue"),
      issueId: z.string().describe("Issue ID from the source system"),
      issueTitle: z.string().describe("Issue title/description"),
      issueUrl: z.string().optional().describe("URL to the issue"),
      issueSeverity: z.enum(["fatal", "error", "warning"]).optional().describe("Issue severity"),
      applicationId: z.string().optional().describe("Application ID (UUID)"),
      applicationName: z.string().optional().describe("Application name"),
      repositoryUrl: z.string().describe("Git repository URL"),
      branch: z.string().optional().describe("Branch to work from (default: main)"),
      agentType: z.enum(["claude", "kiro", "codex", "opencode", "cursor"]).optional()
        .describe("AI agent to use (default: claude)"),
    },
    async (args) => {
      return executeTool("create_ai_dev_session", async () => {
        const session = await ctx.api.aiDev.create({
          issueSource: args.issueSource,
          issueId: args.issueId,
          issueTitle: args.issueTitle,
          issueUrl: args.issueUrl,
          issueSeverity: args.issueSeverity,
          applicationId: args.applicationId,
          applicationName: args.applicationName,
          repositoryUrl: args.repositoryUrl,
          branch: args.branch,
          agentType: args.agentType,
        });
        return {
          id: session.id,
          status: session.status,
          message: "AI dev session created. The agent will begin working on the issue.",
        };
      });
    }
  );

  server.tool(
    "approve_ai_dev_session",
    "Approve an AI dev session's proposed fix",
    {
      sessionId: z.string().describe("Session ID to approve"),
    },
    async (args) => {
      return executeTool("approve_ai_dev_session", async () => {
        const session = await ctx.api.aiDev.approve(args.sessionId);
        return {
          id: session.id,
          status: session.status,
          message: "Session approved. The fix will be merged.",
        };
      });
    }
  );

  server.tool(
    "reject_ai_dev_session",
    "Reject an AI dev session's proposed fix",
    {
      sessionId: z.string().describe("Session ID to reject"),
      reason: z.string().describe("Reason for rejection"),
    },
    async (args) => {
      return executeTool("reject_ai_dev_session", async () => {
        const session = await ctx.api.aiDev.reject({
          id: args.sessionId,
          reason: args.reason,
        });
        return {
          id: session.id,
          status: session.status,
          message: "Session rejected.",
        };
      });
    }
  );

  server.tool(
    "cancel_ai_dev_session",
    "Cancel a running AI dev session",
    {
      sessionId: z.string().describe("Session ID to cancel"),
    },
    async (args) => {
      return executeTool("cancel_ai_dev_session", async () => {
        const session = await ctx.api.aiDev.cancel(args.sessionId);
        return {
          id: session.id,
          status: session.status,
          message: "Session cancelled.",
        };
      });
    }
  );
}
