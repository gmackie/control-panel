export type BlockerReason =
  | "missing_artifact"
  | "staging_unhealthy"
  | "argocd_stale"
  | "kubernetes_stale"
  | "active_critical_incident"
  | "promotion_pr_failed"
  | "verification_timeout"
  | "candidate_superseded";

export interface ReleaseBlocker {
  reason: BlockerReason;
  severity: "hard" | "advisory";
  source: string;
  message: string;
}
