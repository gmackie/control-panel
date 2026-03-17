export interface PromotionPrSnapshot {
  candidateId: string;
  status: string;
  prNumber?: number | null;
  mergedAt?: Date | null;
}

export function reconcilePromotionPr(snapshot: PromotionPrSnapshot) {
  return {
    ...snapshot,
    isTerminal:
      snapshot.status === "merged" ||
      snapshot.status === "failed" ||
      snapshot.status === "closed_unmerged",
  };
}
