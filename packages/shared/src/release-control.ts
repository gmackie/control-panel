export type ReleaseQueueState =
  | "building"
  | "ready"
  | "blocked"
  | "awaiting_approval"
  | "releasing"
  | "degraded";

export type BlockerSeverity = "hard" | "advisory";

export type PromotionPrStatus =
  | "requested"
  | "creating"
  | "open"
  | "merge_blocked"
  | "merged"
  | "failed"
  | "closed_unmerged"
  | "superseded";

export type SourceHealthStatus = "healthy" | "degraded" | "stale" | "unreachable";

export type KnownGoodStatus = "unknown" | "candidate" | "known_good" | "pinned";
