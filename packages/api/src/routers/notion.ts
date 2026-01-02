import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { 
  notionConfigs,
  notionTaskLinks,
  notionSyncLogs,
  applications,
  aiDevSessions,
  desc, 
  eq, 
  and,
  inArray,
} from "@repo/db";
import { TRPCError } from "@trpc/server";

const taskStatusEnum = z.enum(["not_started", "in_progress", "done", "blocked", "cancelled"]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const syncStatusEnum = z.enum(["success", "failed", "partial"]);
const syncTypeEnum = z.enum(["full", "incremental", "webhook"]);

export const notionRouter = router({
  configs: router({
    list: publicProcedure
      .input(z.object({
        applicationId: z.string().uuid().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const conditions = [];
        if (input?.applicationId) {
          conditions.push(eq(notionConfigs.applicationId, input.applicationId));
        }

        const results = await ctx.db
          .select()
          .from(notionConfigs)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(notionConfigs.createdAt));

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
          .from(notionConfigs)
          .where(eq(notionConfigs.id, input))
          .limit(1);

        const config = result[0];
        if (!config) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Notion config not found" });
        }

        return config;
      }),

    byApplication: publicProcedure
      .input(z.string().uuid())
      .query(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const result = await ctx.db
          .select()
          .from(notionConfigs)
          .where(eq(notionConfigs.applicationId, input))
          .limit(1);

        return result[0] ?? null;
      }),

    create: protectedProcedure
      .input(z.object({
        applicationId: z.string().uuid(),
        notionDatabaseId: z.string(),
        notionDatabaseName: z.string(),
        notionDatabaseUrl: z.string().url().optional(),
        syncEnabled: z.boolean().default(true),
        syncFrequencyMinutes: z.number().min(5).max(1440).default(15),
        propertyMappings: z.record(z.string()).optional(),
        webhookEnabled: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const app = await ctx.db
          .select()
          .from(applications)
          .where(eq(applications.id, input.applicationId))
          .limit(1);

        if (!app[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }

        const existing = await ctx.db
          .select()
          .from(notionConfigs)
          .where(eq(notionConfigs.applicationId, input.applicationId))
          .limit(1);

        if (existing[0]) {
          throw new TRPCError({ 
            code: "CONFLICT", 
            message: "Notion config already exists for this application" 
          });
        }

        const now = new Date();
        const result = await ctx.db.insert(notionConfigs).values({
          applicationId: input.applicationId,
          notionDatabaseId: input.notionDatabaseId,
          notionDatabaseName: input.notionDatabaseName,
          notionDatabaseUrl: input.notionDatabaseUrl,
          syncEnabled: input.syncEnabled,
          syncFrequencyMinutes: input.syncFrequencyMinutes,
          propertyMappings: input.propertyMappings ? JSON.stringify(input.propertyMappings) : null,
          webhookEnabled: input.webhookEnabled,
          createdAt: now,
          updatedAt: now,
        }).returning();

        return result[0];
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        notionDatabaseId: z.string().optional(),
        notionDatabaseName: z.string().optional(),
        notionDatabaseUrl: z.string().url().optional(),
        syncEnabled: z.boolean().optional(),
        syncFrequencyMinutes: z.number().min(5).max(1440).optional(),
        propertyMappings: z.record(z.string()).optional(),
        webhookEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const { id, propertyMappings, ...rest } = input;
        const updateData: Record<string, unknown> = {
          ...rest,
          updatedAt: new Date(),
        };

        if (propertyMappings !== undefined) {
          updateData.propertyMappings = JSON.stringify(propertyMappings);
        }

        const result = await ctx.db
          .update(notionConfigs)
          .set(updateData)
          .where(eq(notionConfigs.id, id))
          .returning();

        if (!result[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Notion config not found" });
        }

        return result[0];
      }),

    delete: protectedProcedure
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const result = await ctx.db
          .delete(notionConfigs)
          .where(eq(notionConfigs.id, input))
          .returning();

        if (!result[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Notion config not found" });
        }

        return { success: true };
      }),

    updateSyncStatus: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: syncStatusEnum,
        error: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const now = new Date();
        const result = await ctx.db
          .update(notionConfigs)
          .set({
            lastSyncAt: now,
            lastSyncStatus: input.status,
            lastSyncError: input.error,
            updatedAt: now,
          })
          .where(eq(notionConfigs.id, input.id))
          .returning();

        return result[0];
      }),
  }),

  tasks: router({
    list: publicProcedure
      .input(z.object({
        applicationId: z.string().uuid().optional(),
        status: taskStatusEnum.optional(),
        hasAiSession: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const conditions = [];
        if (input?.applicationId) {
          conditions.push(eq(notionTaskLinks.applicationId, input.applicationId));
        }
        if (input?.status) {
          conditions.push(eq(notionTaskLinks.status, input.status));
        }

        const results = await ctx.db
          .select()
          .from(notionTaskLinks)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(notionTaskLinks.updatedAt))
          .limit(input?.limit ?? 50);

        if (input?.hasAiSession !== undefined) {
          return results.filter(t => 
            input.hasAiSession 
              ? t.aiSessionId !== null 
              : t.aiSessionId === null
          );
        }

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
          .from(notionTaskLinks)
          .where(eq(notionTaskLinks.id, input))
          .limit(1);

        const task = result[0];
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Notion task not found" });
        }

        return task;
      }),

    byNotionPageId: publicProcedure
      .input(z.string())
      .query(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const result = await ctx.db
          .select()
          .from(notionTaskLinks)
          .where(eq(notionTaskLinks.notionPageId, input))
          .limit(1);

        return result[0] ?? null;
      }),

    upsert: protectedProcedure
      .input(z.object({
        notionPageId: z.string(),
        notionDatabaseId: z.string(),
        applicationId: z.string().uuid().optional(),
        title: z.string(),
        status: taskStatusEnum.default("not_started"),
        priority: priorityEnum.optional(),
        dueDate: z.string().datetime().optional(),
        assignee: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notionUrl: z.string().url(),
        notionCreatedAt: z.string().datetime().optional(),
        notionUpdatedAt: z.string().datetime().optional(),
        rawProperties: z.record(z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const existing = await ctx.db
          .select()
          .from(notionTaskLinks)
          .where(eq(notionTaskLinks.notionPageId, input.notionPageId))
          .limit(1);

        const now = new Date();
        const data = {
          notionPageId: input.notionPageId,
          notionDatabaseId: input.notionDatabaseId,
          applicationId: input.applicationId,
          title: input.title,
          status: input.status,
          priority: input.priority,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          assignee: input.assignee,
          tags: input.tags ? JSON.stringify(input.tags) : null,
          notionUrl: input.notionUrl,
          notionCreatedAt: input.notionCreatedAt ? new Date(input.notionCreatedAt) : null,
          notionUpdatedAt: input.notionUpdatedAt ? new Date(input.notionUpdatedAt) : null,
          rawProperties: input.rawProperties ? JSON.stringify(input.rawProperties) : null,
          lastSyncAt: now,
          updatedAt: now,
        };

        if (existing[0]) {
          const result = await ctx.db
            .update(notionTaskLinks)
            .set(data)
            .where(eq(notionTaskLinks.notionPageId, input.notionPageId))
            .returning();
          return result[0];
        }

        const result = await ctx.db.insert(notionTaskLinks).values({
          ...data,
          createdAt: now,
        }).returning();

        return result[0];
      }),

    linkToAiSession: protectedProcedure
      .input(z.object({
        taskId: z.string().uuid(),
        aiSessionId: z.string().uuid(),
        gitBranch: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const session = await ctx.db
          .select()
          .from(aiDevSessions)
          .where(eq(aiDevSessions.id, input.aiSessionId))
          .limit(1);

        if (!session[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "AI session not found" });
        }

        const now = new Date();
        const result = await ctx.db
          .update(notionTaskLinks)
          .set({
            aiSessionId: input.aiSessionId,
            gitBranch: input.gitBranch,
            status: "in_progress",
            updatedAt: now,
          })
          .where(eq(notionTaskLinks.id, input.taskId))
          .returning();

        if (!result[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
        }

        return result[0];
      }),

    linkToPR: protectedProcedure
      .input(z.object({
        taskId: z.string().uuid(),
        prNumber: z.number(),
        prUrl: z.string().url(),
        prStatus: z.enum(["open", "merged", "closed"]).default("open"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const now = new Date();
        const result = await ctx.db
          .update(notionTaskLinks)
          .set({
            prNumber: input.prNumber,
            prUrl: input.prUrl,
            prStatus: input.prStatus,
            updatedAt: now,
          })
          .where(eq(notionTaskLinks.id, input.taskId))
          .returning();

        if (!result[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
        }

        return result[0];
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        taskId: z.string().uuid(),
        status: taskStatusEnum,
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const result = await ctx.db
          .update(notionTaskLinks)
          .set({
            status: input.status,
            updatedAt: new Date(),
          })
          .where(eq(notionTaskLinks.id, input.taskId))
          .returning();

        if (!result[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
        }

        return result[0];
      }),

    delete: protectedProcedure
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const result = await ctx.db
          .delete(notionTaskLinks)
          .where(eq(notionTaskLinks.id, input))
          .returning();

        if (!result[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
        }

        return { success: true };
      }),
  }),

  syncLogs: router({
    list: publicProcedure
      .input(z.object({
        configId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const results = await ctx.db
          .select()
          .from(notionSyncLogs)
          .where(eq(notionSyncLogs.configId, input.configId))
          .orderBy(desc(notionSyncLogs.startedAt))
          .limit(input.limit);

        return results;
      }),

    create: protectedProcedure
      .input(z.object({
        configId: z.string().uuid(),
        syncType: syncTypeEnum,
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const result = await ctx.db.insert(notionSyncLogs).values({
          configId: input.configId,
          syncType: input.syncType,
          status: "started",
          startedAt: new Date(),
        }).returning();

        return result[0];
      }),

    complete: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(["success", "failed", "partial"]),
        tasksCreated: z.number().default(0),
        tasksUpdated: z.number().default(0),
        tasksDeleted: z.number().default(0),
        errorMessage: z.string().optional(),
        errorDetails: z.record(z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const log = await ctx.db
          .select()
          .from(notionSyncLogs)
          .where(eq(notionSyncLogs.id, input.id))
          .limit(1);

        if (!log[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sync log not found" });
        }

        const now = new Date();
        const durationMs = now.getTime() - new Date(log[0].startedAt).getTime();

        const result = await ctx.db
          .update(notionSyncLogs)
          .set({
            status: input.status,
            tasksCreated: input.tasksCreated,
            tasksUpdated: input.tasksUpdated,
            tasksDeleted: input.tasksDeleted,
            errorMessage: input.errorMessage,
            errorDetails: input.errorDetails ? JSON.stringify(input.errorDetails) : null,
            completedAt: now,
            durationMs,
          })
          .where(eq(notionSyncLogs.id, input.id))
          .returning();

        return result[0];
      }),
  }),

  stats: publicProcedure
    .input(z.object({
      applicationId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const conditions = [];
      if (input?.applicationId) {
        conditions.push(eq(notionTaskLinks.applicationId, input.applicationId));
      }

      const allTasks = await ctx.db
        .select()
        .from(notionTaskLinks)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const byStatus = {
        not_started: allTasks.filter(t => t.status === "not_started").length,
        in_progress: allTasks.filter(t => t.status === "in_progress").length,
        done: allTasks.filter(t => t.status === "done").length,
        blocked: allTasks.filter(t => t.status === "blocked").length,
        cancelled: allTasks.filter(t => t.status === "cancelled").length,
      };

      const withAiSession = allTasks.filter(t => t.aiSessionId !== null).length;
      const withPR = allTasks.filter(t => t.prNumber !== null).length;

      return {
        total: allTasks.length,
        byStatus,
        withAiSession,
        withPR,
        completionRate: allTasks.length > 0 
          ? Math.round((byStatus.done / allTasks.length) * 100) 
          : 0,
      };
    }),
});
