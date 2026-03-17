import { candidateEvidence, desc, eq, overrideRecords } from "@repo/db";
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const releaseAuditRouter = router({
  candidate: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    if (!ctx.db) {
      throw new Error("Database not available");
    }

    const [evidence, overrides] = await Promise.all([
      ctx.db
        .select()
        .from(candidateEvidence)
        .where(eq(candidateEvidence.candidateId, input))
        .orderBy(desc(candidateEvidence.observedAt)),
      ctx.db
        .select()
        .from(overrideRecords)
        .where(eq(overrideRecords.candidateId, input))
        .orderBy(desc(overrideRecords.createdAt)),
    ]);

    return {
      candidateId: input,
      evidence,
      overrides,
    };
  }),
});
