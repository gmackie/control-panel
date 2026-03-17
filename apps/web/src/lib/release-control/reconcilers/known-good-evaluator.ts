export interface KnownGoodCandidateInput {
  queueState: string;
  observationWindowMinutes: number;
  productionHealthySince?: Date | null;
  activeCriticalIncidents: number;
}

export interface KnownGoodCandidateResult {
  status: "unknown" | "candidate" | "known_good";
  reason: "waiting_for_observation" | "healthy_observation_window" | "active_incident";
}

export function evaluateKnownGoodCandidate(
  input: KnownGoodCandidateInput,
): KnownGoodCandidateResult {
  if (input.activeCriticalIncidents > 0) {
    return {
      status: "candidate",
      reason: "active_incident",
    };
  }

  if (input.queueState !== "production_healthy" || !input.productionHealthySince) {
    return {
      status: "unknown",
      reason: "waiting_for_observation",
    };
  }

  const observedMinutes =
    (Date.now() - input.productionHealthySince.getTime()) / 60_000;

  if (observedMinutes < input.observationWindowMinutes) {
    return {
      status: "candidate",
      reason: "waiting_for_observation",
    };
  }

  return {
    status: "known_good",
    reason: "healthy_observation_window",
  };
}
