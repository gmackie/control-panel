# Control Panel V2 — App-Centric Dashboard Redesign

**Date:** 2026-02-19
**Approach:** Parallel build in `apps/web-v2/` alongside existing `apps/web/`

## Problem

The current control panel has 50 pages, 183 API routes, 142 components, and 42k lines of dead Python code. Most of it is stubbed, returns mock data, or serves a vision that was never completed. The app needs to be rebuilt around what actually matters: deployed applications and their status across K8s and Vercel.

## Design Decisions

- **App-centric grid** as the home view — not environment-centric, not timeline-based
- **Minimal navigation** — 4 routes total, everything else is drill-down
- **Information-dense cards** — deploy status, git/CI, health metrics, quick actions all visible at a glance
- **Slide-over for quick looks**, full page for deep operations
- **No mock data** — show "not connected" if a service isn't configured
- **Parallel build** — new `apps/web-v2/` workspace, shared `packages/api` and `packages/db`

## Route Structure

| Route | Purpose |
|-------|---------|
| `/` | App grid — grid of all applications with dense status cards |
| `/apps/[slug]` | App detail — full page with tabs for deep operations |
| `/infrastructure` | Cluster view — node health, pod status, Hetzner costs |
| `/settings` | Auth config, API keys, preferences |

Layout: Minimal sidebar with 4 icons. Top bar with cluster health indicator (green/yellow/red).

## App Card Design

```
┌─────────────────────────────────────────────┐
│ ● my-app                        [K8s][Vrcel]│
│   main • a3f2b1c "fix auth flow"   2m ago   │
│                                              │
│  K8s staging  ● 3/3 pods   Vercel ● Live    │
│  K8s prod     ● 2/2 pods   ─────────────    │
│                                              │
│  CPU 23%  MEM 41%  ERR 0.1%  P95 120ms     │
│                                              │
│  [Deploy ▾]  [Logs]  [Restart]              │
└─────────────────────────────────────────────┘
```

**Top row:** App name, git/deploy provider badges (Gitea/GitHub, K8s/Vercel)
**Git line:** Branch, short SHA, commit message, time ago
**Deploy status:** Per-environment — pod counts for K8s, deployment status for Vercel
**Metrics row:** CPU, memory, error rate, P95 latency (from Prometheus)
**Actions:** Deploy dropdown (pick environment), logs shortcut, restart

**Card states:**
- Healthy — default dark card, green status dots
- Degraded — yellow border, yellow dots (pods restarting, high error rate)
- Unhealthy — red border, red dots (pods down, deploy failed)

**Slide-over panel** (on card click): Recent deploys, live log tail, pod list, "Open full view" link.

## App Detail Page (`/apps/[slug]`)

Five tabs:

1. **Overview** — Expanded card info: deploy status, git info, health metrics charts (24h), activity timeline
2. **Deployments** — Deploy history per environment. Trigger deploy, rollback. Image tag, commit SHA, who/when. K8s rollout status, Vercel build logs link
3. **Logs** — Live log tail from K8s pods (pod/container selector). Vercel: link to dashboard
4. **Metrics** — Prometheus charts: CPU, memory, network, errors, latency. Configurable time range. Per-pod breakdown
5. **Settings** — Git repo link, deploy targets, env vars, secrets, webhooks, delete app

Explicitly excluded: payments, analytics, users, integrations hub, AI dev, Notion sync, task board.

## Infrastructure Page (`/infrastructure`)

Single page, two sections:

**Top: Node & Pod Health**
- Hetzner VPS node grid: hostname, IP, status, CPU/MEM/disk
- K8s cluster summary: pods running/pending/failed, node count, version
- Pod table filterable by namespace/status — restarts, age, resource usage
- Real-time via SSE

**Bottom: Costs & Capacity**
- Monthly Hetzner spend (from API)
- Per-node cost breakdown
- Resource utilization vs capacity
- Month-over-month trend

Read-only and observational. No autoscaling UI, no node provisioning wizard.

## Technical Architecture

### New workspace: `apps/web-v2/`

Fresh Next.js 15 app with App Router.

### Shared packages (unchanged):
- `packages/api` — tRPC routers + provider adapters (Vercel, K8s, GitHub, Gitea, Neon)
- `packages/db` — Neon PostgreSQL schema + Drizzle ORM

### Cherry-picked from `apps/web/`:
- `src/components/ui/` — shadcn/ui primitives
- Auth setup (NextAuth + middleware)
- `src/lib/cluster/` — K8s API client, health monitor, cost tracker
- `src/lib/hetzner/` — Hetzner client
- `src/lib/harbor/` — Harbor client + service
- `src/lib/prometheus/` — Prometheus + AlertManager clients
- `src/lib/gitea/` — Gitea client + service
- `src/lib/auth.ts`

### Built new:
- App grid page with dense status cards
- Slide-over panel component
- App detail page with 5 tabs
- Infrastructure page (node health + costs)
- Minimal settings page
- New layout (slim sidebar, cluster health top bar indicator)

### Data fetching:
- tRPC + React Query for all data
- SSE for real-time health/logs
- No raw fetch() — everything through typed tRPC layer

### Explicitly excluded:
- Mobile app integration (separate concern)
- All root-level Python scripts (dead code)
- Mock data fallbacks
- Integration hub dashboards (Stripe, Clerk, ElevenLabs, etc.)
- Task board, products, quick-start wizard, starter generator
