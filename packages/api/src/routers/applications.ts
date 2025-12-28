/**
 * Applications Router
 * 
 * tRPC procedures for application management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { applications, desc, eq } from "@repo/db";
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
        createdAt: app.createdAt, // Already a Date in PostgreSQL
        updatedAt: app.updatedAt, // Already a Date in PostgreSQL
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
        createdAt: app.createdAt, // Already a Date in PostgreSQL
        updatedAt: app.updatedAt, // Already a Date in PostgreSQL
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
        createdAt: app.createdAt, // Already a Date in PostgreSQL
        updatedAt: app.updatedAt, // Already a Date in PostgreSQL
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

      const now = new Date();

      await ctx.db.insert(applications).values({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        repositoryUrl: input.repositoryUrl || null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      return { ...input, status: "active", createdAt: now, updatedAt: now };
    }),
});
