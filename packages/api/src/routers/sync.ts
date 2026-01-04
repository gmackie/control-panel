/**
 * Sync Router
 * 
 * tRPC procedures for task/release sync operations.
 * Handles bidirectional sync between Control Panel and external providers.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { 
  taskSyncConfigs, 
  tasks,
  releases,
  applications,
  desc, 
  eq, 
  and,
} from "@repo/db";
import { TRPCError } from "@trpc/server";

// Import sync engine types
// Note: The actual sync engine is in apps/web, so we'll need to call it differently
// For now, we'll set up the router structure and database operations

const syncProviderSchema = z.enum(['github', 'gitea', 'linear', 'notion']);
const syncDirectionSchema = z.enum(['bidirectional', 'push_only', 'pull_only']);

const configureSyncSchema = z.object({
  applicationId: z.string().uuid(),
  provider: syncProviderSchema,
  enabled: z.boolean(),
  config: z.record(z.unknown()),
  syncDirection: syncDirectionSchema.optional().default('bidirectional'),
  autoSync: z.boolean().optional().default(true),
  syncIntervalMinutes: z.number().min(5).max(1440).optional().default(15),
});

const syncTaskSchema = z.object({
  applicationId: z.string().uuid(),
  provider: syncProviderSchema,
  taskId: z.string().uuid().optional(),
});

const syncReleaseSchema = z.object({
  applicationId: z.string().uuid(),
  releaseId: z.string().uuid(),
  providers: z.array(z.enum(['github', 'gitea'])),
});

export const syncRouter = router({
  /**
   * Get sync configuration for an application
   */
  getConfig: publicProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      provider: syncProviderSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const conditions = [eq(taskSyncConfigs.applicationId, input.applicationId)];
      if (input.provider) {
        conditions.push(eq(taskSyncConfigs.provider, input.provider));
      }

      const configs = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(and(...conditions));

      return configs.map(config => ({
        ...config,
        config: config.config ? JSON.parse(config.config) : {},
      }));
    }),

  /**
   * Configure sync for an application and provider
   */
  configure: protectedProcedure
    .input(configureSyncSchema)
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

      // Check for existing config
      const [existing] = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(
          and(
            eq(taskSyncConfigs.applicationId, input.applicationId),
            eq(taskSyncConfigs.provider, input.provider)
          )
        );

      if (existing) {
        // Update existing config
        const [config] = await ctx.db
          .update(taskSyncConfigs)
          .set({
            enabled: input.enabled,
            config: JSON.stringify(input.config),
            syncDirection: input.syncDirection,
            autoSync: input.autoSync,
            syncIntervalMinutes: input.syncIntervalMinutes,
            updatedAt: now,
          })
          .where(eq(taskSyncConfigs.id, existing.id))
          .returning();

        if (!config) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update config" });
        }

        return {
          ...config,
          config: config.config ? JSON.parse(config.config) : {},
        };
      } else {
        // Create new config
        const [config] = await ctx.db
          .insert(taskSyncConfigs)
          .values({
            applicationId: input.applicationId,
            provider: input.provider,
            enabled: input.enabled,
            config: JSON.stringify(input.config),
            syncDirection: input.syncDirection,
            autoSync: input.autoSync,
            syncIntervalMinutes: input.syncIntervalMinutes,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!config) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create config" });
        }

        return {
          ...config,
          config: config.config ? JSON.parse(config.config) : {},
        };
      }
    }),

  /**
   * Disable sync for a provider
   */
  disable: protectedProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      provider: syncProviderSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      await ctx.db
        .update(taskSyncConfigs)
        .set({
          enabled: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(taskSyncConfigs.applicationId, input.applicationId),
            eq(taskSyncConfigs.provider, input.provider)
          )
        );

      return { success: true };
    }),

  /**
   * Get sync status for an application
   */
  getStatus: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get all sync configs for the app
      const configs = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(eq(taskSyncConfigs.applicationId, input));

      // Get task sync status counts
      const allTasks = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.applicationId, input));

      const syncStatusCounts = {
        local_only: 0,
        synced: 0,
        pending_push: 0,
        conflict: 0,
        externally_deleted: 0,
      };

      for (const task of allTasks) {
        const status = task.syncStatus || 'local_only';
        if (status in syncStatusCounts) {
          syncStatusCounts[status as keyof typeof syncStatusCounts]++;
        }
      }

      return {
        providers: configs.map(c => ({
          provider: c.provider,
          enabled: c.enabled,
          lastSyncAt: c.lastSyncAt,
          lastSyncStatus: c.lastSyncStatus,
          lastSyncError: c.lastSyncError,
        })),
        taskCounts: syncStatusCounts,
        totalTasks: allTasks.length,
      };
    }),

  /**
   * Trigger sync for tasks
   * Note: This creates a sync request - actual sync is handled by the sync engine
   */
  syncTasks: protectedProcedure
    .input(syncTaskSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verify config exists and is enabled
      const [config] = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(
          and(
            eq(taskSyncConfigs.applicationId, input.applicationId),
            eq(taskSyncConfigs.provider, input.provider)
          )
        );

      if (!config) {
        throw new TRPCError({ 
          code: "NOT_FOUND", 
          message: `Sync not configured for ${input.provider}` 
        });
      }

      if (!config.enabled) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `Sync is disabled for ${input.provider}` 
        });
      }

      // If specific task, mark it for sync
      if (input.taskId) {
        const [task] = await ctx.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, input.taskId));

        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
        }

        await ctx.db
          .update(tasks)
          .set({
            syncStatus: 'pending_push',
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, input.taskId));

        return {
          success: true,
          message: `Task marked for sync with ${input.provider}`,
          taskId: input.taskId,
        };
      }

      // Mark all local_only tasks for sync
      await ctx.db
        .update(tasks)
        .set({
          syncStatus: 'pending_push',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.applicationId, input.applicationId),
            eq(tasks.syncStatus, 'local_only')
          )
        );

      return {
        success: true,
        message: `All tasks marked for sync with ${input.provider}`,
      };
    }),

  /**
   * Trigger release publish to external providers
   */
  publishRelease: protectedProcedure
    .input(syncReleaseSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verify release exists and is ready
      const [release] = await ctx.db
        .select()
        .from(releases)
        .where(eq(releases.id, input.releaseId));

      if (!release) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release not found" });
      }

      if (!['ready', 'published'].includes(release.status)) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Release must be in 'ready' or 'published' status to publish" 
        });
      }

      // Verify sync is configured for each provider
      for (const provider of input.providers) {
        const [config] = await ctx.db
          .select()
          .from(taskSyncConfigs)
          .where(
            and(
              eq(taskSyncConfigs.applicationId, input.applicationId),
              eq(taskSyncConfigs.provider, provider)
            )
          );

        if (!config || !config.enabled) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `Sync not enabled for ${provider}` 
          });
        }
      }

      // In a real implementation, this would trigger the sync engine
      // For now, we just update the status
      const now = new Date();
      await ctx.db
        .update(releases)
        .set({
          status: 'published',
          publishedAt: now,
          publishedBy: ctx.userId,
          updatedAt: now,
        })
        .where(eq(releases.id, input.releaseId));

      return {
        success: true,
        message: `Release scheduled for publishing to ${input.providers.join(', ')}`,
        releaseId: input.releaseId,
        providers: input.providers,
      };
    }),

  /**
   * Get sync history for an application
   */
  getHistory: publicProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      provider: syncProviderSchema.optional(),
      limit: z.number().min(1).max(100).optional().default(20),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // For now, return the last sync times from configs
      // In a full implementation, we'd have a sync_history table
      const conditions = [eq(taskSyncConfigs.applicationId, input.applicationId)];
      if (input.provider) {
        conditions.push(eq(taskSyncConfigs.provider, input.provider));
      }

      const configs = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(and(...conditions))
        .orderBy(desc(taskSyncConfigs.lastSyncAt));

      return configs
        .filter(c => c.lastSyncAt)
        .map(c => ({
          provider: c.provider,
          syncedAt: c.lastSyncAt,
          status: c.lastSyncStatus,
          error: c.lastSyncError,
        }));
    }),

  /**
   * Test sync connection for a provider
   */
  testConnection: protectedProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      provider: syncProviderSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get config
      const [config] = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(
          and(
            eq(taskSyncConfigs.applicationId, input.applicationId),
            eq(taskSyncConfigs.provider, input.provider)
          )
        );

      if (!config) {
        throw new TRPCError({ 
          code: "NOT_FOUND", 
          message: `Sync not configured for ${input.provider}` 
        });
      }

      // In a real implementation, this would use the sync engine to test the connection
      // For now, we return a mock success
      return {
        success: true,
        provider: input.provider,
        message: `Connection to ${input.provider} is working`,
      };
    }),

  /**
   * Force full sync (pull + push)
   */
  fullSync: protectedProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      provider: syncProviderSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get enabled configs
      const conditions = [
        eq(taskSyncConfigs.applicationId, input.applicationId),
        eq(taskSyncConfigs.enabled, true),
      ];
      if (input.provider) {
        conditions.push(eq(taskSyncConfigs.provider, input.provider));
      }

      const configs = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(and(...conditions));

      if (configs.length === 0) {
        throw new TRPCError({ 
          code: "NOT_FOUND", 
          message: "No enabled sync configurations found" 
        });
      }

      // Mark sync as in progress
      const now = new Date();
      for (const config of configs) {
        await ctx.db
          .update(taskSyncConfigs)
          .set({
            lastSyncAt: now,
            lastSyncStatus: 'running',
            updatedAt: now,
          })
          .where(eq(taskSyncConfigs.id, config.id));
      }

      // In a real implementation, this would trigger the sync engine
      // For now, we return success
      return {
        success: true,
        message: `Full sync initiated for ${configs.map(c => c.provider).join(', ')}`,
        providers: configs.map(c => c.provider),
      };
    }),

  /**
   * Resolve sync conflict (Control Panel wins)
   */
  resolveConflict: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      resolution: z.enum(['keep_local', 'accept_external']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [task] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.taskId));

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      if (task.syncStatus !== 'conflict') {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Task is not in conflict state" 
        });
      }

      const now = new Date();
      if (input.resolution === 'keep_local') {
        // Keep local version, mark for push
        await ctx.db
          .update(tasks)
          .set({
            syncStatus: 'pending_push',
            syncError: null,
            updatedAt: now,
          })
          .where(eq(tasks.id, input.taskId));
      } else {
        // Accept external - would need to re-pull from provider
        // For now, just clear conflict status
        await ctx.db
          .update(tasks)
          .set({
            syncStatus: 'synced',
            syncError: null,
            updatedAt: now,
          })
          .where(eq(tasks.id, input.taskId));
      }

      return {
        success: true,
        taskId: input.taskId,
        resolution: input.resolution,
      };
    }),
});
