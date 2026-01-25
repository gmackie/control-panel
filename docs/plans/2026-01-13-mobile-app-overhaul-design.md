# Mobile App Overhaul Design

**Date:** 2026-01-13  
**Status:** Approved  
**Goal:** Achieve feature parity with web UI for monitoring applications, deployments, and alerts

## Primary Use Case

Quick monitoring & triage - glance at health status, acknowledge alerts, check deployment status. Notification-driven access with occasional active management.

## Navigation Structure

### Bottom Tab Bar (4 tabs)

| Tab | Icon | Purpose |
|-----|------|---------|
| Dashboard | `home` | Health-first overview |
| Apps | `cube` | App-centric grid with health badges |
| Activity | `pulse` | Chronological feed with filters |
| Alerts | `alert-circle` | Dedicated alert management |

### Key Changes from Current App
- Remove "Sites" / "SiteSwitcher" concept entirely
- Remove "More" tab - settings via gear icon in header
- "Attention" → "Alerts" with clearer purpose
- "Overview" → "Dashboard" with health-first design

## Screen Designs

### Dashboard (Health-First)

1. **System Health Banner**
   - Status: "All Systems Operational" (green) or "X Issues Need Attention" (red/amber)
   - Counts: `3 Apps | 2 Deploying | 1 Alert`
   - Tap to jump to Alerts when issues exist

2. **Active Deployments Section**
   - Horizontal scrollable cards
   - Each card: App name, commit message, pipeline status dots
   - Pipeline: `Git ✓ → Build 🔄 → Registry ○ → Deploy ○`
   - Tap → App Detail

3. **Recent Alerts Section**
   - 3-5 most recent firing alerts
   - Each row: Severity icon, alert name, source app, time ago
   - Swipe to acknowledge
   - "View All" → Alerts tab

4. **Quick Apps Grid**
   - 2-column grid of top 6 apps
   - Each tile: App icon/initial, name, health dot
   - "See All Apps" → Apps tab

### Apps Tab (App-Centric Grid)

- Search bar at top
- 2-column grid (3 on tablet)
- Each card: Icon, name, health dot, provider badges, deploy indicator
- Tap → App Detail

### Activity Tab (Chronological Feed)

- Filter chips: All | Deployments | Commits | Alerts
- Grouped by time: Today, Yesterday, This Week
- Each item: Type icon, title, app name, timestamp, status
- Tap → relevant detail screen

### Alerts Tab

- Stats bar: `X Firing | Y Critical | Z Acknowledged`
- Filter chips: All | Firing | Critical | Acknowledged
- Grouped by severity (Critical first)
- Each item: Severity icon, name, message, source, time
- Swipe right to acknowledge (haptic feedback)
- Tap → Alert Detail

### Application Detail Screen

**Header:** App name + health badge + provider badges

**Section 1: Alerts & Deployments (top)**
- Horizontal tabs: "Alerts" | "Deployments"
- Recent alerts with swipe-to-acknowledge
- Deployments with expandable pipeline

**Expandable Pipeline Row:**
- Collapsed: `main@abc123 → ✓ ✓ ✓ 🔄`
- Expanded: Commit details, build status/duration, image tag, deploy target

**Section 2: Sentry Errors**
- Card: "X unresolved errors"
- Top 3 error titles with counts
- "View in Sentry" button (external)

**Section 3: Metrics**
- Stats: Requests/min, Error rate, P95 latency
- Mini sparklines
- "View full metrics" link (external)

**Section 4: Integrations**
- Connected services with status dots

### Alert Detail Screen
- Full message, source, severity, status
- Timeline (fired, acknowledged)
- "Acknowledge" button
- Link to related app

## Technical Requirements

### Existing tRPC Endpoints
- `applications.list` / `applications.get`
- `monitoring.alerts` / `monitoring.alertStats` / `monitoring.acknowledgeAlert`
- `notifications.list`
- `deployments.list`

### New/Enhanced Endpoints Needed
- Pipeline journey status (Git → Actions → Harbor → K8s/Vercel)
- Sentry integration (error counts, top issues per app)
- App-specific metrics aggregation

### External Deep Links
- Sentry: `https://sentry.io/issues/{issueId}`
- PostHog: `https://app.posthog.com/...`
- Grafana: `https://grafana.gmac.io/...`
- Gitea: `https://git.gmac.io/{repo}/actions`

## Push Notifications

**Critical only (default):**
- Failed deployments
- Critical/fatal alerts

Settings toggle to enable more notifications if desired.

## Implementation Notes

- Remove all "scope" related code (ScopeBar, useScopeStore hooks)
- Use existing tRPC client for data fetching
- Haptic feedback on swipe actions
- External links open in Safari/Chrome, not in-app webview
