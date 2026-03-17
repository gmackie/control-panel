export interface ArgoRolloutSnapshot {
  argoAppName: string;
  syncStatus: string;
  healthStatus: string;
}

export function reconcileArgoRollout(snapshot: ArgoRolloutSnapshot) {
  return {
    ...snapshot,
    rolloutState:
      snapshot.syncStatus === "Synced" && snapshot.healthStatus === "Healthy"
        ? "converged"
        : "progressing",
  };
}
