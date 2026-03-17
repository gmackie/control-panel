import { describe, expect, it } from "vitest";
import {
  assertOverrideEligibility,
  resolveApprovalState,
} from "@/lib/release-control/release-approval-policy";

describe("release approval policy", () => {
  it("requires one approver by default", () => {
    const state = resolveApprovalState({
      requiredApproverCount: 1,
      highRiskRequiresSecondApprover: false,
      existingApproverIds: [],
      activeBlockers: [],
      nextApproverId: "user-1",
    });

    expect(state.requiredApproverCount).toBe(1);
    expect(state.approvalCount).toBe(1);
    expect(state.isSatisfied).toBe(true);
  });

  it("requires a second approver when policy marks the release as high risk", () => {
    const state = resolveApprovalState({
      requiredApproverCount: 1,
      highRiskRequiresSecondApprover: true,
      existingApproverIds: [],
      activeBlockers: ["argocd_stale"],
      nextApproverId: "user-1",
    });

    expect(state.requiredApproverCount).toBe(2);
    expect(state.approvalCount).toBe(1);
    expect(state.isSatisfied).toBe(false);
  });

  it("requires an eligible override actor", () => {
    expect(() =>
      assertOverrideEligibility({
        isReleaseOwner: false,
        canOverride: false,
        justification: "Need to bypass freshness block during incident mitigation.",
        ticketUrl: "https://linear.app/example/issue/OPS-123",
      }),
    ).toThrow("override");
  });
});
