import type { ReleaseBlocker } from "./blocker-reasons";
import type { SourceTrustMap } from "./source-trust";

interface EvaluateReleasePolicyInput {
  candidate: {
    queueState?: string;
    imageDigest?: string | null;
    supersedeStatus?: string;
  };
  sourceHealth: SourceTrustMap;
  activeSignals: {
    hardIncidentCount?: number;
  };
}

interface EvaluateReleasePolicyResult {
  blockers: ReleaseBlocker[];
  advisories: ReleaseBlocker[];
  isPromotable: boolean;
  requiresSecondApprover: boolean;
  overrideEligibleReasons: string[];
}

export function evaluateReleasePolicy(
  input: EvaluateReleasePolicyInput,
): EvaluateReleasePolicyResult {
  const blockers: ReleaseBlocker[] = [];
  const advisories: ReleaseBlocker[] = [];

  if (!input.candidate.imageDigest && input.candidate.queueState !== "ready") {
    advisories.push({
      reason: "missing_artifact",
      severity: "advisory",
      source: "harbor",
      message: "Candidate artifact has not been published yet.",
    });
  }

  if (input.sourceHealth.argocd?.status === "stale") {
    blockers.push({
      reason: "argocd_stale",
      severity: "hard",
      source: "argocd",
      message: "ArgoCD evidence is stale and cannot be trusted for promotion.",
    });
  }

  if ((input.activeSignals.hardIncidentCount || 0) > 0) {
    blockers.push({
      reason: "active_critical_incident",
      severity: "hard",
      source: "prometheus",
      message: "A critical incident is active for this release path.",
    });
  }

  if (input.candidate.supersedeStatus === "superseded") {
    advisories.push({
      reason: "candidate_superseded",
      severity: "advisory",
      source: "release-control",
      message: "A newer candidate is available and this one may require reconfirmation.",
    });
  }

  return {
    blockers,
    advisories,
    isPromotable: blockers.length === 0,
    requiresSecondApprover: blockers.length > 0,
    overrideEligibleReasons: blockers.map((blocker) => blocker.reason),
  };
}
