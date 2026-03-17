export interface RollbackCandidate {
  candidateId: string;
  forgeGraphRevId: string;
  knownGoodStatus: string;
  becameKnownGoodAt?: Date | null;
}

export function suggestRollbackTarget(candidates: RollbackCandidate[]) {
  const eligible = candidates
    .filter(
      (candidate) =>
        candidate.knownGoodStatus === "known_good" ||
        candidate.knownGoodStatus === "pinned",
    )
    .sort((left, right) => {
      const leftTime = left.becameKnownGoodAt?.getTime() ?? 0;
      const rightTime = right.becameKnownGoodAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });

  const target = eligible[0];
  if (!target) {
    return null;
  }

  return {
    candidateId: target.candidateId,
    forgeGraphRevId: target.forgeGraphRevId,
    reason: "latest_known_good" as const,
  };
}
