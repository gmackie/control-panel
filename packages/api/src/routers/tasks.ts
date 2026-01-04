/**
 * Tasks Router
 * 
 * tRPC procedures for unified task management.
 * Tasks are synced bidirectionally with GitHub, Gitea, Linear, and Notion.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { 
  tasks, 
  taskComments, 
  taskActivityLog,
  applications,
  desc, 
  eq, 
  and, 
  inArray,
  asc,
} from "@repo/db";
import { TRPCError } from "@trpc/server";

// Zod schemas for validation
const taskStatusSchema = z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']);
const taskPrioritySchema = z.enum(['urgent', 'high', 'medium', 'low']);

const createTaskSchema = z.object({
  applicationId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: taskStatusSchema.optional().default('backlog'),
  priority: taskPrioritySchema.optional(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.date().optional(),
  releaseId: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional().nullable(),
  assignee: z.string().optional().nullable(),
  labels: z.array(z.string()).optional(),
  dueDate: z.date().optional().nullable(),
  releaseId: z.string().uuid().optional().nullable(),
});

const listTasksSchema = z.object({
  applicationId: z.string().uuid().optional(),
  status: z.array(taskStatusSchema).optional(),
  priority: z.array(taskPrioritySchema).optional(),
  assignee: z.string().optional(),
  releaseId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().min(1),
});

export const tasksRouter = router({
  /**
   * List tasks with filtering and pagination
   */
  list: publicProcedure
    .input(listTasksSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      let query = ctx.db.select().from(tasks);
      const conditions = [];

      if (input.applicationId) {
        conditions.push(eq(tasks.applicationId, input.applicationId));
      }
      if (input.status && input.status.length > 0) {
        conditions.push(inArray(tasks.status, input.status));
      }
      if (input.priority && input.priority.length > 0) {
        conditions.push(inArray(tasks.priority, input.priority));
      }
      if (input.assignee) {
        conditions.push(eq(tasks.assignee, input.assignee));
      }
      if (input.releaseId) {
        conditions.push(eq(tasks.releaseId, input.releaseId));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const results = await query
        .orderBy(desc(tasks.updatedAt))
        .limit(input.limit + 1);

      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, -1) : results;

      return {
        items: items.map(task => ({
          ...task,
          labels: task.labels ? JSON.parse(task.labels) : [],
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  /**
   * Get a single task by ID
   */
  byId: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [task] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input));

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Get comments
      const comments = await ctx.db
        .select()
        .from(taskComments)
        .where(eq(taskComments.taskId, input))
        .orderBy(asc(taskComments.createdAt));

      // Get activity log
      const activity = await ctx.db
        .select()
        .from(taskActivityLog)
        .where(eq(taskActivityLog.taskId, input))
        .orderBy(desc(taskActivityLog.createdAt))
        .limit(50);

      return {
        ...task,
        labels: task.labels ? JSON.parse(task.labels) : [],
        comments,
        activity,
      };
    }),

  /**
   * Get tasks grouped by status (for Kanban board)
   */
  byStatus: publicProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const allTasks = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.applicationId, input.applicationId))
        .orderBy(desc(tasks.updatedAt));

      const grouped: Record<string, typeof allTasks> = {
        backlog: [],
        todo: [],
        in_progress: [],
        in_review: [],
        done: [],
        cancelled: [],
      };

      for (const task of allTasks) {
        const status = task.status || 'backlog';
        if (grouped[status]) {
          grouped[status].push({
            ...task,
            labels: task.labels ? JSON.parse(task.labels) : [],
          } as typeof task);
        }
      }

      return grouped;
    }),

  /**
   * Create a new task
   */
  create: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verify application exists
      const [app] = await ctx.db
        .select()
        .from(applications)
        .where(eq(applications.id, input.applicationId));

      if (!app) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      const now = new Date();
      const [task] = await ctx.db
        .insert(tasks)
        .values({
          applicationId: input.applicationId,
          title: input.title,
          description: input.description || null,
          status: input.status,
          priority: input.priority || null,
          assignee: input.assignee || null,
          labels: input.labels ? JSON.stringify(input.labels) : null,
          dueDate: input.dueDate || null,
          releaseId: input.releaseId || null,
          syncStatus: 'local_only',
          sourceProvider: 'control_panel',
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!task) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create task" });
      }

      // Log activity
      await ctx.db.insert(taskActivityLog).values({
        taskId: task.id,
        action: 'created',
        actorId: ctx.userId,
        actorType: 'user',
        source: 'control_panel',
        createdAt: now,
      });

      return {
        ...task,
        labels: task.labels ? JSON.parse(task.labels) : [],
      };
    }),

  /**
   * Update a task
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateTaskSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get existing task
      const [existing] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      // Track changes for activity log
      const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

      if (input.data.title !== undefined) {
        updateData.title = input.data.title;
        changes.push({ field: 'title', oldValue: existing.title, newValue: input.data.title });
      }
      if (input.data.description !== undefined) {
        updateData.description = input.data.description;
      }
      if (input.data.status !== undefined) {
        updateData.status = input.data.status;
        changes.push({ field: 'status', oldValue: existing.status, newValue: input.data.status });
        
        // Set closedAt if moving to done/cancelled
        if (['done', 'cancelled'].includes(input.data.status)) {
          updateData.closedAt = now;
        } else if (existing.closedAt) {
          updateData.closedAt = null;
        }
      }
      if (input.data.priority !== undefined) {
        updateData.priority = input.data.priority;
        changes.push({ field: 'priority', oldValue: existing.priority, newValue: input.data.priority });
      }
      if (input.data.assignee !== undefined) {
        updateData.assignee = input.data.assignee;
        changes.push({ field: 'assignee', oldValue: existing.assignee, newValue: input.data.assignee });
      }
      if (input.data.labels !== undefined) {
        updateData.labels = JSON.stringify(input.data.labels);
      }
      if (input.data.dueDate !== undefined) {
        updateData.dueDate = input.data.dueDate;
      }
      if (input.data.releaseId !== undefined) {
        updateData.releaseId = input.data.releaseId;
      }

      // Mark for sync if was previously synced
      if (existing.syncStatus === 'synced') {
        updateData.syncStatus = 'pending_push';
      }

      const [task] = await ctx.db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, input.id))
        .returning();

      if (!task) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update task" });
      }

      // Log activity for each change
      for (const change of changes) {
        await ctx.db.insert(taskActivityLog).values({
          taskId: task.id,
          action: change.field === 'status' ? 'status_changed' : 'updated',
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          actorId: ctx.userId,
          actorType: 'user',
          source: 'control_panel',
          createdAt: now,
        });
      }

      return {
        ...task,
        labels: task.labels ? JSON.parse(task.labels) : [],
      };
    }),

  /**
   * Delete a task
   */
  delete: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [task] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input));

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Delete the task (cascades to comments and activity log)
      await ctx.db.delete(tasks).where(eq(tasks.id, input));

      return { success: true, id: input };
    }),

  /**
   * Bulk update task status (for drag-and-drop)
   */
  bulkUpdateStatus: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.string().uuid()),
      status: taskStatusSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();
      const updateData: Record<string, unknown> = {
        status: input.status,
        updatedAt: now,
      };

      // Set closedAt if moving to done/cancelled
      if (['done', 'cancelled'].includes(input.status)) {
        updateData.closedAt = now;
      }

      await ctx.db
        .update(tasks)
        .set(updateData)
        .where(inArray(tasks.id, input.taskIds));

      // Log activity for each task
      for (const taskId of input.taskIds) {
        await ctx.db.insert(taskActivityLog).values({
          taskId,
          action: 'status_changed',
          field: 'status',
          newValue: input.status,
          actorId: ctx.userId,
          actorType: 'user',
          source: 'control_panel',
          createdAt: now,
        });
      }

      return { success: true, updatedCount: input.taskIds.length };
    }),

  /**
   * Add a comment to a task
   */
  addComment: protectedProcedure
    .input(createCommentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verify task exists
      const [task] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.taskId));

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const now = new Date();
      const [comment] = await ctx.db
        .insert(taskComments)
        .values({
          taskId: input.taskId,
          body: input.body,
          authorId: ctx.userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Log activity
      await ctx.db.insert(taskActivityLog).values({
        taskId: input.taskId,
        action: 'commented',
        actorId: ctx.userId,
        actorType: 'user',
        source: 'control_panel',
        createdAt: now,
      });

      return comment;
    }),

  /**
   * Get task activity log
   */
  getActivity: publicProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      limit: z.number().min(1).max(100).optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const activity = await ctx.db
        .select()
        .from(taskActivityLog)
        .where(eq(taskActivityLog.taskId, input.taskId))
        .orderBy(desc(taskActivityLog.createdAt))
        .limit(input.limit);

      return activity;
    }),
});
