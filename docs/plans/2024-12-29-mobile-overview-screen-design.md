# Mobile App: Sites-First Overview Screen

**Date:** 2024-12-29  
**Status:** Approved  
**Goal:** Redesign mobile Dashboard into "Sites-first Overview" for business owners managing multiple sites on the road.

## Problem

Current Dashboard shows infrastructure metrics (services, nodes, deployments). Business owners need "3-second clarity" - open app, instantly know if sites are OK.

## Design Decisions

### Status Rollup: Alert-Based (Option A)

Simple, actionable status per application based on active alerts:

```
if (criticalAlerts > 0) return 'critical'   // Red
if (warningAlerts > 0) return 'warning'     // Amber  
return 'healthy'                            // Green
```

**Rationale:** Alerts are the source of truth for "needs attention". YAGNI - start simple.

---

## Screen Design

### Overview Screen Structure

**Header Banner** - Global status at a glance:
```
+------------------------------------------+
|  All 5 sites healthy                     |  <- Green state
|  2 sites need attention                  |  <- Amber/red state
+------------------------------------------+
```

**Site Cards** - Sorted worst-first (Red -> Amber -> Green):
```
+------------------------------------------+
|  [Red]  Site Name                   2 -> |
|         "High error rate on checkout"    |
|         3m ago                           |
+------------------------------------------+
|  [Amber] Another Site               1 -> |
|         "Memory usage warning"           |
|         12m ago                          |
+------------------------------------------+
|  [Green] Healthy Site                 -> |
|         All clear                        |
+------------------------------------------+
```

**Card content:**
- Status dot (red/amber/green) + Site name
- Alert count badge (if > 0)
- Most recent/severe alert message preview (or "All clear")
- Time since last alert
- Tap -> drill into site detail

**Pull-to-refresh** - Same pattern as current Dashboard.

---

## Navigation Restructure

**Current:** 6 tabs (Dashboard, Applications, Alerts, Pipelines, Clusters, Settings)

**New:** 4 tabs (operator-focused)

```
+----------+----------+----------+----------+
| Overview | Attention|   Apps   |   More   |
+----------+----------+----------+----------+
```

| Tab | Purpose | Content |
|-----|---------|---------|
| Overview | "Are my sites OK?" | New sites-first screen |
| Attention | "What needs action?" | Active alerts (current Alerts screen) |
| Apps | "Drill into specifics" | Full app list (current Applications screen) |
| More | "Everything else" | Pipelines, Clusters, Settings (stacked menu) |

**More Screen** - Simple list menu:
```
+------------------------------------------+
|  Pipelines                            -> |
|  Clusters                             -> |
|  Settings                             -> |
+------------------------------------------+
```

---

## Data Requirements

### New tRPC Endpoint: `applications.listWithHealth`

Returns applications enriched with alert data:

```typescript
interface ApplicationWithHealth {
  id: string
  name: string
  slug: string
  status: 'critical' | 'warning' | 'healthy'
  alertCounts: { critical: number, warning: number }
  latestAlert: {
    message: string
    severity: 'critical' | 'warning'
    timestamp: Date
  } | null
  lastActivity: Date  // latest alert timestamp
}
```

### Data Source Options

**Option A: Use `notifications` table (recommended)**
- Already has `appId` (uuid) linking to applications
- Has `severity` field
- No migration needed

**Option B: Add `applicationId` to `alerts` table**
- Requires schema migration
- More semantic ("alerts" vs "notifications")

**Recommendation:** Use `notifications` table to avoid migration complexity.

### Sort Order

Applications sorted by:
1. Status severity (critical -> warning -> healthy)
2. Within same status: most recent alert first

---

## Drill-Down Behavior

**Tap site card -> Site Detail screen**

Reuses existing `ApplicationDetailScreen`:
- Shows alerts for this app
- Shows deployments  
- Shows integrations
- Quick actions (restart, view logs)

**No new detail screens needed** - just navigation wiring.

---

## Implementation Scope

### Files to Create

| File | Purpose |
|------|---------|
| `apps/mobile/src/screens/OverviewScreen.tsx` | New sites-first overview |
| `apps/mobile/src/screens/MoreScreen.tsx` | Menu for nested screens |

### Files to Modify

| File | Change |
|------|--------|
| `apps/mobile/App.tsx` | Update tab navigation (6 -> 4 tabs) |
| `packages/api/src/routers/applications.ts` | Add `listWithHealth` procedure |

### Files Unchanged

- `AlertsScreen.tsx` -> becomes "Attention" tab (rename in nav only)
- `ApplicationsScreen.tsx` -> becomes "Apps" tab
- `ApplicationDetailScreen.tsx` -> reused as drill-down target

---

## Success Criteria

1. User opens app -> sees all sites with status in < 1 second render
2. Red/amber sites appear at top (worst-first sorting)
3. Tap any site -> navigates to detail screen
4. 4-tab navigation fits comfortably on small screens
5. Pull-to-refresh works throughout
