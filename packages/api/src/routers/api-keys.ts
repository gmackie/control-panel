import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { apiKeys, eq, and, isNull, desc } from "@repo/db";
import { generateApiKey, parseExpiresIn } from "../lib/api-keys";

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.db || !ctx.userId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }

    const keys = await ctx.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        description: apiKeys.description,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        lastUsedAt: apiKeys.lastUsedAt,
        usageCount: apiKeys.usageCount,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.userId))
      .orderBy(desc(apiKeys.createdAt));

    return keys.map((key) => ({
      ...key,
      permissions: JSON.parse(key.permissions || "[]") as string[],
      isActive: !key.revokedAt && (!key.expiresAt || key.expiresAt > new Date()),
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        permissions: z.array(z.string()).default(["read"]),
        expiresIn: z
          .string()
          .regex(/^\d+(d|w|m|y)$/, "Format: 30d, 4w, 6m, or 1y")
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const { key, hash, prefix } = generateApiKey();

      const expiresAt = input.expiresIn ? parseExpiresIn(input.expiresIn) : null;

      const [created] = await ctx.db
        .insert(apiKeys)
        .values({
          userId: ctx.userId,
          name: input.name,
          description: input.description,
          keyHash: hash,
          keyPrefix: prefix,
          permissions: JSON.stringify(input.permissions),
          expiresAt,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          createdAt: apiKeys.createdAt,
        });

      return {
        ...created,
        key,
        message: "Store this key securely - it will not be shown again",
      };
    }),

  revoke: protectedProcedure
    .input(
      z.object({
        keyId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .update(apiKeys)
        .set({
          revokedAt: new Date(),
          revokedReason: input.reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(apiKeys.id, input.keyId),
            eq(apiKeys.userId, ctx.userId),
            isNull(apiKeys.revokedAt)
          )
        )
        .returning({ id: apiKeys.id });

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found or already revoked" });
      }

      return { success: true, keyId: input.keyId };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        keyId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const result = await ctx.db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, input.keyId), eq(apiKeys.userId, ctx.userId)))
        .returning({ id: apiKeys.id });

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }

      return { success: true, keyId: input.keyId };
    }),
});
