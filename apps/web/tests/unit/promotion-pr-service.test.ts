import { describe, expect, it } from "vitest";
import {
  buildPromotionPrPlan,
  transitionPromotionPrState,
} from "@/lib/release-control/promotion-pr-service";

describe("promotion-pr-service", () => {
  it("builds a deployment-repo promotion PR plan from a release candidate", () => {
    const plan = buildPromotionPrPlan({
      applicationSlug: "control-panel",
      environment: "production",
      forgeGraphRevId: "rev-123",
      imageTag: "control-panel:rev-123",
      imageDigest: "sha256:test",
      deploymentRepo: "git@gitea.example.com:infra/deployments.git",
      deploymentRepoPath: "apps/control-panel/production.yaml",
      requestedBy: "user-1",
    });

    expect(plan.branch).toBe("release/control-panel/production/rev-123");
    expect(plan.title).toContain("Promote control-panel to production");
    expect(plan.commitMessage).toContain("rev-123");
    expect(plan.metadata.requestedBy).toBe("user-1");
  });

  it("tracks promotion PR lifecycle transitions", () => {
    const transition = transitionPromotionPrState(
      {
        status: "open",
        prNumber: 42,
      },
      {
        status: "merged",
        mergedAt: new Date("2026-03-17T20:00:00.000Z"),
        mergedBy: "user-2",
      },
    );

    expect(transition.status).toBe("merged");
    expect(transition.prNumber).toBe(42);
    expect(transition.mergedBy).toBe("user-2");
  });
});
