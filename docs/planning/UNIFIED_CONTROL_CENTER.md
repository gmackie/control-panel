# Unified Control Center - Implementation Plan

> Transforming the control panel into a true "single pane of glass" with real-time visibility, unified alerting, and mobile access.

## Overview

This document outlines the implementation plan for three core features:

1. **Real-Time Activity Feed** - Live visibility into everything happening
2. **Unified Notifications Center** - Centralized alerting and routing
3. **Mobile Companion App** - On-the-go monitoring and incident response

---

## Phase 1: Real-Time Activity Feed

### Vision

A live stream showing everything happening across your infrastructure - deployments, alerts, user signups, payments, errors - in one chronological view.

### Event Sources

| Source | Event Types |
|--------|-------------|
| **Gitea** | Push, PR opened/merged, CI started/completed |
| **Kubernetes** | Deployment started/completed, pod crashed, scaling |
| **Clerk** | User signup, login, MFA enabled, user banned |
| **Stripe** | Payment succeeded/failed, subscription created/cancelled |
| **Sentry** | New issue, regression, resolved |
| **PostHog** | Feature flag changed, experiment started |
| **Neon** | Branch created, migration run |
| **System** | Secret rotated, integration connected, alert triggered |

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Gitea     │     │    Clerk     │     │   Stripe     │
│   Webhooks   │     │   Webhooks   │     │   Webhooks   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            ▼
                 ┌─────────────────────┐
                 │  Webhook Processor  │
                 │  /api/webhooks/*    │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   Activity Store    │
                 │      (Turso)        │
                 └──────────┬──────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    ┌──────────────────┐       ┌──────────────────┐
    │  SSE Stream API  │       │   REST Query API │
    │  /api/activity/  │       │  /api/activity   │
    │     stream       │       │                  │
    └────────┬─────────┘       └────────┬─────────┘
             │                          │
             └──────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │  Activity Feed   │
              │    Component     │
              └──────────────────┘
```

### Data Model

```typescript
interface ActivityEvent {
  id: string;
  timestamp: Date;
  
  // Source identification
  source: 'gitea' | 'clerk' | 'stripe' | 'sentry' | 'posthog' | 
          'kubernetes' | 'system' | 'neon';
  
  // Event classification
  category: 'deployment' | 'auth' | 'payment' | 'error' | 
            'infrastructure' | 'integration' | 'security';
  eventType: string;          // e.g., "deployment.completed"
  severity: 'info' | 'warning' | 'error' | 'critical';
  
  // Context
  appId?: string;
  appName?: string;
  environment?: string;
  
  // Content
  title: string;
  description?: string;
  actor?: {
    type: 'user' | 'system' | 'webhook' | 'automation';
    id?: string;
    name?: string;
    avatar?: string;
  };
  
  // Links and actions
  links?: Array<{ label: string; url: string; external?: boolean }>;
  
  // Raw data for drilling down
  metadata?: Record<string, any>;
}
```

### Database Schema

```sql
CREATE TABLE activity_events (
  id TEXT PRIMARY KEY,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  
  app_id TEXT,
  app_name TEXT,
  environment TEXT,
  
  title TEXT NOT NULL,
  description TEXT,
  
  actor_type TEXT,
  actor_id TEXT,
  actor_name TEXT,
  
  metadata TEXT,  -- JSON
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_timestamp ON activity_events(timestamp DESC);
CREATE INDEX idx_activity_source ON activity_events(source);
CREATE INDEX idx_activity_app ON activity_events(app_id);
CREATE INDEX idx_activity_category ON activity_events(category);
```

### Implementation Tasks

#### 1.1 Event Ingestion Infrastructure
- [ ] Create `activity_events` table schema in Drizzle
- [ ] Build `ActivityService` for CRUD operations
- [ ] Create unified webhook processor base class
- [ ] Implement event normalizers for each source

#### 1.2 Webhook Endpoints
- [ ] `/api/webhooks/gitea` - Deployment, push, PR events
- [ ] `/api/webhooks/clerk` - Auth events (signup, login, MFA)
- [ ] `/api/webhooks/stripe` - Payment events
- [ ] `/api/webhooks/sentry` - Error events
- [ ] `/api/webhooks/kubernetes` - Infrastructure events
- [ ] `/api/webhooks/neon` - Database events

#### 1.3 Real-Time Streaming
- [ ] Create SSE endpoint `/api/activity/stream`
- [ ] Implement in-memory pub/sub for new events
- [ ] Build reconnection logic for dropped connections
- [ ] Add heartbeat to keep connections alive

#### 1.4 Activity Feed UI
- [ ] Create `ActivityFeed` component with infinite scroll
- [ ] Build `ActivityEventCard` for each event type
- [ ] Implement filter sidebar (source, category, app, date)
- [ ] Add live "New events" indicator
- [ ] Create activity stats summary header

#### 1.5 Integration Points
- [ ] Add Activity tab to main navigation
- [ ] Add mini activity widget to dashboard homepage
- [ ] Add per-app activity in application detail view
- [ ] Link events to relevant detail pages

### Files to Create

```
src/
├── lib/
│   ├── activity/
│   │   ├── activity-service.ts      # Core service
│   │   ├── event-normalizers.ts     # Transform webhooks
│   │   └── types.ts                 # TypeScript types
│   └── schema-activity.ts           # Drizzle schema
├── app/
│   ├── api/
│   │   ├── activity/
│   │   │   ├── route.ts             # Query events
│   │   │   └── stream/
│   │   │       └── route.ts         # SSE streaming
│   │   └── webhooks/
│   │       ├── clerk/route.ts
│   │       ├── stripe/route.ts
│   │       └── sentry/route.ts
│   └── activity/
│       └── page.tsx                 # Activity feed page
└── components/
    └── activity/
        ├── ActivityFeed.tsx
        ├── ActivityEventCard.tsx
        ├── ActivityFilters.tsx
        └── ActivityStats.tsx
```

### Estimated Time: 2 weeks

---

## Phase 2: Unified Notifications Center

### Vision

Aggregate all alerts from all sources, with intelligent routing, deduplication, and actionable notifications.

### Dependencies

- Requires Activity Feed (Phase 1) for event ingestion
- Uses same webhook infrastructure

### Notification Sources

| Source | Alert Types |
|--------|-------------|
| **Sentry** | New error, regression, spike in errors |
| **Stripe** | Payment failed, subscription cancelled, dispute |
| **Clerk** | Suspicious login, user locked out, MFA disabled |
| **Kubernetes** | Pod crash, deployment failed, resource exhaustion |
| **Neon** | Connection limit, storage warning |
| **System** | Secret expiring, integration disconnected |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Notification Sources                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ Sentry │ │ Stripe │ │ Clerk  │ │  K8s   │ │ System │    │
│  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘    │
└──────┼──────────┼──────────┼──────────┼──────────┼──────────┘
       └──────────┴──────────┴──────────┴──────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   Notification Engine    │
              │  ┌────────────────────┐  │
              │  │ Deduplication      │  │
              │  │ Correlation        │  │
              │  │ Priority Scoring   │  │
              │  │ Routing Rules      │  │
              │  └────────────────────┘  │
              └────────────┬─────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │  Slack   │     │  Email   │     │ In-App   │
   └──────────┘     └──────────┘     └──────────┘
                                          │
                                          ▼
                                   ┌──────────┐
                                   │  Mobile  │
                                   │   Push   │
                                   └──────────┘
```

### Data Model

```typescript
interface Notification {
  id: string;
  createdAt: Date;
  
  // Source
  source: string;
  sourceEventId?: string;      // For deduping
  activityEventId?: string;    // Link to activity feed
  
  // Classification
  category: 'error' | 'payment' | 'security' | 'infrastructure' | 
            'deployment' | 'integration';
  severity: 'info' | 'warning' | 'error' | 'critical';
  
  // Content
  title: string;
  message: string;
  
  // Context
  appId?: string;
  appName?: string;
  environment?: string;
  
  // Actions
  actions?: NotificationAction[];
  links?: Array<{ label: string; url: string }>;
  
  // Status
  status: 'new' | 'seen' | 'acknowledged' | 'resolved' | 'snoozed';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  snoozedUntil?: Date;
  
  // Grouping
  groupKey?: string;
  groupCount?: number;
  
  // Delivery tracking
  deliveredVia: string[];
  
  metadata?: Record<string, any>;
}

interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  
  // Matching criteria
  conditions: {
    sources?: string[];
    categories?: string[];
    severities?: string[];
    appIds?: string[];
    titleContains?: string;
  };
  
  // Actions
  channels: NotificationChannel[];
  
  // Behavior
  dedupe?: {
    enabled: boolean;
    windowMinutes: number;
    groupBy: string[];
  };
  
  // Schedule
  schedule?: {
    quietHours?: { start: string; end: string };
    daysOfWeek?: number[];
  };
}

interface NotificationChannel {
  type: 'slack' | 'email' | 'webhook' | 'push' | 'in-app';
  config: Record<string, any>;
  minSeverity?: string;
}

interface NotificationPreferences {
  userId: string;
  
  emailEnabled: boolean;
  slackEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  
  categoryPreferences: Record<string, {
    enabled: boolean;
    channels: string[];
    minSeverity: string;
  }>;
  
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
    exceptCritical: boolean;
  };
}

interface PushSubscription {
  id: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  pushToken: string;
  createdAt: Date;
  lastUsedAt: Date;
}
```

### Implementation Tasks

#### 2.1 Core Notification System
- [ ] Create `notifications` table schema
- [ ] Create `notification_rules` table schema
- [ ] Create `notification_preferences` table schema
- [ ] Create `push_subscriptions` table schema
- [ ] Build `NotificationService` with CRUD operations
- [ ] Implement deduplication logic
- [ ] Build correlation engine (group related alerts)

#### 2.2 Delivery Channels
- [ ] In-app notification system
  - [ ] Notification bell component with badge count
  - [ ] Dropdown panel with recent notifications
  - [ ] Real-time updates via SSE
- [ ] Slack integration
  - [ ] Slack webhook delivery
  - [ ] Interactive buttons for acknowledge/resolve
- [ ] Email integration
  - [ ] Email templates for each category
  - [ ] Digest mode (hourly/daily summary)
- [ ] Push notification preparation
  - [ ] Push subscription management
  - [ ] Push token storage
  - [ ] Abstract push delivery interface (for Phase 3)

#### 2.3 Rules Engine
- [ ] Build `NotificationRulesEngine`
- [ ] Create rules management UI
- [ ] Implement condition matching
- [ ] Add quiet hours support
- [ ] Build rule testing/preview

#### 2.4 Notification Center UI
- [ ] Create `NotificationBell` header component
- [ ] Create `NotificationDropdown` quick view
- [ ] Create full `NotificationsPage` with:
  - [ ] Filter by source/category/severity/status
  - [ ] Bulk actions (acknowledge, resolve, snooze)
  - [ ] Grouped view for related notifications
  - [ ] Search within notifications
- [ ] Add notification preferences page
- [ ] Create notification rules management page

#### 2.5 Integration Points
- [ ] Hook into activity feed (convert events to notifications)
- [ ] Add notification triggers to alert rules
- [ ] Add NotificationBell to Navigation header

### Files to Create

```
src/
├── lib/
│   ├── notifications/
│   │   ├── notification-service.ts
│   │   ├── deduplicator.ts
│   │   ├── correlator.ts
│   │   ├── rules-engine.ts
│   │   ├── channels/
│   │   │   ├── slack.ts
│   │   │   ├── email.ts
│   │   │   ├── push.ts
│   │   │   └── webhook.ts
│   │   └── types.ts
│   └── schema-notifications.ts
├── app/
│   ├── api/
│   │   └── notifications/
│   │       ├── route.ts
│   │       ├── stream/route.ts
│   │       ├── rules/route.ts
│   │       ├── preferences/route.ts
│   │       └── push/
│   │           └── subscribe/route.ts
│   ├── notifications/
│   │   └── page.tsx
│   └── settings/
│       └── notifications/
│           └── page.tsx
└── components/
    └── notifications/
        ├── NotificationBell.tsx
        ├── NotificationDropdown.tsx
        ├── NotificationCard.tsx
        ├── NotificationFilters.tsx
        ├── RulesManager.tsx
        └── PreferencesForm.tsx
```

### Estimated Time: 2 weeks

---

## Phase 3: Mobile Companion App

### Vision

A mobile app for iOS and Android that provides on-the-go monitoring, quick actions, and incident response. Leverages the Activity Feed and Notifications infrastructure built in Phases 1-2.

### Technology Stack

| Component | Technology |
|-----------|------------|
| **Framework** | React Native with Expo |
| **Navigation** | Expo Router |
| **State** | TanStack Query (same as web) |
| **Push** | Expo Notifications (APNs + FCM) |
| **Auth** | API token (generated from web) |
| **Storage** | Expo SecureStore |

### Core Features

#### 3.1 Dashboard
- Health overview (all apps at a glance)
- Active alerts count with severity breakdown
- Quick stats (deployments today, errors)
- Pull to refresh

#### 3.2 Activity Feed
- Real-time activity stream (same data as web)
- Filter by app, category, severity
- Tap to view details
- Deep link to web for full context

#### 3.3 Notifications
- Push notifications for critical/error alerts
- In-app notification center
- Swipe actions: acknowledge, snooze, resolve
- Badge count on app icon

#### 3.4 Quick Actions
- Acknowledge alert
- Resolve alert
- Snooze alert (15m, 1h, 4h, 24h)
- View in web (deep link)

#### 3.5 Applications
- List all apps with status indicators
- App detail: status, recent activity, active alerts
- Quick health check

#### 3.6 Settings
- Push notification preferences
- Quiet hours configuration
- Account management
- Sign out

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile App (Expo)                        │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Dashboard │ │ Activity │ │  Alerts  │ │   Apps   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │                   API Client                        │     │
│  │  - Auth token management                           │     │
│  │  - TanStack Query hooks                            │     │
│  │  - Optimistic updates                              │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  Control Panel API                            │
│                                                               │
│  Existing Endpoints:              New Mobile Endpoints:       │
│  ├── /api/activity               ├── /api/mobile/auth        │
│  ├── /api/notifications          ├── /api/mobile/dashboard   │
│  └── /api/apps                   └── /api/push/send          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Push Notification Service               │     │
│  │  - Expo Push API integration                        │     │
│  │  - Token management                                 │     │
│  │  - Delivery tracking                                │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │   APNs   │     │   FCM    │     │  Expo    │
   │  (iOS)   │     │(Android) │     │  Push    │
   └──────────┘     └──────────┘     └──────────┘
```

### Screen Designs

#### Dashboard
```
┌─────────────────────────────────┐
│  GMAC Control Center      [●]  │  <- Profile/Settings
├─────────────────────────────────┤
│                                 │
│  ┌─────────┐ ┌─────────┐       │
│  │ 12 Apps │ │ 3 Alerts│       │
│  │    ●    │ │   ▲▲●   │       │
│  │ Healthy │ │ 1 crit  │       │
│  └─────────┘ └─────────┘       │
│                                 │
│  Recent Activity               │
│  ┌─────────────────────────┐   │
│  │ ● Deploy: my-app prod   │   │
│  │   2 min ago             │   │
│  ├─────────────────────────┤   │
│  │ ▲ Error: API timeout    │   │
│  │   5 min ago             │   │
│  ├─────────────────────────┤   │
│  │ ● User signup           │   │
│  │   12 min ago            │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  [Dashboard] [Activity] [Alerts] [Apps]  │
└─────────────────────────────────┘
```

#### Notifications/Alerts
```
┌─────────────────────────────────┐
│  ← Alerts                  [⋮] │
├─────────────────────────────────┤
│  [All] [Critical] [Errors] [New]│
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐   │
│  │ ▲ CRITICAL              │   │
│  │ Database connection     │   │
│  │ limit reached           │   │
│  │ my-app • 2 min ago      │   │
│  │                         │   │
│  │ [Acknowledge] [Snooze]  │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ ● ERROR                 │   │
│  │ Payment failed          │   │
│  │ customer@example.com    │   │
│  │ billing-app • 15 min    │   │
│  │                         │   │
│  │ [Acknowledge] [Resolve] │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

### API Requirements

#### New Endpoints for Mobile

```typescript
// POST /api/mobile/auth
// Generate or refresh mobile auth token
interface MobileAuthRequest {
  type: 'generate' | 'refresh';
  deviceId: string;
  deviceName: string;
}

interface MobileAuthResponse {
  token: string;
  expiresAt: Date;
  userId: string;
}

// GET /api/mobile/dashboard
// Aggregated dashboard data optimized for mobile
interface MobileDashboardResponse {
  apps: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  alerts: {
    total: number;
    critical: number;
    error: number;
    warning: number;
  };
  recentActivity: ActivityEvent[];  // Last 10
  lastUpdated: Date;
}

// POST /api/push/send
// Internal endpoint to send push notifications
interface PushSendRequest {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'default' | 'high';
}
```

### Implementation Tasks

#### 3.1 Backend Preparation
- [ ] Create mobile auth token system
  - [ ] `mobile_tokens` table
  - [ ] Token generation endpoint
  - [ ] Token validation middleware
- [ ] Set up Expo Push Service integration
  - [ ] Install expo-server-sdk
  - [ ] Create PushService class
  - [ ] Handle delivery receipts
- [ ] Create mobile-optimized API endpoints
  - [ ] `/api/mobile/auth`
  - [ ] `/api/mobile/dashboard`
- [ ] Add push triggers to notification service
  - [ ] On critical/error notification
  - [ ] Respect user preferences
  - [ ] Handle quiet hours

#### 3.2 App Foundation
- [ ] Initialize Expo project with Expo Router
- [ ] Set up project structure
- [ ] Configure app.json / app.config.js
- [ ] Set up TypeScript
- [ ] Configure TanStack Query
- [ ] Implement auth flow
  - [ ] QR code scan from web
  - [ ] Token storage in SecureStore
  - [ ] Auto-refresh logic

#### 3.3 Push Notifications
- [ ] Configure Expo Notifications
- [ ] Request permissions flow
- [ ] Register push token with backend
- [ ] Handle foreground notifications
- [ ] Handle background notifications
- [ ] Handle notification tap (deep linking)
- [ ] Badge count management

#### 3.4 Core Screens
- [ ] Dashboard screen
  - [ ] Health summary cards
  - [ ] Recent activity list
  - [ ] Pull to refresh
- [ ] Activity feed screen
  - [ ] Infinite scroll list
  - [ ] Filter chips
  - [ ] Event detail modal
- [ ] Notifications/Alerts screen
  - [ ] Notification list with swipe actions
  - [ ] Filter by severity/status
  - [ ] Bulk actions
- [ ] Applications screen
  - [ ] App list with status
  - [ ] App detail view
- [ ] Settings screen
  - [ ] Push preferences
  - [ ] Quiet hours
  - [ ] Sign out

#### 3.5 Polish
- [ ] Loading states and skeletons
- [ ] Error handling and retry
- [ ] Offline support (cached data)
- [ ] Haptic feedback
- [ ] Dark mode support
- [ ] App icon and splash screen

#### 3.6 Release
- [ ] TestFlight setup (iOS)
- [ ] Internal testing track (Android)
- [ ] App Store assets
- [ ] Privacy policy updates

### Project Structure

```
mobile/
├── app/                          # Expo Router screens
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── index.tsx             # Dashboard
│   │   ├── activity.tsx          # Activity feed
│   │   ├── alerts.tsx            # Notifications
│   │   └── apps.tsx              # Applications
│   ├── apps/
│   │   └── [id].tsx              # App detail
│   ├── alerts/
│   │   └── [id].tsx              # Alert detail
│   ├── settings/
│   │   ├── index.tsx             # Settings menu
│   │   ├── notifications.tsx     # Push preferences
│   │   └── account.tsx           # Account settings
│   ├── auth/
│   │   ├── login.tsx             # Login screen
│   │   └── scan.tsx              # QR code scanner
│   └── _layout.tsx               # Root layout
├── components/
│   ├── ActivityCard.tsx
│   ├── AlertCard.tsx
│   ├── AppCard.tsx
│   ├── HealthBadge.tsx
│   ├── SeverityBadge.tsx
│   └── ui/                       # Reusable UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       └── ...
├── lib/
│   ├── api.ts                    # API client
│   ├── auth.ts                   # Auth helpers
│   ├── push.ts                   # Push notification helpers
│   ├── storage.ts                # SecureStore wrapper
│   └── query.ts                  # TanStack Query setup
├── hooks/
│   ├── useAuth.ts
│   ├── useNotifications.ts
│   ├── useDashboard.ts
│   ├── useActivity.ts
│   └── useAlerts.ts
├── constants/
│   └── config.ts                 # API URL, etc.
├── app.json
├── package.json
└── tsconfig.json
```

### Estimated Time: 3-4 weeks

---

## Implementation Timeline

```
Week 1-2:   Phase 1 - Activity Feed
            └── Foundation for all event tracking

Week 3-4:   Phase 2 - Notifications Center  
            └── Alerting + push infrastructure

Week 5-8:   Phase 3 - Mobile Companion App
            └── iOS + Android app with push notifications
```

### Dependencies Graph

```
┌─────────────────────────────────┐
│        Activity Feed            │
│          (Week 1-2)             │
│                                 │
│  - Event ingestion              │
│  - Webhook handlers             │
│  - SSE streaming                │
│  - Activity UI                  │
└───────────────┬─────────────────┘
                │
                │ events flow into
                ▼
┌─────────────────────────────────┐
│     Notifications Center        │
│          (Week 3-4)             │
│                                 │
│  - Notification engine          │
│  - Deduplication                │
│  - Slack/Email delivery         │
│  - Push token storage           │
│  - In-app notification UI       │
└───────────────┬─────────────────┘
                │
                │ push notifications
                ▼
┌─────────────────────────────────┐
│     Mobile Companion App        │
│          (Week 5-8)             │
│                                 │
│  - Expo React Native app        │
│  - Push notifications           │
│  - Activity feed (mobile)       │
│  - Alert management             │
│  - Quick actions                │
└─────────────────────────────────┘
```

---

## Success Metrics

### Activity Feed
- Events ingested per day
- Average latency from webhook to display (target: <500ms)
- Filter usage patterns

### Notifications
- Alert acknowledgment time (MTTA)
- Notification delivery success rate (target: >99%)
- False positive rate (snoozed/dismissed without action)

### Mobile App
- Daily active users
- Push notification opt-in rate
- Time to acknowledge (mobile vs web)
- App store rating (target: 4.5+)

---

## Next Steps

1. **Review and approve this plan**
2. **Begin Phase 1: Activity Feed**
   - Start with database schema
   - Build ActivityService
   - Create webhook handlers
3. **Parallel work during Phase 1:**
   - Design notification rule schema
   - Research Expo Push API requirements
