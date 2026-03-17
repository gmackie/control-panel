export interface CandidateIngestSnapshot {
  candidateId: string;
  queueState: string;
  readinessStatus: string;
  lastObservedAt: Date;
}

export function reconcileCandidateIngest(snapshot: CandidateIngestSnapshot) {
  return {
    ...snapshot,
    reconciledAt: new Date(),
  };
}
