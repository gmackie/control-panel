# Release Control Room Operations

This runbook describes the normal operator workflow for staging and production releases.

## Daily Operating Loop

1. Open `/deployments`.
2. Check the trust banner before trusting any green candidate.
3. Filter the queue to `Ready`, `Blocked`, or `Awaiting Approval`.
4. Inspect the promotion diff for the candidate you want to move.
5. Review blocker cards, audit evidence, and probable-cause hints.
6. Approve or request a second approval if policy requires it.
7. Open or merge the deployment-repo promotion PR.
8. Watch for rollout degradation and confirm the observation window completes.

## Promotion Flow

The intended production path is:

1. JJ or ForgeGraph revision appears
2. CI succeeds
3. image is published
4. staging evidence becomes healthy
5. candidate becomes promotable
6. approver approves in the control room
7. deployment repo PR is opened
8. PR is merged
9. ArgoCD reconciles
10. runtime health stays clean through the observation window
11. release becomes known-good

## Soft Supersede Rules

If a newer candidate becomes available:

- the older candidate is marked as superseded or outdated
- releasers should reconfirm before merging an older promotion PR
- rollback suggestions should still prefer a known-good target, not merely the newest target

## Override Flow

Use overrides sparingly.

Requirements:

- actor must be an eligible release owner
- typed justification is required
- ticket or incident link is required

Recommended override cases:

- emergency hotfix during an active production incident
- source freshness degraded but independently verified by operators
- temporary blocker misclassification after manual inspection

## Rollback Flow

Rollback remains human-confirmed in v1.

1. Open the affected candidate in the release queue.
2. Review probable-cause hints and audit trail.
3. Check the rollback assistant suggestion.
4. Confirm the known-good target.
5. Generate the rollback PR.
6. Merge the rollback PR.
7. Confirm ArgoCD converges and the incident is stabilizing.

## Notifications

The release control room should send deep-linked notifications for:

- candidate ready
- candidate blocked
- awaiting approval
- promotion PR merged
- release degraded
- candidate superseded

Notifications should bring operators back into `/deployments`, not allow remote approval or merge.
