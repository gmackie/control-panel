# CI/CD Visibility Dashboard — Design

**Date:** 2026-03-16
**Status:** Approved
**Pilot apps:** control-panel, playpath, habit

## Problem

Control Panel has the infrastructure (ArgoCD, Prometheus, Harbor, Gitea CI) but isn't in the loop. No repo sends webhooks to it. The dashboard exists in web/ but shows mock data when the DB is empty. The new ForgeGraph endpoints live in web-v2 which isn't deployed.

## Design Decisions

1. **Hybrid pull+push** — Pull from ArgoCD/Gitea APIs for dashboard state, webhook endpoints ready for real-time events
2. **Each service is authoritative for its domain** — ArgoCD for deploy state, Gitea API for CI state, Prometheus for metrics
3. **Single app** — Consolidate into web/ (deployed at control.gmac.io). Move ForgeGraph endpoints from web-v2 to web/.
4. **tRPC router in packages/api/** — Data layer decoupled from UI
5. **`/api/metrics` endpoint** — Prometheus exposition format with request + webhook counters

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Gitea API  │     │  ArgoCD API  │     │ Prometheus API│
│ git.gmac.io │     │  cd.gmac.io  │     │ prom.gmac.io  │
└──────┬──────┘     └──────┬───────┘     └───────┬───────┘
       │                   │                     │
       │    ┌──────────────┴─────────────────────┘
       │    │
  ┌────▼────▼──────────────────────────────────────────┐
  │              packages/api/src/routers/              │
  │                                                     │
  │  ciPipelines.ts    — Gitea workflows + runs         │
  │  argoApps.ts       — ArgoCD app sync/health         │
  │  appOverview.ts    — merged view per pilot app      │
  │                                                     │
  └────────────────────┬───────────────────────────────┘
                       │ tRPC
  ┌────────────────────▼───────────────────────────────┐
  │              apps/web/ (control.gmac.io)            │
  │                                                     │
  │  /deployments      — existing, now with real data   │
  │  /api/forge/*      — moved from web-v2              │
  │  /api/metrics      — Prometheus scrape target       │
  │  /api/webhooks/*   — existing webhook handlers      │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

## Workstream A: Wire Up Data Flow

### New tRPC routers in `packages/api/`

**`ciPipelines.ts`** — Gitea CI status
- `ciPipelines.byRepo({ owner, repo })` — list workflow runs for a repo
- `ciPipelines.latestRun({ owner, repo })` — most recent run with status
- Uses Gitea REST API: `GET /api/v1/repos/{owner}/{repo}/actions/runs`
- Auth: `GITEA_TOKEN` env var
- No DB storage needed — Gitea is the source of truth

**`argoApps.ts`** — ArgoCD deployment state
- `argoApps.list()` — all ArgoCD applications with sync/health status
- `argoApps.byName({ name })` — single app detail
- `argoApps.syncHistory({ name })` — recent sync operations
- Uses ArgoCD REST API: `GET /api/v1/applications`
- Auth: `ARGOCD_TOKEN` env var
- No DB storage needed — ArgoCD is the source of truth

**`appOverview.ts`** — merged view for pilot apps
- `appOverview.list()` — returns pilot apps with combined status from all sources
- `appOverview.bySlug({ slug })` — single app: CI runs + ArgoCD state + Prometheus health
- Reads from `applications` table to map app → Gitea repo + ArgoCD app name + K8s namespace
- Joins data from ciPipelines + argoApps + existing Prometheus client

### Pilot app configuration

Seed the `applications` table with:
| name | slug | repositoryUrl | k8sNamespace | k8sDeploymentName | forgeGraphRepoId |
|------|------|---------------|--------------|-------------------|------------------|
| Control Panel | control-panel | git.gmac.io/gmackie/control-panel | control-panel | control-panel | — |
| Playpath | playpath | git.gmac.io/gmackie/playpath | playpath | playpath | — |
| Habit | habit | git.gmac.io/gmackie/habit | habit | habit | — |

### Move ForgeGraph endpoints from web-v2 to web/

- Copy `apps/web-v2/src/app/api/forge/` → `apps/web/src/app/api/forge/`
- Adapt imports (`@/lib/db` → `@repo/db`)

## Workstream B: Dashboard UI

### Extend existing deployments page

The existing `/deployments` page in web/ already has tabs and components. We extend it:

**App Overview Cards** — one card per pilot app showing:
- App name + link to Gitea repo
- Latest CI run: status badge (success/failure/running), commit message, timestamp
- ArgoCD sync status: Synced/OutOfSync/Unknown
- ArgoCD health: Healthy/Degraded/Progressing
- Pod count: ready/total

**Pipeline Timeline** — existing component, now fed by real tRPC data:
- commit → build (Gitea CI) → push (Harbor) → deploy (ArgoCD sync) → verify (health check)
- Each step shows real timestamps and status

**No new pages needed** — extend the existing deployments page with a new "Overview" tab.

## Workstream C: `/api/metrics` Endpoint

**`apps/web/src/app/api/metrics/route.ts`**

Expose Prometheus exposition format:

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/deployments",status="200"} 42

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 100
...

# HELP webhook_received_total Webhooks received by source
# TYPE webhook_received_total counter
webhook_received_total{source="argocd"} 15
webhook_received_total{source="prometheus"} 8
webhook_received_total{source="harbor"} 3

# HELP webhook_processing_duration_seconds Webhook processing time
# TYPE webhook_processing_duration_seconds histogram

# HELP webhook_errors_total Webhook processing errors
# TYPE webhook_errors_total counter

# HELP control_panel_uptime_seconds Time since process start
# TYPE control_panel_uptime_seconds gauge
```

Implementation: middleware that increments in-memory counters, metrics endpoint that formats them.

## What We're NOT Building

- No web-v2 dashboard (consolidating to web/)
- No ForgeGraph tRPC client (pull model, not push)
- No artifact management
- No release cut flow
- No changes to Gitea CI workflows (they already work)
- No webhook registration on repos (that's a follow-up once the dashboard proves value)

## Verification

1. Visit `control.gmac.io/deployments` → see real CI/deploy status for 3 pilot apps
2. `curl control.gmac.io/api/metrics` → Prometheus exposition format with counters
3. `curl control.gmac.io/api/forge/health` → ForgeGraph config status
4. Prometheus scrapes `/api/metrics` successfully (check targets page)
