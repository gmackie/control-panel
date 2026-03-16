/**
 * Deployment Status State Machine
 *
 * ┌──────────────────┐
 * │ pending_approval  │──┐
 * └──────────────────┘  │
 *                       ▼
 * ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 * │  queued   │───▶│ building │───▶│ testing  │───▶│deploying │
 * └──────────┘    └──────────┘    └──────────┘    └──────────┘
 *       │              │               │               │
 *       │              │               │               ▼
 *       │              │               │         ┌──────────┐
 *       │              │               │         │verifying │
 *       │              │               │         └──────────┘
 *       │              │               │               │
 *       ▼              ▼               ▼               ▼
 * ┌──────────┐  ┌──────────┐   ┌──────────┐    ┌──────────┐
 * │ canceled │  │  failed  │   │  failed  │    │ healthy  │
 * └──────────┘  └──────────┘   └──────────┘    └──────────┘
 *                    │                               │
 *                    ▼                               ▼
 *              ┌───────────┐                   ┌───────────┐
 *              │rolled_back│                   │ unhealthy │
 *              └───────────┘                   └───────────┘
 *                                                    │
 *                                                    ▼
 *                                              ┌───────────┐
 *                                              │rolled_back│
 *                                              └───────────┘
 *
 * Terminal states: healthy, unhealthy, rolled_back, failed, canceled, superseded
 */

export const DEPLOYMENT_STATUSES = [
  "pending_approval",
  "queued",
  "building",
  "testing",
  "deploying",
  "verifying",
  "healthy",
  "unhealthy",
  "rolled_back",
  "failed",
  "canceled",
  "superseded",
] as const;

export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const VALID_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  pending_approval: ["queued", "canceled"],
  queued: ["building", "deploying", "canceled", "superseded"],
  building: ["testing", "deploying", "failed", "canceled"],
  testing: ["deploying", "failed", "canceled"],
  deploying: ["verifying", "healthy", "failed", "canceled"],
  verifying: ["healthy", "unhealthy", "failed"],
  healthy: ["unhealthy", "superseded", "rolled_back"],
  unhealthy: ["rolled_back", "healthy", "failed"],
  rolled_back: [],
  failed: ["rolled_back", "queued"],
  canceled: [],
  superseded: [],
};

const STATUS_ALIASES: Record<string, DeploymentStatus> = {
  success: "healthy",
  succeeded: "healthy",
  error: "failed",
  cancelled: "canceled",
  in_progress: "deploying",
  running: "deploying",
  pending: "queued",
};

const TERMINAL_STATUSES = new Set<DeploymentStatus>([
  "healthy",
  "unhealthy",
  "rolled_back",
  "failed",
  "canceled",
  "superseded",
]);

export function normalizeStatus(raw: string): DeploymentStatus {
  const lower = raw.toLowerCase().trim();

  // Direct match
  if (DEPLOYMENT_STATUSES.includes(lower as DeploymentStatus)) {
    return lower as DeploymentStatus;
  }

  // Alias match
  if (lower in STATUS_ALIASES) {
    return STATUS_ALIASES[lower]!;
  }

  // Unknown defaults to failed
  return "failed";
}

export function isValidTransition(
  from: DeploymentStatus,
  to: DeploymentStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function isTerminal(status: DeploymentStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
