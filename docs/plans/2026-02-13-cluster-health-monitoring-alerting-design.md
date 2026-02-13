# Cluster Health Monitoring & Alerting

**Date:** 2026-02-13
**Status:** Approved
**Trigger:** k3s-worker-1 went unreachable due to CrashLoopBackOff pods overwhelming the kubelet. No alerts fired. tasks.gmac.io and ~40 other pods were down with zero visibility.

## Goals

1. Detect node and pod health issues within 30-60 seconds
2. Alert via Slack, push (browser + mobile), in-app, and email
3. Manage Prometheus & AlertManager configuration from the control panel
4. Deduplicate alerts from both built-in and Prometheus sources

## Architecture

Two detection systems feeding a single notification pipeline:

```
┌─────────────────────┐     ┌──────────────────────────┐
│  Built-in Health    │     │  Prometheus/AlertManager  │
│  Monitor (30s poll) │     │  (webhook receiver)      │
└────────┬────────────┘     └────────────┬─────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────────────────────────────────────┐
│              Alert Deduplication Layer               │
│         (match on alertName + resource)              │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│              Notification Service                    │
│  (existing: DB-backed, multi-channel, preferences)  │
└────────────────────────┬────────────────────────────┘
                         ▼
        ┌────────┬───────┬────────┬──────────┐
        │ Slack  │ Push  │ In-App │  Email   │
        │webhook │browser│  feed  │ SendGrid │
        │        │+mobile│        │          │
        └────────┴───────┴────────┴──────────┘
```

## Part 1: Built-in Health Monitor

Extends existing `src/lib/cluster/modules/health-monitor.ts` with pod-level checks.

### Detection Rules

| Check | Condition | Severity |
|---|---|---|
| Node unreachable | Kubelet heartbeat >60s warning, >120s critical | Critical |
| Node resource pressure | CPU >70%/90%, Memory >80%/95% | Warning/Critical |
| Pod CrashLoopBackOff | Any pod in CrashLoopBackOff state | High |
| Excessive restarts | Pod restart count > threshold in time window | High |
| Pod stuck states | ContainerStatusUnknown, Pending >5min | Medium |
| Node conditions | MemoryPressure, DiskPressure, PIDPressure taints | Critical |

### Behavior

- Polls K8s API every 30 seconds
- Auto-starts on app boot via Next.js instrumentation hook
- Persists alerts to existing `alerts` DB table
- Deduplicates: fires once per issue, resolves when fixed
- Retains 24h of in-memory metrics for sparkline trends

## Part 2: Prometheus & AlertManager Integration

### Inbound: Webhook Receiver

- `POST /api/webhooks/alertmanager` receives firing/resolved alerts
- Normalizes to same alert format as built-in monitor
- Tags with `source: "prometheus"` vs `source: "built-in"`
- Feeds into same notification pipeline

### Outbound: Configuration Management

**Prometheus Rule Management:**
- CRUD API for PrometheusRule CRDs in `monitoring` namespace
- UI form for creating alert rules (metric, threshold, duration, severity)
- Pre-built rule templates for common scenarios
- PromQL preview before applying

**AlertManager Config Management:**
- Read/update AlertManager ConfigMap/Secret via K8s API
- UI for receivers (Slack URL, email, PagerDuty) and routing (severity/namespace/label based)
- Config validation before applying
- Reload trigger via `/-/reload` endpoint

## Part 3: Notification Delivery

| Channel | Implementation | Default Trigger |
|---|---|---|
| In-app | DB-backed notification feed (exists) | All alerts |
| Slack | Webhook POST (exists) | Warning+ |
| Browser push | Web Push API (exists) | High+ |
| Mobile push | Expo Push or Firebase (new) | Critical |
| Email | SendGrid (exists) | Critical + daily digest |

Severity routing configurable per-user via `notificationPreferences` table.

## Part 4: Dashboard

- Live cluster health banner (green/yellow/red) at top of dashboard
- Active alerts list with source badge, severity, resource, duration
- Alert history timeline (fire → resolve with duration)
- Node health cards with CPU/memory sparklines (24h trend)
- Pod health table: filterable by namespace, sortable by restart count, CrashLoopBackOff/Error highlighted

## Out of Scope

- Replacing Grafana for metrics visualization (link to it instead)
- Storing Prometheus time-series data
- Duplicating AlertManager's internal routing logic
