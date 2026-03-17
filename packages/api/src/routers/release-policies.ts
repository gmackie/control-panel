import {
  and,
  candidateEvidence,
  desc,
  eq,
  knownGoodReleases,
  overrideRecords,
  releaseCandidates,
  releaseOwners,
  releasePolicies,
} from "@repo/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router, publicProcedure } from "../trpc";

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseApprovalActor(row: { payload?: string | null }) {
  if (!row.payload) {
    return null;
  }

  try {
    return JSON.parse(row.payload).approvedBy ?? null;
  } catch {
    return null;
  }
}

export const releasePoliciesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.db) {
      throw new Error("Database not available");
    }

    return await ctx.db
      .select()
      .from(releasePolicies)
      .orderBy(desc(releasePolicies.updatedAt));
  }),

  byEnvironment: publicProcedure
    .input(z.object({ applicationId: z.string(), environment: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new Error("Database not available");
      }

      const rows = await ctx.db
        .select()
        .from(releasePolicies)
        .where(
          and(
            eq(releasePolicies.applicationId, input.applicationId),
            eq(releasePolicies.environment, input.environment),
          ),
        )
        .limit(1);

      return ((rows as any[])[0] ?? null) as any;
    }),

  approveCandidate: protectedProcedure
    .input(
      z.object({
        candidateId: z.string(),
        environment: z.string(),
        evidenceSnapshot: z.record(z.string(), z.unknown()).default({}),
        activeBlockers: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [candidate] = await ctx.db
        .select()
        .from(releaseCandidates)
        .where(eq(releaseCandidates.id, input.candidateId))
        .limit(1);

      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release candidate not found" });
      }

      const [owner] = await ctx.db
        .select()
        .from(releaseOwners)
        .where(
          and(
            eq(releaseOwners.applicationId, candidate.applicationId),
            eq(releaseOwners.environment, input.environment),
            eq(releaseOwners.userId, ctx.userId!),
          ),
        )
        .limit(1);

      if (!owner?.canApprove) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User is not eligible to approve this release" });
      }

      const [policy] = await ctx.db
        .select()
        .from(releasePolicies)
        .where(
          and(
            eq(releasePolicies.applicationId, candidate.applicationId),
            eq(releasePolicies.environment, input.environment),
          ),
        )
        .limit(1);

      const approvalRows = await ctx.db
        .select()
        .from(candidateEvidence)
        .where(
          and(
            eq(candidateEvidence.candidateId, input.candidateId),
            eq(candidateEvidence.environment, input.environment),
            eq(candidateEvidence.source, "release-control"),
            eq(candidateEvidence.evidenceType, "approval_snapshot"),
          ),
        )
        .orderBy(desc(candidateEvidence.observedAt));

      const existingApproverIds = approvalRows
        .map((row) => parseApprovalActor(row))
        .filter((value): value is string => Boolean(value));

      if (existingApproverIds.includes(ctx.userId!)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User has already approved this candidate" });
      }

      const requiredApproverCount = Math.max(
        policy?.requiredApproverCount ?? 1,
        policy?.highRiskRequiresSecondApprover && input.activeBlockers.length > 0 ? 2 : 1,
      );
      const approvalCount = new Set([...existingApproverIds, ctx.userId!]).size;
      const now = new Date();

      await ctx.db.insert(candidateEvidence).values({
        applicationId: candidate.applicationId,
        candidateId: candidate.id,
        environment: input.environment,
        source: "release-control",
        evidenceType: "approval_snapshot",
        payload: JSON.stringify({
          approvedBy: ctx.userId,
          approvedAt: now.toISOString(),
          approvalCount,
          requiredApproverCount,
          activeBlockers: input.activeBlockers,
          evidenceSnapshot: input.evidenceSnapshot,
        }),
        observedAt: now,
        createdAt: now,
      });

      return {
        candidateId: candidate.id,
        approvalCount,
        requiredApproverCount,
        status:
          approvalCount >= requiredApproverCount
            ? "approved"
            : "awaiting_second_approval",
      };
    }),

  requestSecondApproval: protectedProcedure
    .input(
      z.object({
        candidateId: z.string(),
        environment: z.string(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [candidate] = await ctx.db
        .select()
        .from(releaseCandidates)
        .where(eq(releaseCandidates.id, input.candidateId))
        .limit(1);

      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release candidate not found" });
      }

      const [owner] = await ctx.db
        .select()
        .from(releaseOwners)
        .where(
          and(
            eq(releaseOwners.applicationId, candidate.applicationId),
            eq(releaseOwners.environment, input.environment),
            eq(releaseOwners.userId, ctx.userId!),
          ),
        )
        .limit(1);

      if (!owner?.canApprove) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User is not eligible to request approvals" });
      }

      const now = new Date();
      await ctx.db.insert(candidateEvidence).values({
        applicationId: candidate.applicationId,
        candidateId: candidate.id,
        environment: input.environment,
        source: "release-control",
        evidenceType: "second_approval_request",
        payload: JSON.stringify({
          requestedBy: ctx.userId,
          requestedAt: now.toISOString(),
          note: input.note ?? null,
        }),
        observedAt: now,
        createdAt: now,
      });

      return {
        candidateId: candidate.id,
        status: "second_approval_requested",
      };
    }),

  requestOverride: protectedProcedure
    .input(
      z.object({
        candidateId: z.string(),
        environment: z.string(),
        blockerReason: z.string().min(1),
        justification: z.string().min(1),
        ticketUrl: z.string().min(1),
        snapshot: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [candidate] = await ctx.db
        .select()
        .from(releaseCandidates)
        .where(eq(releaseCandidates.id, input.candidateId))
        .limit(1);

      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release candidate not found" });
      }

      const [owner] = await ctx.db
        .select()
        .from(releaseOwners)
        .where(
          and(
            eq(releaseOwners.applicationId, candidate.applicationId),
            eq(releaseOwners.environment, input.environment),
            eq(releaseOwners.userId, ctx.userId!),
          ),
        )
        .limit(1);

      if (!owner || !owner.canOverride) {
        throw new TRPCError({ code: "FORBIDDEN", message: "override requires an eligible release owner" });
      }

      const [policy] = await ctx.db
        .select()
        .from(releasePolicies)
        .where(
          and(
            eq(releasePolicies.applicationId, candidate.applicationId),
            eq(releasePolicies.environment, input.environment),
          ),
        )
        .limit(1);

      if (!policy?.overrideAllowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Override is not allowed by policy" });
      }

      const overrideEligibleSet = parseJsonArray(policy.overrideEligibleSet);
      if (overrideEligibleSet.length > 0 && !overrideEligibleSet.includes(ctx.userId!)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User is not allowed to override this release" });
      }

      const now = new Date();
      const [override] = await ctx.db
        .insert(overrideRecords)
        .values({
          candidateId: candidate.id,
          applicationId: candidate.applicationId,
          environment: input.environment,
          blockerReason: input.blockerReason,
          approvedBy: ctx.userId!,
          justification: input.justification,
          ticketUrl: input.ticketUrl,
          snapshot: JSON.stringify(input.snapshot),
          createdAt: now,
        })
        .returning();

      if (!override) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to persist override record",
        });
      }

      await ctx.db.insert(candidateEvidence).values({
        applicationId: candidate.applicationId,
        candidateId: candidate.id,
        environment: input.environment,
        source: "release-control",
        evidenceType: "override_snapshot",
        payload: JSON.stringify({
          overrideId: override.id,
          blockerReason: input.blockerReason,
          approvedBy: ctx.userId,
          justification: input.justification,
          ticketUrl: input.ticketUrl,
          snapshot: input.snapshot,
        }),
        observedAt: now,
        createdAt: now,
      });

      return override;
    }),

  pinKnownGood: protectedProcedure
    .input(
      z.object({
        candidateId: z.string(),
        environment: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [candidate] = await ctx.db
        .select()
        .from(releaseCandidates)
        .where(eq(releaseCandidates.id, input.candidateId))
        .limit(1);

      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release candidate not found" });
      }

      const [owner] = await ctx.db
        .select()
        .from(releaseOwners)
        .where(
          and(
            eq(releaseOwners.applicationId, candidate.applicationId),
            eq(releaseOwners.environment, input.environment),
            eq(releaseOwners.userId, ctx.userId!),
          ),
        )
        .limit(1);

      if (!owner?.canApprove) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User is not eligible to pin known-good releases" });
      }

      const [existing] = await ctx.db
        .select()
        .from(knownGoodReleases)
        .where(eq(knownGoodReleases.candidateId, candidate.id))
        .limit(1);

      const now = new Date();
      const [record] = existing
        ? [existing]
        : await ctx.db
            .insert(knownGoodReleases)
            .values({
              candidateId: candidate.id,
              applicationId: candidate.applicationId,
              environment: input.environment,
              reason: "manual_pin",
              pinnedBy: ctx.userId!,
              becameKnownGoodAt: now,
              pinnedAt: now,
              createdAt: now,
            })
            .returning();

      await ctx.db
        .update(releaseCandidates)
        .set({ knownGoodStatus: "pinned", updatedAt: now })
        .where(eq(releaseCandidates.id, candidate.id));

      return record;
    }),

  unpinKnownGood: protectedProcedure
    .input(
      z.object({
        candidateId: z.string(),
        environment: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [candidate] = await ctx.db
        .select()
        .from(releaseCandidates)
        .where(eq(releaseCandidates.id, input.candidateId))
        .limit(1);

      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Release candidate not found" });
      }

      const [owner] = await ctx.db
        .select()
        .from(releaseOwners)
        .where(
          and(
            eq(releaseOwners.applicationId, candidate.applicationId),
            eq(releaseOwners.environment, input.environment),
            eq(releaseOwners.userId, ctx.userId!),
          ),
        )
        .limit(1);

      if (!owner?.canApprove) {
        throw new TRPCError({ code: "FORBIDDEN", message: "User is not eligible to unpin known-good releases" });
      }

      await ctx.db
        .delete(knownGoodReleases)
        .where(
          and(
            eq(knownGoodReleases.candidateId, candidate.id),
            eq(knownGoodReleases.environment, input.environment),
          ),
        );

      await ctx.db
        .update(releaseCandidates)
        .set({ knownGoodStatus: "unknown", updatedAt: new Date() })
        .where(eq(releaseCandidates.id, candidate.id));

      return {
        candidateId: candidate.id,
        status: "unpinned",
      };
    }),
});
