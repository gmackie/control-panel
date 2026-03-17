import { applications, desc, eq, promotionPrs, releaseCandidates } from "@repo/db";
import { router, publicProcedure } from "../trpc";

function unwrapJoinedRow(row: any) {
  return {
    candidate: row.release_candidates ?? row.releaseCandidates ?? row,
    application: row.applications ?? row.application ?? row,
    promotionPr: row.promotion_prs ?? row.promotionPrs ?? row,
  };
}

export const releaseQueueRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.db) {
      throw new Error("Database not available");
    }

    const rows = await ctx.db
      .select()
      .from(releaseCandidates)
      .leftJoin(applications, eq(applications.id, releaseCandidates.applicationId))
      .leftJoin(promotionPrs, eq(promotionPrs.candidateId, releaseCandidates.id))
      .orderBy(desc(releaseCandidates.updatedAt));

    return (rows as any[]).map((row) => {
      const { candidate, application, promotionPr } = unwrapJoinedRow(row);

      return {
        candidateId: candidate.candidateId ?? candidate.id,
        applicationId: candidate.applicationId,
        applicationSlug: application.applicationSlug ?? application.slug,
        forgeGraphRepoId: candidate.forgeGraphRepoId,
        forgeGraphRevId: candidate.forgeGraphRevId,
        queueState: candidate.queueState,
        imageTag: candidate.imageTag ?? null,
        imageDigest: candidate.imageDigest ?? null,
        knownGoodStatus: candidate.knownGoodStatus ?? null,
        createdAt: candidate.createdAt ?? null,
        promotionPrStatus: promotionPr.promotionPrStatus ?? promotionPr.status ?? null,
        promotionPrNumber: promotionPr.promotionPrNumber ?? promotionPr.prNumber ?? null,
        desiredEnvironment: candidate.desiredEnvironment ?? "production",
        blockers: Array.isArray(candidate.blockers) ? candidate.blockers : [],
      };
    });
  }),
});
