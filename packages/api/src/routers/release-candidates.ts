import { desc, eq, releaseCandidates } from "@repo/db";
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const releaseCandidatesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.db) {
      throw new Error("Database not available");
    }

    return await ctx.db
      .select()
      .from(releaseCandidates)
      .orderBy(desc(releaseCandidates.updatedAt));
  }),

  byId: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    if (!ctx.db) {
      throw new Error("Database not available");
    }

    const rows = await ctx.db
      .select()
      .from(releaseCandidates)
      .where(eq(releaseCandidates.id, input))
      .limit(1);

    return (rows as any[])[0] ?? null;
  }),
});
