import { describe, expect, it } from "vitest";
import {
  buildRollbackPlan,
  suggestRollbackTarget,
} from "@/lib/release-control/rollback-service";

describe("rollback-service", () => {
  it("returns the last known-good production candidate", () => {
    const target = suggestRollbackTarget([
      {
        candidateId: "c1",
        applicationSlug: "control-panel",
        forgeGraphRevId: "rev-122",
        knownGoodStatus: "known_good",
        createdAt: new Date("2026-03-16T12:00:00.000Z"),
      },
      {
        candidateId: "c2",
        applicationSlug: "control-panel",
        forgeGraphRevId: "rev-123",
        knownGoodStatus: "unknown",
        createdAt: new Date("2026-03-17T12:00:00.000Z"),
      },
    ]);

    expect(target).toEqual(
      expect.objectContaining({
        candidateId: "c1",
        forgeGraphRevId: "rev-122",
        reason: "latest_known_good",
      }),
    );
  });

  it("requires explicit human confirmation before building a rollback plan", () => {
    expect(() =>
      buildRollbackPlan({
        applicationSlug: "control-panel",
        environment: "production",
        currentCandidateId: "c2",
        targetCandidateId: "c1",
        targetForgeGraphRevId: "rev-122",
        confirmed: false,
      }),
    ).toThrow("confirmation");
  });
});
