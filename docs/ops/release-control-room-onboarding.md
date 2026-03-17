# Release Control Room Onboarding

This guide describes how to onboard one supported application into the release control room.

## Prerequisites

- The app has an `applications` row in `control-panel`.
- The app produces a stable ForgeGraph `repoId` and `revId`.
- CI publishes a traceable image tag or digest.
- ArgoCD manages the app through a deployment repo path that can be promoted with a PR.
- At least one release owner and one approver are defined for the target environment.

## Required Metadata

Populate or confirm the following release-control records:

- `release_candidates`
- `environment_states`
- `release_policies`
- `release_owners`
- `source_health`

Each onboarded app/environment pair needs:

- app slug
- ForgeGraph repo identifier
- ArgoCD application name
- cluster and namespace
- deployment repo path
- target environment name
- approval and override policy

## Deployment Repo Wiring

For each environment:

1. Identify the deployment repo ArgoCD watches.
2. Identify the file or values path that controls the deployable revision or image.
3. Confirm the promotion PR service can write a deterministic branch and commit message.
4. Confirm merged PRs are reconciled by ArgoCD without manual mutation.

## Release Owner Setup

Create release-owner assignments with clear responsibilities:

- releaser: drives queue review and promotion prep
- approver: gives production approval
- override-capable owner: can override hard blockers with justification and a ticket or incident link

Recommended minimum:

- one approver for staging
- one approver plus one backup for production
- at least one override-capable owner for production hotfixes

## Freshness and Trust Setup

Before enabling production use, confirm freshness thresholds for:

- Gitea CI evidence
- Harbor image evidence
- ArgoCD desired/live state
- Prometheus or Alertmanager health
- Kubernetes ready-state evidence

If these are not configured, the trust banner will not accurately block stale evidence.

## First Launch Sequence

1. Enable candidate assembly and source trust for staging only.
2. Verify the app appears in `/deployments` with a candidate row.
3. Verify blocker cards and promotion diff render correctly.
4. Approve a staging-ready candidate and confirm the approval snapshot is stored.
5. Open a production promotion PR and verify ArgoCD observes the merged desired state.
6. Confirm the candidate can become known-good after the observation window.

## Exit Criteria

The app is fully onboarded when:

- release queue row is visible
- trust banner reflects real upstream source status
- approval path works
- promotion PR path works
- audit trail is populated
- rollback assistant can identify a known-good target
