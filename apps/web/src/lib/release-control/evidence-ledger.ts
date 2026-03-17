import type { CandidateEvidenceRecord } from "./evidence-normalizer";

export function buildEvidenceLedger(
  entries: CandidateEvidenceRecord[],
): CandidateEvidenceRecord[] {
  return [...entries].sort(
    (left, right) => left.observedAt.getTime() - right.observedAt.getTime(),
  );
}
