import { describe, it, expect } from "vitest";
import { evaluateReleasePolicy } from "@/lib/release-control/policy-engine";

describe("evaluateReleasePolicy", () => {
  it("produces hard and advisory blockers with freshness rules", () => {
    const result = evaluateReleasePolicy({
      candidate: { queueState: "ready" } as any,
      sourceHealth: {
        argocd: { status: "stale", ageSeconds: 900 },
        prometheus: { status: "healthy", ageSeconds: 15 },
      },
      activeSignals: {
        hardIncidentCount: 1,
      },
    });

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "argocd_stale", severity: "hard" }),
        expect.objectContaining({
          reason: "active_critical_incident",
          severity: "hard",
        }),
      ]),
    );
  });
});
