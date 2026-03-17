export interface RollbackCandidateRecord {
  candidateId: string;
  applicationSlug?: string;
  forgeGraphRevId: string;
  knownGoodStatus?: string | null;
  createdAt?: Date | null;
}

export interface RollbackSuggestion {
  candidateId: string;
  forgeGraphRevId: string;
  applicationSlug?: string;
  reason: "latest_known_good";
}

export interface BuildRollbackPlanInput {
  applicationSlug: string;
  environment: string;
  currentCandidateId: string;
  targetCandidateId: string;
  targetForgeGraphRevId: string;
  confirmed: boolean;
}

export function suggestRollbackTarget(
  candidates: RollbackCandidateRecord[],
): RollbackSuggestion | null {
  const target = [...candidates]
    .filter((candidate) => candidate.knownGoodStatus === "known_good" || candidate.knownGoodStatus === "pinned")
    .sort((left, right) => {
      const leftTime = left.createdAt?.getTime() ?? 0;
      const rightTime = right.createdAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0];

  if (!target) {
    return null;
  }

  return {
    candidateId: target.candidateId,
    forgeGraphRevId: target.forgeGraphRevId,
    applicationSlug: target.applicationSlug,
    reason: "latest_known_good",
  };
}

export function buildRollbackPlan(input: BuildRollbackPlanInput) {
  if (!input.confirmed) {
    throw new Error("rollback plan requires explicit human confirmation");
  }

  return {
    title: `Rollback ${input.applicationSlug} ${input.environment} to ${input.targetForgeGraphRevId}`,
    branch: `rollback/${input.applicationSlug}/${input.environment}/${input.targetForgeGraphRevId}`,
    body: [
      `Rollback \`${input.applicationSlug}\` in \`${input.environment}\`.`,
      "",
      `- Current candidate: \`${input.currentCandidateId}\``,
      `- Target candidate: \`${input.targetCandidateId}\``,
      `- Target revision: \`${input.targetForgeGraphRevId}\``,
      "- Generated after explicit operator confirmation.",
    ].join("\n"),
  };
}
