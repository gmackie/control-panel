type ForgeEvidence = {
  repoId?: string;
  revId?: string;
};

type ArtifactEvidence = {
  imageTag?: string;
  imageDigest?: string;
};

type StagingEvidence = {
  syncStatus?: string;
  healthStatus?: string;
};

export interface AssembleReleaseCandidateInput {
  forge?: ForgeEvidence;
  artifact?: ArtifactEvidence;
  staging?: StagingEvidence;
  blockers?: Array<{ severity: "hard" | "advisory"; reason: string }>;
}

export interface ReleaseCandidateDraft {
  forgeGraphRepoId: string | null;
  forgeGraphRevId: string | null;
  imageTag: string | null;
  imageDigest: string | null;
  queueState: "building" | "ready" | "blocked";
  supersedeStatus: "current" | "superseded";
  knownGoodStatus: "unknown" | "candidate" | "known_good";
}

export function deriveCandidateQueueState(
  input: AssembleReleaseCandidateInput,
): ReleaseCandidateDraft["queueState"] {
  const hasHardBlocker = (input.blockers || []).some(
    (blocker) => blocker.severity === "hard",
  );

  if (hasHardBlocker) {
    return "blocked";
  }

  if (!input.artifact?.imageDigest || !input.artifact?.imageTag) {
    return "building";
  }

  if (
    input.staging?.syncStatus === "Synced" &&
    input.staging?.healthStatus === "Healthy"
  ) {
    return "ready";
  }

  return "building";
}

export function deriveSupersedeStatus(): ReleaseCandidateDraft["supersedeStatus"] {
  return "current";
}

export function deriveKnownGoodStatus(): ReleaseCandidateDraft["knownGoodStatus"] {
  return "unknown";
}

export function assembleReleaseCandidate(
  input: AssembleReleaseCandidateInput,
): ReleaseCandidateDraft {
  return {
    forgeGraphRepoId: input.forge?.repoId || null,
    forgeGraphRevId: input.forge?.revId || null,
    imageTag: input.artifact?.imageTag || null,
    imageDigest: input.artifact?.imageDigest || null,
    queueState: deriveCandidateQueueState(input),
    supersedeStatus: deriveSupersedeStatus(),
    knownGoodStatus: deriveKnownGoodStatus(),
  };
}
