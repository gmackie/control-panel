/**
 * Releases Router
 * 
 * tRPC procedures for release management.
 * Releases can be published to GitHub and Gitea.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { 
  releases, 
  releaseAssets,
  tasks,
  applications,
  desc, 
  eq, 
  and,
  asc,
} from "@repo/db";
import { TRPCError } from "@trpc/server";

// Zod schemas for validation
const releaseStatusSchema = z.enum(['draft', 'ready', 'published', 'deployed']);

const createReleaseSchema = z.object({
  applicationId: z.string().uuid(),
  version: z.string().min(1).max(50).regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/, 'Invalid semver format'),
  name: z.string().max(200).optional(),
  description: z.string().optional(),
  changelog: z.string().optional(),
  targetBranch: z.string().optional().default('main'),
  isPrerelease: z.boolean().optional().default(false),
});

const updateReleaseSchema = z.object({
  version: z.string().min(1).max(50).regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/, 'Invalid semver format').optional(),
  name: z.string().max(200).optional().nullable(),
  description: z.string().optional().nullable(),
  changelog: z.string().optional().nullable(),
  status: releaseStatusSchema.optional(),
  targetBranch: z.string().optional(),
  commitSha: z.string().optional().nullable(),
  tagName: z.string().optional().nullable(),
  isPrerelease: z.boolean().optional(),
});

const publishReleaseSchema = z.object({
  releaseId: z.string().uuid(),
  providers: z.array(z.enum(['github', 'gitea'])),
});

const listReleasesSchema = z.object({
  applicationId: z.string().uuid().optional(),
  status: z.array(releaseStatusSchema).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

export const releasesRouter = router({
  /**
   * List releases with filtering and pagination
   */
  list: publicProcedure
    .input(listReleasesSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      let query = ctx.db.select().from(releases);
      const conditions = [];

      if (input.applicationId) {
        conditions.push(eq(releases.applicationId, input.applicationId));
      }
      if (input.status && input.status.length > 0) {
        // Note: using multiple eq with or would be needed for proper filtering
        // For simplicity, we'll filter in JS for now
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      let results = await query
        .orderBy(desc(releases.createdAt))
        .limit(input.limit + 1);

      // Filter by status if provided
      if (input.status && input.status.length > 0) {
        results = results.filter(r => input.status!.includes(r.status as typeof input.status[number]));
      }

      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, -1) : results;

      return {
        items: items.map(release => ({
          ...release,
          deployedEnvironments: release.deployedEnvironments 
            ? JSON.parse(release.deployedEnvironments) 
            : [],
          githubRelease: release.githubRelease 
            ? JSON.parse(release.githubRelease) 
            : null,
          giteaRelease: release.giteaRelease 
            ? JSON.parse(release.giteaRelease) 
            : null,
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  /**
   * Get a single release by ID
   */
  byId: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [release] = await ctx.db
        .select()
        .from(releases)
        .where(eq(releases.id, input));

      if (!release) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release not found" });
      }

      // Get assets
      const assets = await ctx.db
        .select()
        .from(releaseAssets)
        .where(eq(releaseAssets.releaseId, input))
        .orderBy(asc(releaseAssets.name));

      // Get linked tasks
      const linkedTasks = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.releaseId, input));

      return {
        ...release,
        deployedEnvironments: release.deployedEnvironments 
          ? JSON.parse(release.deployedEnvironments) 
          : [],
        githubRelease: release.githubRelease 
          ? JSON.parse(release.githubRelease) 
          : null,
        giteaRelease: release.giteaRelease 
          ? JSON.parse(release.giteaRelease) 
          : null,
        assets,
        linkedTasks: linkedTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })),
      };
    }),

  /**
   * Get latest release for an application
   */
  latest: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [release] = await ctx.db
        .select()
        .from(releases)
        .where(
          and(
            eq(releases.applicationId, input),
            eq(releases.status, 'published')
          )
        )
        .orderBy(desc(releases.publishedAt))
        .limit(1);

      if (!release) {
        return null;
      }

      return {
        ...release,
        deployedEnvironments: release.deployedEnvironments 
          ? JSON.parse(release.deployedEnvironments) 
          : [],
      };
    }),

  /**
   * Create a new release
   */
  create: protectedProcedure
    .input(createReleaseSchema)
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

      // Check for duplicate version
      const [existing] = await ctx.db
        .select()
        .from(releases)
        .where(
          and(
            eq(releases.applicationId, input.applicationId),
            eq(releases.version, input.version)
          )
        );

      if (existing) {
        throw new TRPCError({ 
          code: "CONFLICT", 
          message: `Version ${input.version} already exists for this application` 
        });
      }

      const now = new Date();
      const tagName = `v${input.version}`;

      const [release] = await ctx.db
        .insert(releases)
        .values({
          applicationId: input.applicationId,
          version: input.version,
          name: input.name || null,
          description: input.description || null,
          changelog: input.changelog || null,
          status: 'draft',
          targetBranch: input.targetBranch,
          tagName,
          isPrerelease: input.isPrerelease,
          createdBy: ctx.userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        ...release,
        deployedEnvironments: [],
        githubRelease: null,
        giteaRelease: null,
      };
    }),

  /**
   * Update a release
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateReleaseSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get existing release
      const [existing] = await ctx.db
        .select()
        .from(releases)
        .where(eq(releases.id, input.id));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release not found" });
      }

      // Prevent updating published releases (except for certain fields)
      if (existing.status === 'published' && input.data.status !== 'deployed') {
        const allowedFields = ['status', 'changelog', 'name', 'description'];
        const attemptedFields = Object.keys(input.data).filter(
          k => input.data[k as keyof typeof input.data] !== undefined
        );
        const disallowed = attemptedFields.filter(f => !allowedFields.includes(f));
        
        if (disallowed.length > 0) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `Cannot modify ${disallowed.join(', ')} on a published release` 
          });
        }
      }

      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.data.version !== undefined) {
        updateData.version = input.data.version;
        updateData.tagName = `v${input.data.version}`;
      }
      if (input.data.name !== undefined) updateData.name = input.data.name;
      if (input.data.description !== undefined) updateData.description = input.data.description;
      if (input.data.changelog !== undefined) updateData.changelog = input.data.changelog;
      if (input.data.status !== undefined) {
        updateData.status = input.data.status;
        if (input.data.status === 'published' && !existing.publishedAt) {
          updateData.publishedAt = now;
          updateData.publishedBy = ctx.userId;
        }
      }
      if (input.data.targetBranch !== undefined) updateData.targetBranch = input.data.targetBranch;
      if (input.data.commitSha !== undefined) updateData.commitSha = input.data.commitSha;
      if (input.data.tagName !== undefined) updateData.tagName = input.data.tagName;
      if (input.data.isPrerelease !== undefined) updateData.isPrerelease = input.data.isPrerelease;

      const [release] = await ctx.db
        .update(releases)
        .set(updateData)
        .where(eq(releases.id, input.id))
        .returning();

      if (!release) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update release" });
      }

      return {
        ...release,
        deployedEnvironments: release.deployedEnvironments 
          ? JSON.parse(release.deployedEnvironments) 
          : [],
        githubRelease: release.githubRelease 
          ? JSON.parse(release.githubRelease) 
          : null,
        giteaRelease: release.giteaRelease 
          ? JSON.parse(release.giteaRelease) 
          : null,
      };
    }),

  /**
   * Delete a release
   */
  delete: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [release] = await ctx.db
        .select()
        .from(releases)
        .where(eq(releases.id, input));

      if (!release) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release not found" });
      }

      // Prevent deleting published releases
      if (release.status === 'published') {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Cannot delete a published release" 
        });
      }

      // Unlink any tasks
      await ctx.db
        .update(tasks)
        .set({ releaseId: null })
        .where(eq(tasks.releaseId, input));

      // Delete assets and release
      await ctx.db.delete(releaseAssets).where(eq(releaseAssets.releaseId, input));
      await ctx.db.delete(releases).where(eq(releases.id, input));

      return { success: true, id: input };
    }),

  /**
   * Link tasks to a release
   */
  linkTasks: protectedProcedure
    .input(z.object({
      releaseId: z.string().uuid(),
      taskIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verify release exists
      const [release] = await ctx.db
        .select()
        .from(releases)
        .where(eq(releases.id, input.releaseId));

      if (!release) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release not found" });
      }

      const now = new Date();

      // Link each task
      for (const taskId of input.taskIds) {
        await ctx.db
          .update(tasks)
          .set({ 
            releaseId: input.releaseId,
            updatedAt: now,
          })
          .where(eq(tasks.id, taskId));
      }

      return { success: true, linkedCount: input.taskIds.length };
    }),

  /**
   * Unlink tasks from a release
   */
  unlinkTasks: protectedProcedure
    .input(z.object({
      releaseId: z.string().uuid(),
      taskIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date();

      // Unlink each task
      for (const taskId of input.taskIds) {
        await ctx.db
          .update(tasks)
          .set({ 
            releaseId: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(tasks.id, taskId),
              eq(tasks.releaseId, input.releaseId)
            )
          );
      }

      return { success: true, unlinkedCount: input.taskIds.length };
    }),

  /**
   * Generate changelog from linked tasks
   */
  generateChangelog: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get linked tasks
      const linkedTasks = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.releaseId, input))
        .orderBy(asc(tasks.createdAt));

      if (linkedTasks.length === 0) {
        return { changelog: 'No changes in this release.' };
      }

      // Group by status/type
      const features = linkedTasks.filter(t => 
        t.labels && JSON.parse(t.labels).some((l: string) => 
          l.toLowerCase().includes('feature') || l.toLowerCase().includes('enhancement')
        )
      );
      const bugfixes = linkedTasks.filter(t => 
        t.labels && JSON.parse(t.labels).some((l: string) => 
          l.toLowerCase().includes('bug') || l.toLowerCase().includes('fix')
        )
      );
      const other = linkedTasks.filter(t => 
        !features.includes(t) && !bugfixes.includes(t)
      );

      let changelog = '';

      if (features.length > 0) {
        changelog += '## Features\n\n';
        for (const task of features) {
          changelog += `- ${task.title}\n`;
        }
        changelog += '\n';
      }

      if (bugfixes.length > 0) {
        changelog += '## Bug Fixes\n\n';
        for (const task of bugfixes) {
          changelog += `- ${task.title}\n`;
        }
        changelog += '\n';
      }

      if (other.length > 0) {
        changelog += '## Other Changes\n\n';
        for (const task of other) {
          changelog += `- ${task.title}\n`;
        }
        changelog += '\n';
      }

      return { changelog: changelog.trim() };
    }),

  /**
   * Get next version suggestion
   */
  suggestNextVersion: publicProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      type: z.enum(['major', 'minor', 'patch']),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get latest release
      const [latest] = await ctx.db
        .select()
        .from(releases)
        .where(eq(releases.applicationId, input.applicationId))
        .orderBy(desc(releases.createdAt))
        .limit(1);

      let major = 0, minor = 0, patch = 0;

      if (latest) {
        const match = latest.version.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (match && match[1] && match[2] && match[3]) {
          major = parseInt(match[1], 10);
          minor = parseInt(match[2], 10);
          patch = parseInt(match[3], 10);
        }
      }

      switch (input.type) {
        case 'major':
          major++;
          minor = 0;
          patch = 0;
          break;
        case 'minor':
          minor++;
          patch = 0;
          break;
        case 'patch':
          patch++;
          break;
      }

      return { version: `${major}.${minor}.${patch}` };
    }),
});
