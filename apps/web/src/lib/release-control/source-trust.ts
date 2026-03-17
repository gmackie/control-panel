export interface SourceTrustSignal {
  status: "healthy" | "degraded" | "stale" | "unreachable";
  ageSeconds?: number;
}

export interface SourceTrustMap {
  argocd?: SourceTrustSignal;
  harbor?: SourceTrustSignal;
  prometheus?: SourceTrustSignal;
  kubernetes?: SourceTrustSignal;
  gitea?: SourceTrustSignal;
}

export interface SourceFreshnessInput {
  source: string;
  maxFreshnessSeconds: number;
  observedAt?: Date | null;
  lastError?: string | null;
}

export interface ControlRoomTrustSummary {
  status: "healthy" | "degraded";
  degradedSources: string[];
  sources: SourceTrustMap;
  summary: string;
}

export function isSourceStale(signal?: SourceTrustSignal): boolean {
  return signal?.status === "stale";
}

export function reconcileSourceFreshness(
  input: SourceFreshnessInput,
): SourceTrustSignal & { source: string } {
  if (!input.observedAt) {
    return {
      source: input.source,
      status: input.lastError ? "degraded" : "unreachable",
    };
  }

  const ageSeconds = Math.max(
    0,
    Math.floor((Date.now() - input.observedAt.getTime()) / 1000),
  );

  return {
    source: input.source,
    ageSeconds,
    status: ageSeconds > input.maxFreshnessSeconds ? "stale" : "healthy",
  };
}

export function computeControlRoomTrust(
  sources: SourceTrustMap,
): ControlRoomTrustSummary {
  const degradedSources = Object.entries(sources)
    .filter(([, signal]) => signal && signal.status !== "healthy")
    .map(([source]) => source);

  if (degradedSources.length === 0) {
    return {
      status: "healthy",
      degradedSources: [],
      sources,
      summary: "All critical release-control feeds are healthy.",
    };
  }

  return {
    status: "degraded",
    degradedSources,
    sources,
    summary: `Release-control data is degraded: ${degradedSources.join(", ")}.`,
  };
}
