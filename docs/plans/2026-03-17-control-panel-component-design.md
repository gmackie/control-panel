# Control Panel Higher-Order Component Design

**Date:** 2026-03-17
**Status:** Approved (brainstormed & validated)

## Design Decisions

- **Navigation model:** Hybrid — top-level pages for cross-app operational views, app detail for per-app deep dives
- **Pipeline visualization:** Dual — horizontal PipelineStepper for summaries, vertical DeployTimeline for detail
- **Monitoring integration:** Metric cards + deploy correlation (not embedded dashboards)
- **Operational posture:** Adaptive — staging auto-flows, production requires approval
- **Release model:** Mixed — supports formal versioned releases and continuous deploy streams
- **App detail tabs:** 4 tabs (Overview, Deployments, Observability, Settings) — consolidated from 7

## Navigation Structure

### Sidebar

```
MONITOR              OPERATIONS           SYSTEM
Applications         Releases             Integrations
Infrastructure       Monitoring           Settings
```

Six items, three sections.

### Information Flow

```
Top-level pages (cross-app)  →  App detail (single app)  →  Drawer (single deployment/event)
```

- Release Control Room → click row → DeploymentDetailDrawer or app Deployments tab
- Monitoring → click alert/app → DeploymentDetailDrawer or app Observability tab
- Integrations → click provider resource → app Settings tab

---

## Shared Building Blocks (New Primitives)

### PipelineStepper

Horizontal step visualization: commit → build → test → deploy → verify.

```
○ Commit  →  ○ Build  →  ○ Test  →  ● Deploy  →  ○ Verify
              2.1m         45s        running...
```

- 4 node states: pending (hollow), running (pulsing), success (green filled), failed (red filled)
- Connecting line: green up to current step, gray after
- Duration below completed steps; elapsed time ticking on active step
- Failed step shows failure message on hover/click
- Props: `steps: PipelineStep[]`, `compact?: boolean` (hides durations), `onStepClick?: (step) => void`
- **Used in:** AppCard, release queue rows, app detail deployments, DeploymentDetailDrawer header

### DeployTimeline

Vertical timeline of a single deployment's lifecycle.

```
10:23:01  ● Commit pushed     f57fb6f "fix: deploy script"
10:23:15  ● Build started     Gitea Actions #142
10:25:22  ● Build succeeded   2m 7s
10:25:30  ● Tests started     12 suites
10:26:15  ● Tests passed      45s, 47/47
10:26:20  ● Deploy started    production, 2 replicas
10:26:45  ● Verifying         health checks running...
```

- Left: timestamps in font-mono
- Center: status dot + event description
- Right: duration or metadata
- Failed entries: expandable error section with reason and log link
- **Used in:** DeploymentDetailDrawer, release detail view

### MetricDelta

Value with before/after deploy comparison.

- Current value, delta arrow (↑/↓), percentage change
- Color coded: green = improvement, red = regression
- Subtle threshold: <5% change shows as neutral gray
- **Used in:** DeploymentDetailDrawer impact section, release history rows, Observability tab

### SparklineCard

Metric card with inline sparkline trend.

- Metric name, current value, delta badge, mini sparkline (last 24h)
- Deploy annotations: vertical dashed line on sparkline at deploy timestamp
- Threshold coloring: card border turns red/yellow when value exceeds threshold
- **Used in:** Monitoring page health strip, app Observability tab

### DeploymentDetailDrawer

Slide-over panel (reuses AppSlideOver pattern) for any deployment.

- Header: app name + version, environment badge
- PipelineStepper (full width, non-compact)
- DeployTimeline (scrollable)
- Impact section: MetricDelta cards (error rate, latency, CPU)
- Action buttons: Rollback, View Logs, Promote (if staging)
- **Opened from:** any deployment row, release queue, alert timeline

---

## Top-Level Pages

### Release Control Room (`/releases`)

The operational command center during release cycles. Three sections:

**Active Releases Banner** (top strip, only visible when releases are in-flight):

```
control-panel  v1.4.2  ○→○→○→●→○  deploying to production  2m elapsed  [Rollback] [Approve]
gmac-web       v2.1.0  ○→○→●→○→○  testing                  45s elapsed
```

- Compact row per in-flight release: app, version, PipelineStepper, phase, elapsed time
- Production releases: approval/rollback buttons
- Staging releases: auto-flow (no buttons unless failure)
- `pending_approval` state: gold secondary border, "Awaiting Approval" with Approve/Reject
- Approval writes to `overrideRecords` with required reason

**Release Queue** (main table):

| Column | Content |
|--------|---------|
| App | Name + slug |
| Version | Tag or commit SHA |
| Environment | Badge |
| Status | Status badge |
| Pipeline | Compact PipelineStepper |
| Triggered By | CI/manual/rollback |
| Started | Relative timestamp |
| Duration | Total pipeline duration |

- Filterable by environment and status
- Formal releases show "Promote to Production" button when staging succeeds
- Continuous deploys show commit SHA and auto-promote based on policy
- Row click → DeploymentDetailDrawer

**Release History** (collapsed by default):

- Last 30 days of completed releases
- Outcome badges (healthy, failed, rolled_back)
- MetricDelta summary per release ("error rate +0.2%, p95 -12ms")
- Row click → DeploymentDetailDrawer

### Monitoring Page (`/monitoring`)

Where you go when something's wrong or to confirm everything's fine. Three sections:

**Health Overview Strip** — Row of SparklineCards:

- Error Rate (Sentry/Prometheus aggregate)
- P95 Latency (Prometheus)
- Active Alerts (firing count)
- Deploy Rate (deploys today)
- Uptime (calculated from health checks)

Each card: metric name, current value, delta from previous period, mini sparkline (24h). Red/yellow thresholds.

**Alert Timeline** — Chronological feed combining Prometheus alerts and Sentry errors:

```
● 10:23  critical  Pod CrashLoopBackOff: api-gateway    production  [Acknowledge]
● 10:18  warning   Memory usage 78% on k3s-worker-1     production
● 10:05  info      Sentry: 12 new errors since v1.4.2   gmac-web    [View in Sentry]
● 09:45  resolved  SSL certificate renewed               system
```

- Filterable by severity, app, status (firing/resolved)
- Resolved alerts dimmed
- Sentry entries show error count + deploy correlation inline
- Deploy-correlated alerts annotated with version

**Per-App Health Grid** — Card per app showing vital signs:

- App name, health dot, error rate, latency, active alert count
- Last deploy version + time
- Cards with issues sorted to top by severity
- Click → navigates to app Observability tab

**Deploy Correlation** (threaded throughout):

- Sparklines show vertical dashed line at deploy timestamps
- MetricDelta shows before/after when deploy happened in last 2 hours
- Correlates `deploymentHistory.completedAt` with metric timestamps

### Integrations Hub (`/integrations`)

Configure and monitor all providers. Two sections:

**Provider Grid** — Cards organized by category:

| Infrastructure | Source Control | Databases | Services |
|---------------|---------------|-----------|----------|
| Kubernetes    | Gitea         | Turso     | Sentry   |
| Harbor        | GitHub        | Neon      | PostHog  |

Each card: provider name, health dot (green=synced, yellow=stale, gray=not connected), resource count, last sync time. Connected: resource count + "Resync". Unconnected: "Connect" button.

**Integration Detail** (expanded on click):

- Connection status + last sync
- Discovered resources list (name, region, linked app)
- Credential status ("Token configured ✓" / "Token missing ✗" + "Rotate" button)
- Per-environment overrides (production vs staging tokens)
- "Link to App" action for unlinked resources

**Connect Dialog** — For new providers:

1. Enter API token/DSN
2. Validate with test API call
3. Discover available resources
4. Link to apps
5. Writes to `orgIntegrations` + `appIntegrations`

---

## App Detail Page (4 Tabs)

### Overview Tab

What it is — the at-a-glance view.

- Application info card (name, status, git provider, deploy provider, repo link)
- K8s live status (replicas, pods, strategy) — existing
- Current pipeline: full-width PipelineStepper for the latest deploy
- Recent activity feed: last 5 events (deploys, alerts, config changes)

### Deployments Tab

What's deployed — pipeline runs, history, and registry images.

**Sub-sections:**

1. **Current Pipeline** — Latest pipeline with full PipelineStepper, expandable to DeployTimeline
2. **Deployment History** — List with compact PipelineStepper per row, MetricDelta on completed deploys. Toggle between "Deployments" and "Releases" view for formal release history
3. **Registry Images** — Table of Harbor images (tags, digest, size, pushed time, vulnerability scan). Existing registry-tab content moved here

K8s live status panel (existing) stays at top of deployment history.

### Observability Tab

How's it doing — logs, metrics, errors, analytics.

**Sub-sections:**

1. **Health Summary** — Row of SparklineCards: error rate, latency, CPU, memory, active users (PostHog)
2. **Resource Metrics** — CPU, memory, requests/s, error rate, P95 latency cards with icons. Existing metrics-tab content
3. **Sentry Errors** — Top 10 recent issues: title, event count, first/last seen, affected users. Deploy-correlated ("since v1.4.2" tags). Links to Sentry for detail
4. **PostHog Analytics** — Active users, feature flag status, key funnel metrics. Metric cards with sparklines
5. **Logs** — Pod log viewer with cluster/pod/container selectors. Existing logs-tab content
6. **Alert History** — Recent alerts for this app. Existing alerts-tab content

Deploy correlation annotations throughout — sparklines marked at deploy times, MetricDelta on recent deploys.

### Settings Tab

How's it configured — app config, integrations, policies.

**Sub-sections:**

1. **General** — Name, slug, description, repository. Existing settings-tab content
2. **Providers** — Git, deploy, database provider config. Existing
3. **Integrations** — Linked resources per provider (Sentry project, Turso DB, PostHog project). Health status per integration. "Configure" links to hub
4. **Rollback Policy** — Auto-rollback toggle, severity filter (critical/warning/info checkboxes), environment scope (production/staging toggles), dedup window (slider, default 5m). Writes to `releasePolicies`
5. **Alert Thresholds** — Error rate %, latency ms, memory % — per environment. When exceeded, creates alert
6. **Notifications** — Channel config: Slack webhook URL, email, PagerDuty key. Per-severity routing
7. **Environment Variables** — Placeholder (existing)

---

## Component Inventory

### New Shared Primitives (4)

| Component | File | Props |
|-----------|------|-------|
| PipelineStepper | `components/pipeline/pipeline-stepper.tsx` | `steps`, `compact`, `onStepClick` |
| DeployTimeline | `components/pipeline/deploy-timeline.tsx` | `events`, `onEventClick` |
| MetricDelta | `components/monitoring/metric-delta.tsx` | `label`, `current`, `previous`, `unit`, `invertColor` |
| SparklineCard | `components/monitoring/sparkline-card.tsx` | `label`, `value`, `delta`, `data`, `deployMarkers`, `threshold` |

### New Higher-Order Components (10)

| Component | File | Used On |
|-----------|------|---------|
| DeploymentDetailDrawer | `components/pipeline/deployment-detail-drawer.tsx` | Everywhere (opened from any deploy row) |
| ActiveReleasesBanner | `components/releases/active-releases-banner.tsx` | `/releases` |
| ReleaseQueue | `components/releases/release-queue.tsx` | `/releases` |
| ReleaseHistory | `components/releases/release-history.tsx` | `/releases`, app Deployments tab |
| AlertTimeline | `components/monitoring/alert-timeline.tsx` | `/monitoring`, app Observability tab |
| AppHealthGrid | `components/monitoring/app-health-grid.tsx` | `/monitoring` |
| HealthOverviewStrip | `components/monitoring/health-overview-strip.tsx` | `/monitoring`, app Observability tab |
| ProviderGrid | `components/integrations/provider-grid.tsx` | `/integrations` |
| IntegrationDetail | `components/integrations/integration-detail.tsx` | `/integrations`, app Settings tab |
| ConnectDialog | `components/integrations/connect-dialog.tsx` | `/integrations` |

### New/Expanded App Detail Tab Components (4)

| Component | File |
|-----------|------|
| OverviewTab (expanded) | `components/apps/detail/overview-tab.tsx` |
| DeploymentsTab (expanded) | `components/apps/detail/deployments-tab.tsx` |
| ObservabilityTab (new) | `components/apps/detail/observability-tab.tsx` |
| SettingsTab (expanded) | `components/apps/detail/settings-tab.tsx` |

### Removed App Detail Tabs (3)

- `logs-tab.tsx` → content moves into ObservabilityTab
- `metrics-tab.tsx` → content moves into ObservabilityTab
- `alerts-tab.tsx` → content moves into ObservabilityTab
- `registry-tab.tsx` → content moves into DeploymentsTab

---

## Data Sources per Component

| Component | tRPC Router(s) | External API |
|-----------|---------------|-------------|
| PipelineStepper | `pipelines.byDeployment` | — |
| DeployTimeline | `pipelines.byDeployment` | — |
| MetricDelta | `monitoring.metrics` | Sentry, Prometheus |
| SparklineCard | `monitoring.metrics` | Prometheus, PostHog |
| ActiveReleasesBanner | `deployments.list` (active) | — |
| ReleaseQueue | `deployments.list`, `releases.list` | — |
| AlertTimeline | `monitoring.alerts`, `activity.list` | Sentry |
| AppHealthGrid | `appOverview.list` | Sentry, PostHog |
| ProviderGrid | `integrations.listOrgIntegrations` | — |
| IntegrationDetail | `integrations.applicationResources` | Provider APIs |
| DeploymentDetailDrawer | `pipelines.byDeployment`, `monitoring.metrics` | Sentry |
| ObservabilityTab | `monitoring.*`, app-scoped hooks | Sentry, PostHog, Prometheus |
| SettingsTab (rollback) | `releasePolicies.*` | — |

---

## Implementation Order

### Phase 1: Shared Primitives + Pipeline
1. PipelineStepper
2. DeployTimeline
3. DeploymentDetailDrawer
4. Expanded DeploymentsTab (with stepper + registry merge)

### Phase 2: Release Control Room
5. ActiveReleasesBanner
6. ReleaseQueue
7. ReleaseHistory
8. `/releases` page

### Phase 3: Monitoring
9. MetricDelta
10. SparklineCard
11. HealthOverviewStrip
12. AlertTimeline
13. AppHealthGrid
14. ObservabilityTab (merges logs + metrics + alerts)
15. `/monitoring` page

### Phase 4: Integrations & Settings
16. ProviderGrid
17. IntegrationDetail
18. ConnectDialog
19. `/integrations` page
20. Expanded SettingsTab (rollback policy, thresholds, notifications, integrations)

### Phase 5: Polish
21. Sidebar update (6 items)
22. App detail tab consolidation (7 → 4)
23. Overview tab expansion (pipeline stepper + activity feed)
24. Deploy correlation threading (sparkline markers, MetricDelta everywhere)
25. Storybook stories for all new components
