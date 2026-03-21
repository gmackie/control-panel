// ---------------------------------------------------------------------------
// Deploy State Tracker — in-memory singleton for active deployments
// ---------------------------------------------------------------------------

export interface DeployState {
  executionRequestId: string;
  imageRef: string;
  imageDigest?: string;
  startedAt: Date;
  rolledBack: boolean;
}

export interface LastKnownGood {
  imageRepository: string;
  imageTag: string;
  imageDigest?: string;
  confirmedAt: Date;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

function makeKey(appName: string, env: string): string {
  return `${appName}:${env}`;
}

const activeDeployments = new Map<string, DeployState>();
const lastKnownGoods = new Map<string, LastKnownGood>();

// ---------------------------------------------------------------------------
// Active deployment tracking
// ---------------------------------------------------------------------------

export function getActiveDeployment(
  appName: string,
  env: string,
): DeployState | null {
  return activeDeployments.get(makeKey(appName, env)) ?? null;
}

export function setActiveDeployment(
  appName: string,
  env: string,
  state: DeployState,
): void {
  activeDeployments.set(makeKey(appName, env), state);
}

export function clearActiveDeployment(
  appName: string,
  env: string,
): void {
  activeDeployments.delete(makeKey(appName, env));
}

export function isDeployInFlight(appName: string, env: string): boolean {
  const state = activeDeployments.get(makeKey(appName, env));
  return state != null && !state.rolledBack;
}

// ---------------------------------------------------------------------------
// Last known good tracking
// ---------------------------------------------------------------------------

export function getLastKnownGood(
  appName: string,
  env: string,
): LastKnownGood | null {
  return lastKnownGoods.get(makeKey(appName, env)) ?? null;
}

export function setLastKnownGood(
  appName: string,
  env: string,
  good: LastKnownGood,
): void {
  lastKnownGoods.set(makeKey(appName, env), good);
}

// ---------------------------------------------------------------------------
// Rollback protection
// ---------------------------------------------------------------------------

/**
 * Mark an active deployment as rolled back.
 * Returns `false` if already rolled back (loop protection).
 */
export function markRolledBack(appName: string, env: string): boolean {
  const state = activeDeployments.get(makeKey(appName, env));
  if (!state) {
    return false;
  }

  if (state.rolledBack) {
    return false;
  }

  state.rolledBack = true;
  return true;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Reset all state — for testing only */
export function _resetDeployState(): void {
  activeDeployments.clear();
  lastKnownGoods.clear();
}
