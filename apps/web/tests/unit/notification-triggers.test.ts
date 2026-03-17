import { describe, expect, it } from "vitest";
import { buildReleaseControlNotification } from "@/lib/release-control/notification-triggers";

describe("notification-triggers", () => {
  it("builds a deep-linked ready notification for releasers", () => {
    const notification = buildReleaseControlNotification({
      kind: "candidate_ready",
      applicationSlug: "control-panel",
      candidateId: "candidate-1",
      forgeGraphRevId: "rev-123",
      environment: "production",
    });

    expect(notification).toEqual(
      expect.objectContaining({
        source: "release-control-room",
        category: "deployment",
        severity: "info",
        title: expect.stringContaining("ready"),
        links: expect.arrayContaining([
          expect.objectContaining({
            url: expect.stringContaining("/deployments?candidateId=candidate-1"),
          }),
        ]),
      }),
    );
  });

  it("builds a degraded notification with approver audience metadata", () => {
    const notification = buildReleaseControlNotification({
      kind: "release_degraded",
      applicationSlug: "control-panel",
      candidateId: "candidate-2",
      forgeGraphRevId: "rev-124",
      environment: "production",
    });

    expect(notification).toEqual(
      expect.objectContaining({
        severity: "error",
        metadata: expect.objectContaining({
          targetRoles: expect.arrayContaining(["release-owner", "approver"]),
        }),
      }),
    );
  });
});
