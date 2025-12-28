/**
 * Applications Router
 * 
 * tRPC procedures for application management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { applications } from "@repo/db";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const applicationsRouter = router({
  /**
   * Get all applications
   */
  list: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const results = await ctx.db
        .select()
        .from(applications)
        .orderBy(desc(applications.createdAt));

      return results.map((app) => ({
        ...app,
        createdAt: new Date(app.createdAt),
        updatedAt: new Date(app.updatedAt),
      }));
    }),

  /**
   * Get a single application by ID
   */
  byId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .select()
        .from(applications)
        .where(eq(applications.id, input))
        .limit(1);

      const app = result[0];
      if (!app) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      return {
        ...app,
        createdAt: new Date(app.createdAt),
        updatedAt: new Date(app.updatedAt),
      };
    }),

  /**
   * Get application by slug
   */
  bySlug: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .select()
        .from(applications)
        .where(eq(applications.slug, input))
        .limit(1);

      const app = result[0];
      if (!app) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }

      return {
        ...app,
        createdAt: new Date(app.createdAt),
        updatedAt: new Date(app.updatedAt),
      };
    }),

  /**
   * Create a new application
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      repositoryUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const now = new Date().toISOString();
      const id = `app_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

      await ctx.db.insert(applications).values({
        id,
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        repositoryUrl: input.repositoryUrl || null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      return { id, ...input, status: "active", createdAt: new Date(now), updatedAt: new Date(now) };
    }),
});
