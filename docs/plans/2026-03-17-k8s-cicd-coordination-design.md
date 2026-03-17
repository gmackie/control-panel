# Kubernetes Release Control Room Design

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Turn `control-panel` into the release control room for supported application releases on Kubernetes staging and production

## Problem

`control-panel` already has useful delivery pieces:

- ForgeGraph callback endpoints in `apps/web/src/app/api/forge/`
- ArgoCD, Harbor, and Alertmanager webhook handlers in `apps/web/src/app/api/webhooks/`
- CI/CD visibility routers in `packages/api/src/routers/`
- event persistence in `packages/webhooks/src/event-store.ts`
- deployment and application metadata in `packages/db/src/schema.ts`

But the current system is still a visibility patchwork:

- build, artifact, deployment, and runtime signals are stored separately
- deployment history is not the same thing as a releaser-facing release model
- production approval is not tied to a concrete GitOps promotion path
- source freshness and trust are not modeled explicitly
- monitoring and incident signals are not attached to a releaser-friendly candidate

The current UI can answer fragments of the release question. It cannot yet answer the full operator question:

`What is the next release candidate for this app, why is it or is it not safe to promote, what exact GitOps change will ship, who approved it, what is live now, and what should we roll back to if production degrades?`

## Product Decision

This is no longer just a CI/CD coordination dashboard.

It is a **Release Control Room** with these characteristics:

- hero user: the releasing engineer
- primary surface: a candidate-centered release queue
- deployment authority: ArgoCD
- promotion mechanism: PRs to a separate deployment repo that ArgoCD watches
- final production gate: human merge by an authorized release owner
- future option: selected auto-merge flows after trust is established

## Operating Model

### Source-of-truth boundaries

Authoritative ownership remains:

- `ForgeGraph`: repo and revision lineage (`repoId`, `revId`, optional JJ metadata)
- `Gitea`: CI workflow execution state
- `Harbor`: published image artifacts
- `deployment repo`: desired GitOps state for environments
- `ArgoCD`: reconciled desired/live deployment state
- `Kubernetes`: live workload state
- `Prometheus` and `Alertmanager`: runtime health and incident signals

`control-panel` adds:

- evidence collection and normalization
- release candidate assembly
- promotion readiness evaluation
- production approval and override policy
- promotion PR generation and tracking
- rollout verification and incident linkage
- assisted rollback guidance

### Standard release path

All supported app releases converge on one path:

`JJ / ForgeGraph revision -> CI build -> image publish -> release candidate -> staging verification -> promotable -> promotion PR -> production merge -> ArgoCD rollout -> production verification -> known-good`

### Promotion posture

Production promotion is evidence-gated and human-governed.

A candidate becomes promotable only when:

1. required CI evidence is green
2. the release artifact exists
3. staging rollout is healthy
4. the staging observation window passes
5. critical evidence is fresh
6. no hard blocker policy is active

Then:

1. a release owner approves
2. `control-panel` opens a promotion PR in the deployment repo
3. the production approver merges that PR
4. ArgoCD reconciles
5. `control-panel` verifies rollout health

### Blockers and overrides

Promotion policy is mixed:

- some signals are hard blockers
- some are advisory
- restricted release owners may override specific blockers
- overrides require a typed reason and incident or ticket link

## Core Domain Model

The control room should be built around these first-class entities.

### 1. Release candidate

The releaser-facing unit of work.

Required fields:

- `applicationId`
- `forgeGraphRepoId`
- `forgeGraphRevId`
- optional `jjChangeId`
- `gitSha`
- `branch`
- `ciRunId`
- `imageTag`
- `imageDigest`
- `status`
- `supersedeStatus`
- `readinessStatus`
- `knownGoodStatus`

This is the answer to:

`What version are we considering releasing?`

### 2. Candidate evidence

The normalized proof attached to a candidate.

Evidence types:

- CI result
- artifact publication
- staging rollout status
- ArgoCD desired/live data
- Kubernetes readiness
- Prometheus / Alertmanager health
- approval snapshots
- override snapshots

This is the answer to:

`Why does the system believe this candidate is ready, blocked, or degraded?`

### 3. Environment state

Environment-centric truth, separate from candidate readiness.

Required fields:

- `applicationId`
- `environment`
- `clusterName`
- `namespace`
- `workloadName`
- `argoAppName`
- `deploymentRepoPath`
- `desiredCandidateId`
- `liveCandidateId`
- `desiredImage`
- `liveImage`
- `driftStatus`
- `lastObservedAt`

This is the answer to:

`What should be live in staging/production, what is actually live, and are they drifting?`

### 4. Promotion PR

The concrete GitOps actuation object.

Required fields:

- `candidateId`
- `applicationId`
- `environment`
- `repo`
- `branch`
- `prNumber`
- `headSha`
- `status`
- `mergePolicy`
- `openedBy`
- `mergedBy`
- `openedAt`
- `mergedAt`

This is the answer to:

`What exact GitOps change is carrying this release into production?`

### 5. Release policy

Per app and environment control rules.

Required fields:

- `applicationId`
- `environment`
- `requiredApproverCount`
- `eligibleApproverSet`
- `highRiskRequiresSecondApprover`
- `overrideAllowed`
- `overrideEligibleSet`
- freshness thresholds by source
- blocker policy definitions

### 6. Release owner

Control-room-owned approver identity.

Required fields:

- `applicationId`
- `environment`
- `userId`
- `role`
- `canApprove`
- `canOverride`
- `canMerge`

### 7. Override record

The auditable exception path.

Required fields:

- `candidateId`
- `environment`
- `blockerReason`
- `approvedBy`
- `justification`
- `ticketUrl`
- `snapshot`
- `createdAt`

### 8. Known-good release

Rollback-safe release memory.

Required fields:

- `candidateId`
- `applicationId`
- `environment`
- `reason`
- `pinnedBy`
- `becameKnownGoodAt`
- `pinnedAt`

### 9. Source health

The control room’s own trust model.

Required fields:

- `source`
- `status`
- `lastSuccessAt`
- `lastObservedAt`
- `maxFreshnessSeconds`
- `lastError`

## State Machines

### Release candidate state machine

```text
discovered
  -> building
  -> ready_for_staging
  -> staging_verifying
  -> staging_healthy
  -> promotable
  -> awaiting_approval
  -> promotion_pr_open
  -> releasing
  -> production_verifying
  -> production_healthy
  -> known_good

shadow states:
  -> blocked
  -> degraded
  -> outdated
  -> superseded
  -> rollback_candidate
```

### Promotion PR state machine

```text
requested
  -> creating
  -> open
  -> merge_blocked
  -> merged

side states:
  -> failed
  -> closed_unmerged
  -> superseded
```

### Environment state machine

```text
aligned
  -> pending_gitops_change
  -> desired_updated
  -> argocd_syncing
  -> live_converging
  -> healthy

side states:
  -> drifted
  -> degraded
  -> stale
```

## Architecture

```text
ForgeGraph/JJ   Gitea CI   Harbor   Deploy Repo   ArgoCD   Prometheus   Kubernetes
     |             |         |          |           |          |            |
     +-------------+---------+----------+-----------+----------+------------+
                                     |
                                     v
                        +---------------------------+
                        | Intake + Reconcile Layer  |
                        | webhooks + background jobs|
                        +---------------------------+
                                     |
                                     v
                        +---------------------------+
                        | Evidence Ledger           |
                        | raw + normalized events   |
                        | matched/orphaned/ambiguous|
                        +---------------------------+
                           |                     |
                           v                     v
               +----------------------+   +----------------------+
               | Release Candidates   |   | Environment State    |
               | candidate readiness  |   | desired/live/drift   |
               +----------------------+   +----------------------+
                           |                     |
                           +----------+----------+
                                      |
                                      v
                        +---------------------------+
                        | Policy + Readiness Engine |
                        | blockers, freshness, risk |
                        +---------------------------+
                                      |
                                      v
                        +---------------------------+
                        | Promotion Controller      |
                        | approval -> promotion PR  |
                        +---------------------------+
                                      |
                                      v
                        +---------------------------+
                        | Rollout + Verification    |
                        | reconcile, observe, link  |
                        +---------------------------+
                                      |
                                      v
                        +---------------------------+
                        | Assisted Rollback         |
                        | suggest known-good target |
                        +---------------------------+
```

## Primary UX

### Release queue

The default screen should be a candidate-centered queue for the releasing engineer.

Queue states:

- `building`
- `ready`
- `blocked`
- `awaiting approval`
- `releasing`
- `degraded`

Each candidate row should show:

- app name
- revision and image identity
- staging status
- production status
- readiness status
- explicit blocker cards
- promotion diff summary
- current next action

### Blocker cards

Blocked candidates should never show only a red badge.

Each blocker card should include:

- blocker name
- blocker type (`hard` or `advisory`)
- evidence source
- freshness status
- next-step guidance
- override eligibility

### Trust banner

The control room should have a global trust banner showing:

- which upstream sources are healthy
- which are stale
- whether the queue is running with degraded confidence

### Audit trail

Each candidate and rollout should show:

- approvers
- blockers at approval time
- override records
- promotion PR links
- approval evidence snapshot
- current live state beside historical snapshot

### Incident linkage

When production degrades, the control room should show probable-cause hints:

- suspected release candidate
- timing overlap
- linked alerts and incidents
- suggested rollback candidate

## Pull Plus Push, Explicitly

Push is for low-latency updates.

Pull is for correctness.

Required built-in reconciler jobs:

- `candidate-ingest-reconciler`
- `promotion-pr-reconciler`
- `argocd-rollout-reconciler`
- `source-freshness-reconciler`
- `known-good-evaluator`
- `rollback-suggestion-evaluator`

These jobs are part of the product, not implementation detail.

## Freshness Gates

Critical evidence must have max-age rules.

Examples:

- CI freshness
- artifact freshness
- ArgoCD desired/live freshness
- Kubernetes readiness freshness
- Prometheus and Alertmanager freshness

If freshness is violated:

- the queue shows degraded trust
- the affected candidate becomes blocked or override-only
- the audit trail records the stale evidence condition

## Supersede Rules

Newer candidates may soft-supersede older open candidates.

That means:

- older candidates can become `outdated`
- open promotion PRs for outdated candidates must show warnings or merge guards
- humans may reconfirm older candidates when necessary

## Rollback Posture

Rollback is assisted, not automatic in v1.

The system should:

- suggest the last known-good release candidate
- show why that candidate is considered known-good
- open the rollback PR after human confirmation
- record rollback rationale in the audit trail

Known-good should come from:

- a healthy observation window
- optional human pinning

## Scope Boundary

v1 is for supported application releases only.

Not in scope for this phase:

- full platform-change control room
- auto-rollback
- full stakeholder release brief generation
- universal infra change modeling

## Success Criteria

The release control room succeeds when a releasing engineer can:

1. see all candidate releases in one queue
2. know exactly why a candidate is ready or blocked
3. inspect the exact production diff before promotion
4. approve and open a promotion PR without leaving the control room
5. trust whether upstream evidence is fresh
6. explain who approved a release and what evidence they saw
7. identify the most likely bad release and suggested rollback target during an incident

## Current Code Anchors

This design should extend, not replace, these existing assets:

- `packages/db/src/schema.ts`
- `packages/webhooks/src/event-store.ts`
- `packages/api/src/lib/argocd-client.ts`
- `apps/web/src/app/api/forge/build-status/route.ts`
- `apps/web/src/app/api/forge/deployment-status/route.ts`
- `apps/web/src/app/api/webhooks/argocd/route.ts`
- `apps/web/src/app/api/webhooks/harbor/route.ts`
- `apps/web/src/app/api/webhooks/prometheus/alerts/route.ts`
- `apps/web/src/app/deployments/page.tsx`
- `apps/web/src/app/deployments/timeline/page.tsx`
- `apps/web/src/components/deployments/ApprovalWorkflow.tsx`
