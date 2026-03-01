# Linear Clone ForgeGraph Live Spec for Control-Panel (2026-03-01)

Scope: control-panel actions against the live ForgeGraph app in `/Volumes/dev/linear-clone`.

## 1) New/updated callbacks to consume or emit

### Forge callbacks consumed by control-panel from CI/repo workflows

#### A) Build status

- `POST /api/forge/build-status`
- `Content-Type: application/json`
- Auth: one of
  - `Authorization: Bearer <FORGEGRAPH_API_KEY>`
  - `x-api-key: <FORGEGRAPH_API_KEY>`
- Request body:
  - `repoId` (uuid, required)
  - `revId` (string, required)
  - `status` (required): `queued | running | passed | failed | canceled | superseded`
  - optional: `runId`, `stage`, `externalJobId`, `artifactManifestRef`, `imageTag`, `imageDigest`, `issueIds`, `issueIdentifiers`, `commitIds`
- Behavior notes:
  - `issueIds` supports UUIDs only; invalid UUIDs are ignored.
  - If `build` exists and is non-terminal (`queued|running`), status is reused and optional task binding can be added from resolved issueIds.
  - If terminal build exists and `status=queued`, creates a new build row.

#### B) Deployment status

- `POST /api/forge/deployment-status`
- `Content-Type: application/json`
- Auth: same as build callback.
- Request body:
  - `repoId` (uuid, required)
  - `revId` (string, required)
  - `environment` (required): `dev|staging|production|preview`
  - `status` (required): `pending_approval|queued|building|testing|verifying|deploying|healthy|unhealthy|rolled_back|failed`
  - optional: `runId`, `imageTag`, `imageDigest`, `rollbackDeploymentId`, `issueIds`, `issueIdentifiers`, `commitIds`, `metadata`
- Canonicalization:
  - `production` normalizes to `prod`.
  - status values are normalized for common aliases:
    - `in_progress`, `build`, `deploy`, `healthy/success/succeeded`, `rollback`, `rolledback`, `cancelled`, etc.
- Deployment status transitions are enforced with transition map:
  - `pending_approval -> queued|building|testing|deploying|verifying|failed`
  - `queued -> building|deploying|failed`
  - `building -> testing|deploying|failed`
  - `testing -> deploying|verifying|failed`
  - `deploying -> verifying|healthy|unhealthy|failed|rolled_back`
  - `verifying -> healthy|unhealthy|rolled_back|failed`
  - `healthy -> rolled_back`
  - `unhealthy -> rolled_back|failed`
- Auto-funnel stage updates:
  - `staging + healthy -> staging_deployed`
  - `staging + verifying -> staging_verified`
  - `prod + healthy -> production_deployed`
  - `prod + rolled_back -> staging_verified`

#### C) Control-plane rollback confirmation

- `POST /api/webhooks/control-plane`
- Auth: one of
  - `Authorization: Bearer <CONTROL_PLANE_WEBHOOK_TOKEN>`
  - `x-webhook-token: <CONTROL_PLANE_WEBHOOK_TOKEN>`
- Body schema:
  - `source` (`control-plane` | `alertmanager`)
  - `repoId` or `repoName` (one required)
  - `workspaceId` optional
  - `environment`: `dev|staging|production|preview`
  - optional: `sourceDeploymentId`, `sourceRevision`, `rollbackDeploymentId`, `rollbackImageTag`, `reason`, `metadata`
- Behavior notes:
  - resolves source deployment by `sourceDeploymentId` or `sourceRevision` or latest non-rolled_back deployment for env.
  - resolves rollback target using `rollbackDeploymentId` or by `rollbackImageTag`.
  - marks source deploy as `rolled_back` when valid and records issue funnel updates.

## 2) CI intake from control-panel into ForgeGraph (repo side)

- Preferred path: repos call ForgeGraph `forgeGraphV1` tRPC procedures (if authenticated).
- Migration compatibility:
 - webhooks `POST /api/forge/build-status` and `POST /api/forge/deployment-status` accept same CI payload.
- Required repository secrets:
  - `FORGEGRAPH_API_URL`
  - `FORGEGRAPH_API_KEY`

## 3) Left-side funnel integration

- Issue intake endpoint:
  - `POST /api/webhooks/funnel`
  - Auth: `x-funnel-token`
  - Supports low-fidelity capture with:
    - `funnelArtifactType`: `idea|plan|brd|spec|task|pr|release`
    - `funnelStage`: starts at `dumped`
    - `funnelTshirtSize`: `xs|s|m|l|xl|xxl`

- PR and Git event webhooks:
  - `POST /api/webhooks/github`
  - `POST /api/webhooks/gitea`
  - These are existing paths that update issue status/stages and drive event-level transitions used by release/review flow.

## 4) Rollback and alert policy integration

- Keep existing policy engine in control-panel for alert evaluation.
- On approved rollback decision:
  1. send `platform.delivery` workflow/event with `action=rollback` and `rollback_image_tag`
  2. invoke ForgeGraph `POST /api/webhooks/control-plane` with resolved repo/environment and correlation metadata.

## 5) Release cuts and changelog

- Recommended control-panel release action:
  - call `issue.createReleaseCut` with selected issueIds and optional `releaseVersion/releaseTitle`.
  - allow override of generated changelog before publish.
- changelog source behavior in this repo:
  - generated from commit message prefixes, then merged into release artifact record.

## 6) Endpoint compatibility notes

- Legacy compatibility currently supports:
  - `environment=production` as alias for `prod` in rollback and deployment callbacks.
  - status aliases in deployment callback (`in_progress`, `deploy`, `passed`, etc.).

## 7) Operational fields to enforce in control-plane

- Use one correlation id through control-plane run, CI callbacks, and deployment status updates.
- Persist request id for idempotency/replay safety.
- Always send at least one trace key from: `issueIds`, `issueIdentifiers`, `commitIds`, or `imageTag/revId`.
