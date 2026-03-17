import { desc, eq, promotionPrs } from "@repo/db";
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const promotionPrsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.db) {
      throw new Error("Database not available");
    }

    return await ctx.db
      .select()
      .from(promotionPrs)
      .orderBy(desc(promotionPrs.updatedAt));
  }),

  byCandidate: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    if (!ctx.db) {
      throw new Error("Database not available");
    }

    return await ctx.db
      .select()
      .from(promotionPrs)
      .where(eq(promotionPrs.candidateId, input))
      .orderBy(desc(promotionPrs.updatedAt));
  }),
});
