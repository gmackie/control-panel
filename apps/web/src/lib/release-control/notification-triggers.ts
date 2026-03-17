import type { CreateNotification } from "@/lib/notifications/types";

type ReleaseControlEventKind =
  | "candidate_ready"
  | "candidate_blocked"
  | "awaiting_approval"
  | "promotion_pr_merged"
  | "release_degraded"
  | "candidate_superseded";

export interface ReleaseControlEvent {
  kind: ReleaseControlEventKind;
  applicationSlug: string;
  candidateId: string;
  forgeGraphRevId: string;
  environment: string;
}

const EVENT_CONFIG: Record<
  ReleaseControlEventKind,
  {
    severity: CreateNotification["severity"];
    title: (event: ReleaseControlEvent) => string;
    message: (event: ReleaseControlEvent) => string;
    targetRoles: string[];
  }
> = {
  candidate_ready: {
    severity: "info",
    title: (event) => `${event.applicationSlug} ready for ${event.environment}`,
    message: (event) =>
      `Candidate ${event.forgeGraphRevId} is ready for operator review in the release queue.`,
    targetRoles: ["releaser"],
  },
  candidate_blocked: {
    severity: "warning",
    title: (event) => `${event.applicationSlug} blocked in ${event.environment}`,
    message: (event) =>
      `Candidate ${event.forgeGraphRevId} is blocked and needs investigation before promotion.`,
    targetRoles: ["releaser", "release-owner"],
  },
  awaiting_approval: {
    severity: "info",
    title: (event) => `${event.applicationSlug} awaiting approval`,
    message: (event) =>
      `Candidate ${event.forgeGraphRevId} is promotable and awaiting approval in ${event.environment}.`,
    targetRoles: ["approver", "release-owner"],
  },
  promotion_pr_merged: {
    severity: "info",
    title: (event) => `${event.applicationSlug} promotion merged`,
    message: (event) =>
      `The deployment repo promotion PR for ${event.forgeGraphRevId} was merged for ${event.environment}.`,
    targetRoles: ["releaser", "approver"],
  },
  release_degraded: {
    severity: "error",
    title: (event) => `${event.applicationSlug} degraded after release`,
    message: (event) =>
      `The release path for ${event.forgeGraphRevId} is degraded and may require rollback analysis.`,
    targetRoles: ["release-owner", "approver"],
  },
  candidate_superseded: {
    severity: "warning",
    title: (event) => `${event.applicationSlug} candidate superseded`,
    message: (event) =>
      `Candidate ${event.forgeGraphRevId} has been superseded by a newer release candidate.`,
    targetRoles: ["releaser"],
  },
};

export function buildReleaseControlNotification(
  event: ReleaseControlEvent,
): CreateNotification {
  const config = EVENT_CONFIG[event.kind];

  return {
    source: "release-control-room",
    category: "deployment",
    severity: config.severity,
    title: config.title(event),
    message: config.message(event),
    appName: event.applicationSlug,
    environment: event.environment,
    links: [
      {
        label: "Open release queue",
        url: `/deployments?candidateId=${event.candidateId}`,
      },
    ],
    metadata: {
      candidateId: event.candidateId,
      forgeGraphRevId: event.forgeGraphRevId,
      targetRoles: config.targetRoles,
      eventKind: event.kind,
    },
    groupKey: `release-control-room:${event.kind}:${event.applicationSlug}:${event.environment}`,
  };
}
