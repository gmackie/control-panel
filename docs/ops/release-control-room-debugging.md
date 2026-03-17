# Release Control Room Debugging

This guide covers common failure modes in the release control room.

## Symptom: Candidate Missing From Queue

Check:

- `release_candidates` row exists
- ForgeGraph and image metadata correlate on the same revision
- queue state is not filtered out
- the app is mapped to a known `applications` record

Likely causes:

- missing artifact
- unmapped revision
- failed candidate assembly

## Symptom: Trust Banner Shows Degraded

Check:

- `source_health` rows for ArgoCD, Harbor, Prometheus, Kubernetes, and Gitea
- freshness thresholds in `release_policies`
- recent reconciler success times

Likely causes:

- stale source polling
- webhook gaps not repaired yet
- upstream outage

## Symptom: Candidate Stuck Awaiting Approval

Check:

- `release_owners` assignments for the app and environment
- `release_policies.requiredApproverCount`
- whether a high-risk blocker forces a second approver
- approval snapshots in `candidate_evidence`

Likely causes:

- missing approver
- duplicate approval attempt by the same user
- blocker still present

## Symptom: Promotion PR Open But No Rollout

Check:

- deployment repo PR status
- merge status
- ArgoCD sync revision and application health
- deployment repo path in `environment_states`

Likely causes:

- PR not merged
- wrong deployment repo path
- ArgoCD not reconciling the expected app

## Symptom: Rollback Assistant Has No Suggestion

Check:

- `known_good_releases`
- candidate `knownGoodStatus`
- whether any release completed the observation window
- whether a release was manually pinned

Likely causes:

- no known-good candidate exists yet
- pilot app has not completed a clean production cycle
- known-good status was cleared during manual intervention

## Useful Verification Commands

```bash
pnpm --filter @repo/api test -- tests/release-queue-router.test.ts
pnpm --filter @repo/web test -- tests/unit/rollback-service.test.ts tests/unit/notification-triggers.test.ts
pnpm --filter @repo/web typecheck
```
