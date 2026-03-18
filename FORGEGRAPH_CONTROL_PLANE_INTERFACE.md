# ForgeGraph / control-plane integration interface

Control-plane (in this repo, `/Volumes/dev/control-panel`) should integrate with ForgeGraph via three external touchpoints:

- Legacy build updates from CI (`/api/forge/build-status`)
- Legacy deployment updates from CI and environment runners (`/api/forge/deployment-status`)
- Rollback callbacks sent from control-plane to ForgeGraph for source deployment lifecycle finalization (`/api/webhooks/control-plane`)
- Prometheus alert bridge entrypoint (`/api/webhooks/prometheus/alerts`) that normalizes Alertmanager alerts before forwarding to `/api/webhooks/control-plane`

## Shared conventions

- All callbacks use bearer-style tokens or API key headers as accepted by the ForgeGraph endpoint.
- Issue/context resolution in ForgeGraph is now resilient to partial context via optional fields:
  - `issueIds`
  - `issueIdentifiers`
  - `commitIds`
- Deployment/task resolution fallback order:
  - direct build binding (`forgeBuilds.taskId`)
  - commit links (`issue_git_links` where `type = "commit"` and `external_id` matches revision/image tags)

## 1) CI build callback

POST to: `/api/forge/build-status`

Required fields:

- `repoId` (UUID)
- `revId` (string)
- `status` (queued | running | passed | failed | canceled | superseded)

Optional recommended fields:

- `runId`
- `stage`
- `externalJobId`
- `artifactManifestRef`
- `imageTag`
- `imageDigest`
- `issueIds`
- `issueIdentifiers`
- `commitIds`

## 2) Deployment lifecycle callback

POST to: `/api/forge/deployment-status`

Required fields:

- `repoId` (UUID)
- `revId` (string)
- `environment` (`dev` | `staging` | `production` | `preview`)
- `status` (pending_approval | queued | building | testing | verifying | deploying | healthy | unhealthy | rolled_back | failed)

Optional recommended fields:

- `runId`
- `imageTag`
- `imageDigest`
- `rollbackDeploymentId`
- `issueIds`
- `issueIdentifiers`
- `commitIds`
- `metadata`

Expected status transitions should match ForgeGraph status machine.

## 3) Rollback callback into ForgeGraph

Control-plane should call:

`POST /api/webhooks/control-plane`

Headers:

- `authorization: Bearer <CONTROL_PLANE_WEBHOOK_TOKEN>` or `x-webhook-token`

Body:

- `source` (`control-plane` | `alertmanager`, optional in app payloads)
- `repoId` or `repoName`
- `workspaceId` (optional)
- `environment` (`dev` | `staging` | `production` | `preview`, defaults to production)
- `sourceDeploymentId` (optional)
- `sourceRevision` (optional)
- `rollbackDeploymentId` (optional)
- `rollbackImageTag` (optional)
- `reason` (optional)

ForgeGraph will:
- resolve source deployment for the request,
- resolve target rollback deployment,
- move source deployment to `rolled_back` when needed,
- update associated issue funnel stage(s) to `staging_verified`.

## Alertmanager integration note

- Alertmanager webhooks may be transformed into the same control-plane webhook schema and sent to control-plane first.
- control-plane should continue to gate and authorize rollback.
- approved rollbacks are then forwarded to repos for action and to ForgeGraph via this same endpoint when state changes are observed.

## 4) Prometheus/Alertmanager bridge endpoint

Control-plane should call:

`POST /api/webhooks/prometheus/alerts`

Headers:

  - `authorization: Bearer <PROMETHEUS_WEBHOOK_TOKEN>` or `x-webhook-token`
  - optional `x-request-id`

Accepted body:

- `alerts` (array with at least one alert)
- `status` (e.g. `firing`, optional; default is `firing`)
- `receiver` (optional)

Expected per-alert labels/annotations:

- `labels.repository` or `labels.repo` or `labels.project` or `labels.repository_name` (required for ForgeGraph to resolve repo)
- `labels.environment` (`dev|staging|prod|production|preview`) or inferred from `labels.namespace`
- `labels.source_revision` or `labels.sourceRevision` or `labels.sha` or `labels.commit`
- `labels.source_deployment_id` (UUID, optional)
- `annotations.rollback_image_tag` or `labels.rollback_image_tag` (optional)
- `annotations.reason` or `labels.reason` (optional)
- `alertname` / `severity` used as fallback reason if no explicit reason

Bridge behavior:

- ForgeGraph resolves a control-plane-style payload from the first alert:
  - `source: "alertmanager"`
  - `repoName` from labels
  - `environment` with implicit `staging` fallback
  - `sourceRevision`
  - `sourceDeploymentId` / `rollbackImageTag` when available
  - `reason`
  - `metadata.alertmanager` containing original alert list
- ForgeGraph forwards to `POST /api/webhooks/control-plane` with `CONTROL_PLANE_WEBHOOK_TOKEN` (or `PROMETHEUS_WEBHOOK_TOKEN` if the control-plane token is unavailable)
- Non-2xx responses from control-plane are surfaced as bridge errors (`502`), so control-panel can route to retry/fallback.

Operational expectation:

- On confirmed incident alarms, this endpoint is the trigger path for auto-rollback.
- Control-panel should only send actionable alerts (e.g., `status: firing`) or tag noise alerts with distinct labels if filtering is required.
