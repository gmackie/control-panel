import { describe, expect, it } from "vitest";
import {
  computeControlRoomTrust,
  reconcileSourceFreshness,
} from "@/lib/release-control/source-trust";
import { evaluateKnownGoodCandidate } from "@/lib/release-control/reconcilers/known-good-evaluator";
import { suggestRollbackTarget } from "@/lib/release-control/reconcilers/rollback-suggestion-evaluator";

describe("source trust and reconciler primitives", () => {
  it("marks the control room as degraded when a critical source is stale", () => {
    const trust = computeControlRoomTrust({
      argocd: { status: "stale", ageSeconds: 901 },
      harbor: { status: "healthy", ageSeconds: 45 },
      prometheus: { status: "healthy", ageSeconds: 30 },
    });

    expect(trust.status).toBe("degraded");
    expect(trust.degradedSources).toEqual(["argocd"]);
    expect(trust.summary).toContain("argocd");
  });

  it("reconciles source freshness from last observation and thresholds", () => {
    const freshness = reconcileSourceFreshness({
      source: "prometheus",
      maxFreshnessSeconds: 60,
      observedAt: new Date(Date.now() - 120_000),
    });

    expect(freshness.status).toBe("stale");
    expect(freshness.ageSeconds).toBeGreaterThanOrEqual(120);
  });

  it("marks a candidate known-good after the observation window passes", () => {
    const knownGood = evaluateKnownGoodCandidate({
      queueState: "production_healthy",
      observationWindowMinutes: 15,
      productionHealthySince: new Date(Date.now() - 20 * 60_000),
      activeCriticalIncidents: 0,
    });

    expect(knownGood.status).toBe("known_good");
    expect(knownGood.reason).toBe("healthy_observation_window");
  });

  it("suggests the latest known-good release as the rollback target", () => {
    const suggestion = suggestRollbackTarget([
      {
        candidateId: "candidate-1",
        forgeGraphRevId: "rev-122",
        knownGoodStatus: "known_good",
        becameKnownGoodAt: new Date("2026-03-16T12:00:00.000Z"),
      },
      {
        candidateId: "candidate-2",
        forgeGraphRevId: "rev-123",
        knownGoodStatus: "unknown",
        becameKnownGoodAt: new Date("2026-03-17T12:00:00.000Z"),
      },
    ]);

    expect(suggestion).toEqual(
      expect.objectContaining({
        candidateId: "candidate-1",
        forgeGraphRevId: "rev-122",
        reason: "latest_known_good",
      }),
    );
  });
});
