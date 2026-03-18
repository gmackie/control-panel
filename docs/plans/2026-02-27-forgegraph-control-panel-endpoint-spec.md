# ForgeGraph + Control-Panel Integration Spec (v1)

Date: 2026-02-27

This file is the implementation spec for the control-panel team so they can wire CI/release/change-management workflows around this ForgeGraph model.

## What this release assumes

ForgeGraph is the canonical delivery data plane.

- Issue funnel is the left side intake. Tiny “idea” records are valid and expected.
- PRs are lifecycle events, not separate issue record types.
- PR history is append-only, and latest pointer is represented by issue git link + status changes.
- Releases are approved in control-panel, then staged on ForgeGraph deployment state.
- Rollback events are initiated from alerts/policies and sent to ForgeGraph control-plane webhook.

## Endpoints the control-panel team should provide / use

### 1) Intake into funnel

| System | Endpoint | Method | Auth | Notes |
| --- | --- | --- | --- | --- |
| control-panel -> ForgeGraph | `/api/webhooks/funnel` | POST | `x-funnel-token` | Creates dumped/triaged task-like issues from low-fidelity sources. |

Payload contract (minimum):

```json
{
  "projectId": "uuid",
  "title": "Short idea sentence",
  "description": "Optional extra context",
  "type": "issue",
  "funnelSourceType": "sentry",
  "funnelSourceUrl": "https://sentry.io/...",
  "funnelArtifactType": "idea",
  "funnelStage": "dumped",
  "funnelTshirtSize": "m"
}
```

`funnelTshirtSize` is expected to be one of `xs | s | m | l | xl | xxl`.
`funnelArtifactType` supports at least `idea`, `plan`, `brd`, `spec`, `task`, `release`.

### 2) Repo CI status ingestion

Control-plane standard remains tRPC-first in ForgeGraph:

- Base URL: `<FORGEGRAPH_API_URL>/api/trpc`
- Key header: `x-api-key: <FORGEGRAPH_API_KEY>` where key starts with `lc_`
- API namespace: `forgeGraphV1`
- Envelope contract: [docs/plans/2026-02-12-forgegraph-api-contract-v1.md](./../plans/2026-02-12-forgegraph-api-contract-v1.md)

Control-panel workflow generators should execute all repos with one of these patterns:

- Option A (preferred): Use `forgeGraphV1` mutations directly from CI scripts.
- Option B (compatibility): Keep temporary compatibility scripts that call compatibility endpoints until migration complete.

Procedures that every repo must call:

- `forgeGraphV1.build.trigger({ repoId, revId, runId, idempotencyKey, taskId?, ciProvider?, stackKey? })`
- `forgeGraphV1.build.updateStatus({ buildId, status, externalJobId?, imageDigest?, artifactManifestRef? })`
- `forgeGraphV1.build.attachArtifact({ buildId, type, digest?, storageKey, sizeBytes?, metadata? })`
- `forgeGraphV1.deployment.create({ repoId, revId, buildId, environment, rollbackTargetDeploymentId? })`
- `forgeGraphV1.deployment.updateStatus({ deploymentId, status })`
- `forgeGraphV1.revision.requestIndex({ repoId, revId, changeId?, description?, parentRevIds?, bookmarks?, metadata? })`

`build.trigger` and `build.updateStatus` are idempotency-sensitive.
For a retry-safe replay strategy, CI should always retry with the same `idempotencyKey`, `runId`, and deployment intent.

Status transitions for deployment must follow:

- `pending_approval -> queued -> building -> testing -> deploying -> verifying -> healthy`
- `deploying -> unhealthy -> rolled_back`
- `verifying -> rolled_back`
- transitions to `failed` stop the path.

### 3) Rollback callback from control-plane

Control-panel must call this endpoint when manual or policy-triggered rollback should be applied:

- `POST /api/webhooks/control-plane` on ForgeGraph
- Auth header: `Authorization: Bearer <CONTROL_PLANE_WEBHOOK_TOKEN>` or `x-webhook-token`

Payload schema:

```json
{
  "source": "control-plane",
  "repoName": "owner/repo",
  "environment": "production",
  "rollbackImageTag": "sha-rollback",
  "reason": "Alert-based rollback",
  "metadata": {
    "alertname": "api-5xx-slo",
    "fingerprint": "abc123",
    "correlationId": "trace-... "
  }
}
```

Notes:

- `environment` must match the ForgeGraph deployment enum for now. Use `prod` where possible and treat `production` as a compatibility alias to avoid mismatch.
- Include explicit `correlationId` and `sourceEventId` fields for audit.
- This endpoint must be idempotent where possible and should always return the resolved target deployment when successful.

### 4) Prometheus-driven rollback policy path

Control-panel should keep / extend existing `/api/webhooks/prometheus/alerts`.
Control-panel can evaluate policy there and then invoke the control-plane rollback callback above.

Required minimum alert fields:

- `labels.alertname`
- `labels.severity`
- `labels.namespace`
- `labels.pod`
- `annotations.summary`
- `annotations.description`
- `annotations.runbook_url` (optional)
- `fingerprint`
- `status`
- `startsAt`
- `generatorURL`

### 5) Delivery event trigger contract (how control-panel starts CI)

Control-panel should continue to drive repo workflows with:

- `platform.delivery` repository dispatch payload (`staging` and `production` promotion path).
- action `deploy` or `rollback`.
- release image reuse for production promotion.
- `deploy_k8s`/`deploy_vercel`/`deploy_cloudflare` toggles.

## Change-management alignment for releases

Control-panel should call the ForgeGraph release procedure during release cut:

- `issue.createReleaseCut({ projectId, issueIds, releaseVersion?, releaseTitle? })`
- release changelog is generated from commit message prefix parsing (Conventional Commit style).
- issue IDs included should represent funnel artifacts being released.
- allow manual changelog override before publication by updating the release issue description in the control-plane.

## Repo/workspace provisioning expectations

For each managed repo:

- Store ForgeGraph `repoId` or stable `repoName` in app metadata.
- Store CI provider webhooks that feed ForgeGraph `/api/webhooks/github` and `/api/webhooks/gitea`.
- Set repo-level secrets: `FORGEGRAPH_API_URL`, `FORGEGRAPH_API_KEY`, `GIT_SHA`, `K8S_*`, and alert rollback tokens.
- Set alerting target to control-panel for policy evaluation, not directly to ForgeGraph.

## Operational conventions to lock now

- Use one canonical correlation id per CI run and include it in build/deploy inputs.
- Include `buildId` and `deploymentId` when emitting status checkpoints.
- Emit `taskId` when a task has claimed a CI run so stage transitions can map back into funnel (`staging_deployed`, `staging_verified`, `production_deployed`).
- For every control-plane event, return deterministic status codes and include source/deployment metadata in response bodies.

## Events this ForgeGraph build now guarantees (required for external systems)

- `issue.created` when `/api/webhooks/funnel` successfully persists a new left-side idea.
- `issue.status_changed` on PR lifecycle changes and issue sync events.
- `issue.completed` when status transitions to `done`.
- `issue.funnel_stage_changed` when stage moves forward for PR and deployment lifecycle updates.

Payload follows `WebhookPayload` from `@linear-clone/api/src/services/outbound-webhook.ts` and includes:

```json
{
  "event": "issue.status_changed",
  "timestamp": "2026-02-27T12:00:00.000Z",
  "workspace": { "id": "uuid", "name": "Acme", "slug": "acme" },
  "project": { "id": "uuid", "name": "App", "key": "APP" },
  "issue": { "id": "uuid", "identifier": "APP-12", "title": "...", "status": "in_review", "funnelStage": "picked_up", "funnelArtifactType": "pr", "funnelTshirtSize": null, "createdAt": "...", "updatedAt": "..." },
  "changes": { "field": "status", "from": "in_progress", "to": "in_review" }
}
```

### Control-panel responsibilities around ForgeGraph outbound events

- Register one or more outbound webhooks per workspace that subscribe to the events above.
- Treat `funnelArtifactType` as the primary intent discriminator (`idea`, `plan`, `brd`, `spec`, `task`, `pr`, `release`).
- Treat `funnelStage` as the canonical execution/progression signal (`picked_up` → `staging_deployed` → `staging_verified` → `production_deployed`).

## Control-plane & rollback endpoint contract

Control-panel must call:

- `POST /api/webhooks/control-plane` (ForgeGraph)
  - headers: `Authorization: Bearer <CONTROL_PLANE_WEBHOOK_TOKEN>` or `x-webhook-token`
  - body:

```json
{
  "source": "control-plane",
  "repoName": "owner/repo",
  "environment": "production",
  "rollbackImageTag": "sha256:...",
  "reason": "Alert-based rollback",
  "correlationId": "run-uuid",
  "sourceEventId": "alert-fingerprint"
}
```

Response should return resolved source/target deployment ids and be idempotent for repeated alarms.

Alert-driven flow for Prometheus/Alertmanager:

- control-panel should receive alerts locally, enforce policy, then invoke the above endpoint.
- Required fields for policy correlation: `labels.alertname`, `labels.severity`, `labels.namespace`, `labels.pod`, `annotations.summary`, `annotations.description`, `annotations.runbook_url`.

## Required CI handoff between control-panel and ForgeGraph

Repo-level CI adapters should call ForgeGraph through either:

- tRPC endpoints under `forgeGraphV1` (`forgeBuild`, `forgeDeployment`, `issue.createReleaseCut`), or
- equivalent compatibility scripts during migration.

Per change:

- `forgeBuild.trigger` with `idempotencyKey`.
- `forgeBuild.updateStatus`.
- `forgeBuild.attachArtifact` for container image/manifests.
- `forgeDeployment.create` for staged/prod deployment intent.
- `forgeDeployment.updateStatus` on deploy transitions.
- `issue.createReleaseCut` once issue set and changelog is approved.

## Release and changelog generation contract

- control-panel should provide a release candidate list using issue IDs and optional `releaseVersion`/`releaseTitle`.
- ForgeGraph computes changelog sections from commit messages on linked commits (Conventional Commit parsing implemented).
- For reproducibility, control-panel should persist the selected issue IDs and allow edits before final publication.
