export interface CandidateEvidenceRecord {
  source:
    | "forgegraph"
    | "gitea"
    | "harbor"
    | "argocd"
    | "prometheus"
    | "kubernetes";
  evidenceType: string;
  applicationId?: string;
  candidateId?: string;
  environment?: "staging" | "production";
  observedAt: Date;
  freshnessSeconds?: number;
  payload: Record<string, unknown>;
}

export function normalizeCandidateEvidence(
  evidence: CandidateEvidenceRecord,
): CandidateEvidenceRecord {
  return evidence;
}
