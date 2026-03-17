import { describe, it, expect } from "vitest";
import { assembleReleaseCandidate } from "@/lib/release-control/candidate-assembler";

describe("assembleReleaseCandidate", () => {
  it("builds a candidate from revision, image, and staging rollout evidence", () => {
    const candidate = assembleReleaseCandidate({
      forge: { repoId: "repo-1", revId: "rev-123" },
      artifact: {
        imageTag: "control-panel:rev-123",
        imageDigest: "sha256:test",
      },
      staging: { syncStatus: "Synced", healthStatus: "Healthy" },
    });

    expect(candidate.forgeGraphRevId).toBe("rev-123");
    expect(candidate.imageDigest).toBe("sha256:test");
    expect(candidate.queueState).toBe("ready");
  });
});
