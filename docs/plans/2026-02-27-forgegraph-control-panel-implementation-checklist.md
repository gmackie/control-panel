# ForgeGraph + Control-Panel Implementation Checklist (v1)

Date: 2026-02-27

This file converts the endpoint spec into discrete implementation work for the control-panel team.

## Scope

- Enable control-panel as the orchestrator for the ForgeGraph funnel -> PR -> release lifecycle.
- Align repo CI + deployments to ForgeGraph status model.
- Add rollback/alert feedback loops and production safety defaults.

Assumption for this phase: PR is a lifecycle state of an issue/changeset, not a separate entity.

## Must-have outcomes

1. control-panel can ingest low-fidelity ideas and enrich them into issue artifacts over time.
2. control-panel can drive repo CI/deployment with ForgeGraph-compatible contracts.
3. control-plane rollback callback updates ForgeGraph and marks production as last-known-good when needed.
4. release/changelog flow is based on commit history + review override points.
5. all changes are traceable with correlation IDs from intake through production deployment.

---

## 1) Funnel Intake and Artifact Expansion

### 1.1 Add /api/funnel intake endpoint
- Implement POST `/api/funnel` (or existing internal router equivalent) to create initial issue artifacts from sparse input.
- Minimum payload support:
  - `title`, `description` (1–2 sentence stream)
  - `funnelSourceType` (`sentry`, `ticket`, `chat`, etc.)
  - `funnelSourceUrl`
  - optional `funnelTshirtSize` (`xs|s|m|l|xl|xxl`)
- Persist artifact type lifecycle:
  - `idea -> plan -> brd -> spec -> task -> release`
  - allow for fan-out decomposition into multiple child issues.
- Emit idempotent create by normalized signature (e.g., source URL + title + timestamp window).

### 1.2 Add/confirm issue graph operations
- Create child issue links from a parent idea.
- Preserve parent/child history so small ideas can split into large components later.
- Add stage transitions to support:
  - `dumped`
  - `triaged`
  - `in_review`
  - `planned`
  - `spec_ready`
  - `task_ready`
  - `in_progress`
  - `ready_for_staging`
  - `ready_for_release`

### 1.3 Emit ForgeGraph funnel updates
- For each stage transition, optionally notify ForgeGraph if it has a linked changeset record.
- Track `taskId`/`issueId` consistently and surface in CI and deployment telemetry.

## 2) Repo Provisioning + Metadata

### 2.1 Maintain ForgeGraph mapping per repo
- Store and expose:
  - `forgeGraphRepoId` (preferred) or stable `repoName`.
  - CI provider mapping (`github` / `gitea`).
  - desired deployment targets (`k8s`, `vercel`, `cloudflare` booleans).

### 2.2 Secrets and environment wiring
- Ensure each repo has:
  - `FORGEGRAPH_API_URL`
  - `FORGEGRAPH_API_KEY`
  - `FORGEGRAPH_WEBHOOK_TOKEN` (for control-plane callback)
  - provider token/keys needed by existing deploy actions.
- Define one canonical correlation id key name and pass it into both forge calls and deploy scripts.

### 2.3 Add repo bootstrap playbook
- Add docs and a one-shot script or config snippet showing:
  - webhook registration for `/api/webhooks/{github,gitea}`
  - required tokens and headers
  - default rollout workflow command mapping.

---

## 3) CI/Delivery Contract Wiring

### 3.1 Integrate ForgeGraph v1 contract into CI runners
For every managed repository, update pipeline logic to call:
- `forgeGraphV1.build.trigger`
- `forgeGraphV1.build.updateStatus`
- `forgeGraphV1.build.attachArtifact`
- `forgeGraphV1.deployment.create`
- `forgeGraphV1.deployment.updateStatus`
- `forgeGraphV1.revision.requestIndex`

### 3.2 Status contract enforcement
- Use idempotent keys:
  - `idempotencyKey` for trigger calls
  - deterministic `runId` and correlation id for status updates
- Enforce deployment state graph:
  - `pending_approval -> queued -> building -> testing -> deploying -> verifying -> healthy`
  - failure/rollback states:
    - `deploying -> unhealthy -> rolled_back`
    - `verifying -> rolled_back`
    - `* -> failed` exits the normal path
- Reject illegal transitions in CI code before sending updates.

### 3.3 Build/deployment artifact protocol
- For every image build:
  - include `imageDigest`
  - include optional artifact manifest link (if build output is packaged)
  - include `artifact.type` and storage reference for traceability

### 3.4 Promotion workflows
- Implement two-step promotion path:
  1. staging deploy
  2. manual approval for production
- Ensure `deployment.create` for production can optionally include `rollbackTargetDeploymentId`.

---

## 4) Control-plane Rollback Hook

### 4.1 Add/verify rollback callback endpoint integration
- Configure control-panel webhook consumer for:
  - `POST /api/webhooks/control-plane` on ForgeGraph
  - Auth: `Authorization: Bearer <token>` and `x-webhook-token` compatibility
  - Body validation for:
    - `repoName` or `repoId`
    - `environment` (`prod` preferred; accept `production` until enum unified)
    - `rollbackImageTag` or rollback target identifier
    - optional `reason`, `correlationId`, alert metadata
- Return resolved deployment summary + updated production state.

### 4.2 Alert-to-rollback chain
- Keep existing `/api/webhooks/prometheus/alerts` consumer.
- Evaluate policy there and call control-plane rollback callback when thresholds cross.
- Require these alert labels/fields minimum:
  - `labels.alertname`, `labels.severity`, `labels.namespace`, `labels.pod`, `annotations.summary`, `fingerprint`
- Support no-op replay and idempotent rollback application by `fingerprint`.

### 4.3 Last-known-good selection
- On rollback, control-panel should:
  - confirm target deployment is healthy
  - map to last successful prod deploy
  - update ForgeGraph deployment record status to `rolled_back`.

---

## 5) Release and Changelog Management

### 5.1 Release cuts from issue sets
- When approvals are complete, control-panel triggers release creation path:
  - call `issue.createReleaseCut` with selected issue IDs.
- Include changelog generation from commit messages (Conventional Commit prefixes).
- Provide explicit override path for final release notes before publish.

### 5.2 Commit/changelog audit
- Add validation to capture and store:
  - generated changelog entries
  - manual override text
  - commit message sources used.

### 5.3 Deployment status in release records
- Include last known deployment id and target image in release metadata.
- Track whether release reached `staging_verified` and `production_deployed`.

---

## 6) Platform Coverage Expansion (k8s / Vercel / Cloudflare)

### 6.1 Deployment action schema
- Standardize `platform.delivery` workflow dispatch payload fields:
  - `action`: `deploy` | `rollback`
  - `environment`: `staging` | `production`
  - `deployTarget`: `k8s` | `vercel` | `cloudflare`
  - `buildId`, `revision`, `artifact`, `correlationId`
- Ensure each target writes status back through ForgeGraph status APIs.

### 6.2 Cloudflare integration
- Add/verify worker trigger and durable object deploy hooks in CI path.
- Keep deploy path behind an explicit `deploy_cloudflare` flag in control-plane actions.

---

## 7) Control-Panel API & UI Updates

### 7.1 Funnel + artifact UI
- Add intake UI for:
  - sentence-level idea capture
  - automatic extraction of task/source links
  - quick T-shirt-size labeling.

### 7.2 Lifecycle views
- Timeline view should show:
  - task-stage transitions
  - per-stage build/deployment status
  - linked PR attempts and rollback events.

### 7.3 Deployment health views
- Add visibility into:
  - active `buildId` / `deploymentId`
  - verifier state (`staging`, `production`)
  - last-good deployment and rollback reason.

---

## 8) Security, reliability, and governance

### 8.1 Auth consistency
- Standardize all callback/auth headers (no mixed header names across services).
- Support short token rotation runbook for webhook tokens.

### 8.2 Replay and dedupe
- Ensure idempotency for all status-updating endpoints and CI webhook receivers.
- Persist dedupe keys and respond with canonical resource identifiers on replay.

### 8.3 Audit and traceability
- Add immutable audit entries for:
  - each stage transition
  - deployment status mutation
  - rollback decision and execution.

---

## Suggested work order (minimal risk)

1. Fulfill intake/funnel expansion and artifact graph support.
2. Add repo provisioning + env secrets and webhook registration automation.
3. Update CI contract usage to ForgeGraph v1 procedures.
4. Implement rollback callback + alert policy chain.
5. Close release/changelog path + deployment status traceability.
6. Add k8s/Vercel/Cloudflare action parity and final UI observability.

## Dependencies and quick references

- Primary ForgeGraph contract: `docs/plans/2026-02-12-forgegraph-api-contract-v1.md`
- Existing API contract for control-plane endpoints: `docs/plans/2026-02-27-forgegraph-control-panel-endpoint-spec.md`
- Existing control-plane rollback/alarm docs in this repo (ForgeGraph app): `docs/ops/prometheus-auto-rollback.md`, `docs/ops/platform-delivery.md`, `docs/ops/control-panel-integration.md`
- CI delivery workflow in ForgeGraph app: `.github/workflows/platform-delivery.yml`
