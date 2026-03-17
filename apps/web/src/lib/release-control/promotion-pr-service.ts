import type { PromotionPrStatus } from "@repo/shared";

export interface BuildPromotionPrPlanInput {
  applicationSlug: string;
  environment: string;
  forgeGraphRevId: string;
  imageTag?: string | null;
  imageDigest?: string | null;
  deploymentRepo: string;
  deploymentRepoPath: string;
  requestedBy: string;
}

export interface PromotionPrPlan {
  repo: string;
  branch: string;
  title: string;
  commitMessage: string;
  body: string;
  deploymentRepoPath: string;
  metadata: {
    requestedBy: string;
    forgeGraphRevId: string;
    imageTag?: string | null;
    imageDigest?: string | null;
  };
}

export interface PromotionPrState {
  status: PromotionPrStatus;
  prNumber?: number | null;
  mergedAt?: Date | null;
  mergedBy?: string | null;
}

export function buildPromotionPrPlan(
  input: BuildPromotionPrPlanInput,
): PromotionPrPlan {
  const branch = [
    "release",
    input.applicationSlug,
    input.environment,
    input.forgeGraphRevId,
  ].join("/");

  const title = `Promote ${input.applicationSlug} to ${input.environment} (${input.forgeGraphRevId})`;
  const commitMessage = `promote(${input.applicationSlug}): ${input.forgeGraphRevId} to ${input.environment}`;
  const bodyLines = [
    `Promote \`${input.applicationSlug}\` to \`${input.environment}\`.`,
    "",
    `- ForgeGraph revision: \`${input.forgeGraphRevId}\``,
    input.imageTag ? `- Image tag: \`${input.imageTag}\`` : null,
    input.imageDigest ? `- Image digest: \`${input.imageDigest}\`` : null,
    `- Deployment repo path: \`${input.deploymentRepoPath}\``,
    `- Requested by: \`${input.requestedBy}\``,
  ].filter(Boolean);

  return {
    repo: input.deploymentRepo,
    branch,
    title,
    commitMessage,
    body: bodyLines.join("\n"),
    deploymentRepoPath: input.deploymentRepoPath,
    metadata: {
      requestedBy: input.requestedBy,
      forgeGraphRevId: input.forgeGraphRevId,
      imageTag: input.imageTag ?? null,
      imageDigest: input.imageDigest ?? null,
    },
  };
}

export function transitionPromotionPrState(
  current: PromotionPrState,
  update: Partial<PromotionPrState>,
): PromotionPrState {
  return {
    ...current,
    ...update,
    prNumber: update.prNumber ?? current.prNumber ?? null,
    mergedAt: update.mergedAt ?? current.mergedAt ?? null,
    mergedBy: update.mergedBy ?? current.mergedBy ?? null,
  };
}
