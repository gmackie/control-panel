import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { 
  aiDevSessions, 
  aiDevSessionLogs, 
  aiDevSessionComments,
  desc, 
  eq, 
  and, 
  sql,
  inArray,
} from "@repo/db";
import { TRPCError } from "@trpc/server";

const sessionStatusEnum = z.enum([
  "pending", "cloning", "analyzing", "fixing", "testing", 
  "review", "approved", "merged", "failed", "cancelled"
]);

const issueSourceEnum = z.enum(["sentry", "posthog", "manual"]);
const agentTypeEnum = z.enum(["claude", "kiro", "codex", "opencode", "cursor"]);

export const aiDevRouter = router({
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      status: sessionStatusEnum.optional(),
      applicationId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const conditions = [];
      if (input?.status) {
        conditions.push(eq(aiDevSessions.status, input.status));
      }
      if (input?.applicationId) {
        conditions.push(eq(aiDevSessions.applicationId, input.applicationId));
      }

      const results = await ctx.db
        .select()
        .from(aiDevSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiDevSessions.createdAt))
        .limit(input?.limit ?? 20);

      return results;
    }),

  byId: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .select()
        .from(aiDevSessions)
        .where(eq(aiDevSessions.id, input))
        .limit(1);

      const session = result[0];
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "AI dev session not found" });
      }

      return session;
    }),

  create: protectedProcedure
    .input(z.object({
      issueSource: issueSourceEnum,
      issueId: z.string(),
      issueTitle: z.string(),
      issueUrl: z.string().url().optional(),
      issueSeverity: z.enum(["fatal", "error", "warning"]).optional(),
      applicationId: z.string().uuid().optional(),
      applicationName: z.string().optional(),
      repositoryUrl: z.string().url(),
      branch: z.string().default("main"),
      agentType: agentTypeEnum.default("claude"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();

      const result = await ctx.db.insert(aiDevSessions).values({
        issueSource: input.issueSource,
        issueId: input.issueId,
        issueTitle: input.issueTitle,
        issueUrl: input.issueUrl,
        issueSeverity: input.issueSeverity,
        applicationId: input.applicationId,
        applicationName: input.applicationName,
        repositoryUrl: input.repositoryUrl,
        branch: input.branch,
        agentType: input.agentType,
        status: "pending",
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      }).returning();

      return result[0];
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: sessionStatusEnum,
      worktreeId: z.string().optional(),
      agentInstanceId: z.string().optional(),
      analysisResult: z.string().optional(),
      proposedFix: z.string().optional(),
      filesChanged: z.array(z.string()).optional(),
      prNumber: z.number().optional(),
      prUrl: z.string().url().optional(),
      prTitle: z.string().optional(),
      prStatus: z.enum(["open", "merged", "closed"]).optional(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const { id, status, filesChanged, ...rest } = input;
      const now = new Date();

      const updateData: Record<string, unknown> = {
        status,
        updatedAt: now,
        ...rest,
      };

      if (filesChanged) {
        updateData.filesChanged = JSON.stringify(filesChanged);
      }

      if (status === "analyzing" || status === "cloning") {
        updateData.startedAt = now;
      }

      if (["merged", "failed", "cancelled"].includes(status)) {
        updateData.completedAt = now;
      }

      const result = await ctx.db
        .update(aiDevSessions)
        .set(updateData)
        .where(eq(aiDevSessions.id, id))
        .returning();

      return result[0];
    }),

  approve: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();

      const result = await ctx.db
        .update(aiDevSessions)
        .set({
          status: "approved",
          approvedBy: ctx.userId,
          approvedAt: now,
          updatedAt: now,
        })
        .where(eq(aiDevSessions.id, input.id))
        .returning();

      return result[0];
    }),

  reject: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();

      const result = await ctx.db
        .update(aiDevSessions)
        .set({
          status: "cancelled",
          rejectionReason: input.reason,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(aiDevSessions.id, input.id))
        .returning();

      return result[0];
    }),

  cancel: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();

      const result = await ctx.db
        .update(aiDevSessions)
        .set({
          status: "cancelled",
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(aiDevSessions.id, input))
        .returning();

      return result[0];
    }),

  logs: publicProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const results = await ctx.db
        .select()
        .from(aiDevSessionLogs)
        .where(eq(aiDevSessionLogs.sessionId, input.sessionId))
        .orderBy(desc(aiDevSessionLogs.timestamp))
        .limit(input.limit);

      return results;
    }),

  addLog: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      level: z.enum(["info", "warn", "error", "debug"]),
      phase: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
      progress: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db.insert(aiDevSessionLogs).values({
        sessionId: input.sessionId,
        level: input.level,
        phase: input.phase,
        message: input.message,
        details: input.details ? JSON.stringify(input.details) : null,
        progress: input.progress,
        timestamp: new Date(),
      }).returning();

      return result[0];
    }),

  comments: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const results = await ctx.db
        .select()
        .from(aiDevSessionComments)
        .where(eq(aiDevSessionComments.sessionId, input))
        .orderBy(aiDevSessionComments.createdAt);

      return results;
    }),

  addComment: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      content: z.string(),
      filePath: z.string().optional(),
      lineNumber: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db.insert(aiDevSessionComments).values({
        sessionId: input.sessionId,
        authorType: "user",
        authorId: ctx.userId,
        content: input.content,
        filePath: input.filePath,
        lineNumber: input.lineNumber,
        createdAt: new Date(),
      }).returning();

      return result[0];
    }),

  stats: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const allSessions = await ctx.db
        .select()
        .from(aiDevSessions);

      const pending = allSessions.filter(s => 
        ["pending", "cloning", "analyzing", "fixing", "testing"].includes(s.status)
      );
      const inReview = allSessions.filter(s => s.status === "review");
      const completed = allSessions.filter(s => 
        ["approved", "merged"].includes(s.status)
      );
      const failed = allSessions.filter(s => 
        ["failed", "cancelled"].includes(s.status)
      );

      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentSessions = allSessions.filter(s => 
        new Date(s.createdAt) > last7Days
      );

      return {
        total: allSessions.length,
        pending: pending.length,
        inReview: inReview.length,
        completed: completed.length,
        failed: failed.length,
        successRate: allSessions.length > 0 
          ? Math.round((completed.length / allSessions.length) * 100) 
          : 0,
        last7Days: recentSessions.length,
      };
    }),

  activeSessions: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const activeStatuses = ["pending", "cloning", "analyzing", "fixing", "testing", "review"];

      const results = await ctx.db
        .select()
        .from(aiDevSessions)
        .where(inArray(aiDevSessions.status, activeStatuses))
        .orderBy(desc(aiDevSessions.createdAt));

      return results;
    }),
});
