export interface ResolveApprovalStateInput {
  requiredApproverCount: number;
  highRiskRequiresSecondApprover: boolean;
  existingApproverIds: string[];
  activeBlockers: string[];
  nextApproverId: string;
}

export interface ResolveApprovalStateResult {
  requiredApproverCount: number;
  approvalCount: number;
  isSatisfied: boolean;
  isDuplicateApproval: boolean;
}

export interface OverrideEligibilityInput {
  isReleaseOwner: boolean;
  canOverride: boolean;
  justification: string;
  ticketUrl: string;
}

export function resolveApprovalState(
  input: ResolveApprovalStateInput,
): ResolveApprovalStateResult {
  const requiredApproverCount = Math.max(
    input.requiredApproverCount,
    input.highRiskRequiresSecondApprover && input.activeBlockers.length > 0 ? 2 : 1,
  );

  const approverIds = new Set(input.existingApproverIds);
  const isDuplicateApproval = approverIds.has(input.nextApproverId);
  approverIds.add(input.nextApproverId);

  return {
    requiredApproverCount,
    approvalCount: approverIds.size,
    isSatisfied: approverIds.size >= requiredApproverCount,
    isDuplicateApproval,
  };
}

export function assertOverrideEligibility(
  input: OverrideEligibilityInput,
): true {
  if (!input.isReleaseOwner || !input.canOverride) {
    throw new Error("override requires an eligible release owner");
  }

  if (!input.justification.trim()) {
    throw new Error("override requires a typed justification");
  }

  if (!input.ticketUrl.trim()) {
    throw new Error("override requires a ticket or incident link");
  }

  return true;
}
