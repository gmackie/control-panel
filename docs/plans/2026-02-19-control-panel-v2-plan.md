# Control Panel V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a focused app-centric dashboard in `apps/web-v2/` that shows deployed application status across K8s and Vercel, with an infrastructure overview page.

**Architecture:** Parallel Next.js 15 app in the existing pnpm monorepo. Shares `packages/api` (tRPC routers + provider adapters) and `packages/db` (Neon PostgreSQL + Drizzle ORM). Cherry-picks UI primitives and service clients from `apps/web/`. 4 routes: home grid, app detail, infrastructure, settings.

**Tech Stack:** Next.js 15 (App Router), React 19, tRPC 11, React Query 5, Tailwind CSS 3, shadcn/ui (New York), Drizzle ORM, Neon PostgreSQL, SSE for real-time.

---

## Phase 1: Scaffold & Foundation

### Task 1: Create the web-v2 workspace

**Files:**
- Create: `apps/web-v2/package.json`
- Create: `apps/web-v2/next.config.mjs`
- Create: `apps/web-v2/tsconfig.json`
- Create: `apps/web-v2/tailwind.config.cjs`
- Create: `apps/web-v2/postcss.config.cjs`
- Create: `apps/web-v2/components.json`

**Step 1: Create package.json**

```json
{
  "name": "@repo/web-v2",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@auth/core": "^0.18.0",
    "@kubernetes/client-node": "^0.20.0",
    "@neondatabase/serverless": "^0.10.0",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.12",
    "@repo/api": "workspace:*",
    "@repo/db": "workspace:*",
    "@tanstack/react-query": "^5.62.7",
    "@tanstack/react-query-devtools": "^5.83.0",
    "@trpc/client": "^11.0.0-rc.660",
    "@trpc/react-query": "^11.0.0-rc.660",
    "@trpc/server": "^11.0.0-rc.660",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "drizzle-orm": "^0.45.0",
    "lucide-react": "^0.468.0",
    "next": "^15.5.9",
    "next-auth": "4.24.11",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "superjson": "^2.2.2",
    "tailwind-merge": "^3.4.0",
    "tailwindcss": "^3.4.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^20.10.0",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Copy config files from apps/web with minimal changes**

Copy these files from `apps/web/` to `apps/web-v2/`, keeping them identical:
- `tsconfig.json`
- `next.config.mjs`
- `tailwind.config.cjs` (update content paths to `./src/**/*.{ts,tsx}`)
- `postcss.config.cjs`
- `components.json`

**Step 3: Install dependencies**

Run: `cd /Volumes/dev/control-panel && pnpm install`

**Step 4: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): scaffold new web-v2 workspace"
```

---

### Task 2: Set up core app files (globals, layout, providers, utils)

**Files:**
- Create: `apps/web-v2/src/app/globals.css`
- Create: `apps/web-v2/src/app/layout.tsx`
- Create: `apps/web-v2/src/app/providers.tsx`
- Create: `apps/web-v2/src/lib/utils.ts`
- Create: `apps/web-v2/src/lib/auth.ts`
- Create: `apps/web-v2/src/lib/trpc/client.ts`
- Create: `apps/web-v2/src/lib/trpc/provider.tsx`
- Create: `apps/web-v2/src/lib/trpc/server.ts`
- Create: `apps/web-v2/src/middleware.ts`
- Create: `apps/web-v2/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web-v2/src/app/api/trpc/[trpc]/route.ts`

**Step 1: Copy globals.css from apps/web**

Copy `apps/web/src/app/globals.css` to `apps/web-v2/src/app/globals.css` — keep it identical.

**Step 2: Copy auth and trpc setup**

Copy these files identically from `apps/web/src/`:
- `lib/auth.ts` → `apps/web-v2/src/lib/auth.ts`
- `lib/trpc/client.ts` → `apps/web-v2/src/lib/trpc/client.ts`
- `lib/trpc/provider.tsx` → `apps/web-v2/src/lib/trpc/provider.tsx`
- `lib/trpc/server.ts` → `apps/web-v2/src/lib/trpc/server.ts`
- `lib/utils.ts` → `apps/web-v2/src/lib/utils.ts`
- `middleware.ts` → `apps/web-v2/src/middleware.ts`
- `app/api/auth/[...nextauth]/route.ts` → same path in web-v2
- `app/api/trpc/[trpc]/route.ts` → same path in web-v2

**Step 3: Create minimal providers.tsx**

```tsx
// apps/web-v2/src/app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TRPCProvider } from "@/lib/trpc/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProvider>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </TRPCProvider>
    </SessionProvider>
  );
}
```

No notification, command palette, or keyboard shortcut providers. Just auth + tRPC + devtools.

**Step 4: Create root layout.tsx**

```tsx
// apps/web-v2/src/app/layout.tsx
import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "GMAC.IO Control Panel",
  description: "Application deployment dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

Layout without MainLayout for now — we'll add it in Task 4.

**Step 5: Create a placeholder home page**

```tsx
// apps/web-v2/src/app/page.tsx
export default function Home() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Control Panel V2</h1></div>;
}
```

**Step 6: Verify the app starts**

Run: `cd /Volumes/dev/control-panel && pnpm --filter @repo/web-v2 dev`
Expected: Next.js dev server on port 3001, shows "Control Panel V2"

**Step 7: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): add core app files, auth, trpc, providers"
```

---

### Task 3: Copy UI primitives and essential lib files

**Files:**
- Copy directory: `apps/web/src/components/ui/` → `apps/web-v2/src/components/ui/`
- Copy: `apps/web/src/lib/cluster/k8s-api-client.ts` → `apps/web-v2/src/lib/cluster/k8s-api-client.ts`
- Copy: `apps/web/src/lib/cluster/orchestrator.ts` → same
- Copy: `apps/web/src/lib/cluster/modules/health-monitor.ts` → same
- Copy: `apps/web/src/lib/cluster/modules/cost-tracker.ts` → same
- Copy: `apps/web/src/lib/hetzner/client.ts` → same
- Copy: `apps/web/src/lib/hetzner/enhanced-client.ts` → same
- Copy: `apps/web/src/lib/harbor/client.ts` → same
- Copy: `apps/web/src/lib/harbor/service.ts` → same
- Copy: `apps/web/src/lib/prometheus/client.ts` → same
- Copy: `apps/web/src/lib/prometheus/prometheus-client.ts` → same
- Copy: `apps/web/src/lib/prometheus/alertmanager-client.ts` → same
- Copy: `apps/web/src/lib/gitea/client.ts` → same
- Copy: `apps/web/src/lib/gitea/gitea-service.ts` → same
- Copy: `apps/web/src/lib/db.ts` → same
- Copy: `apps/web/src/hooks/useAuth.ts` → same (if it exists)

**Step 1: Copy all UI components**

```bash
cp -r apps/web/src/components/ui/ apps/web-v2/src/components/ui/
```

**Step 2: Copy service client libraries**

```bash
# Cluster
mkdir -p apps/web-v2/src/lib/cluster/modules
cp apps/web/src/lib/cluster/k8s-api-client.ts apps/web-v2/src/lib/cluster/
cp apps/web/src/lib/cluster/orchestrator.ts apps/web-v2/src/lib/cluster/
cp apps/web/src/lib/cluster/modules/health-monitor.ts apps/web-v2/src/lib/cluster/modules/
cp apps/web/src/lib/cluster/modules/cost-tracker.ts apps/web-v2/src/lib/cluster/modules/

# Hetzner
mkdir -p apps/web-v2/src/lib/hetzner
cp apps/web/src/lib/hetzner/client.ts apps/web-v2/src/lib/hetzner/
cp apps/web/src/lib/hetzner/enhanced-client.ts apps/web-v2/src/lib/hetzner/

# Harbor
mkdir -p apps/web-v2/src/lib/harbor
cp apps/web/src/lib/harbor/client.ts apps/web-v2/src/lib/harbor/
cp apps/web/src/lib/harbor/service.ts apps/web-v2/src/lib/harbor/

# Prometheus
mkdir -p apps/web-v2/src/lib/prometheus
cp apps/web/src/lib/prometheus/client.ts apps/web-v2/src/lib/prometheus/
cp apps/web/src/lib/prometheus/prometheus-client.ts apps/web-v2/src/lib/prometheus/
cp apps/web/src/lib/prometheus/alertmanager-client.ts apps/web-v2/src/lib/prometheus/

# Gitea
mkdir -p apps/web-v2/src/lib/gitea
cp apps/web/src/lib/gitea/client.ts apps/web-v2/src/lib/gitea/
cp apps/web/src/lib/gitea/gitea-service.ts apps/web-v2/src/lib/gitea/

# DB
cp apps/web/src/lib/db.ts apps/web-v2/src/lib/
```

**Step 3: Fix any import issues — check TypeScript compiles**

Run: `cd /Volumes/dev/control-panel && pnpm --filter @repo/web-v2 typecheck`

If there are missing type imports (e.g., `@/types/cluster`), copy those type files too or inline the needed types. The goal is zero type errors on the copied files. It's OK to temporarily add `// @ts-nocheck` to files with deep dependency chains that we'll address as we build features — but note which files and resolve before the end.

**Step 4: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): copy UI primitives and service client libraries"
```

---

## Phase 2: Layout & Navigation

### Task 4: Build the app shell layout

**Files:**
- Create: `apps/web-v2/src/components/layout/app-shell.tsx`
- Create: `apps/web-v2/src/components/layout/sidebar.tsx`
- Create: `apps/web-v2/src/components/layout/top-bar.tsx`
- Create: `apps/web-v2/src/components/layout/cluster-status-indicator.tsx`
- Modify: `apps/web-v2/src/app/layout.tsx`

**Step 1: Build the sidebar**

Minimal sidebar with 4 nav items: Apps (home), Infrastructure, Settings, and a cluster health dot.

```tsx
// apps/web-v2/src/components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Server, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutGrid, label: "Apps" },
  { href: "/infrastructure", icon: Server, label: "Infrastructure" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-16 flex flex-col items-center py-4 gap-2 border-r border-border bg-card">
      <Link href="/" className="mb-4 text-lg font-bold text-primary">G</Link>
      {navItems.map((item) => {
        const isActive = item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </Link>
        );
      })}
    </aside>
  );
}
```

**Step 2: Build the top bar with cluster health indicator**

```tsx
// apps/web-v2/src/components/layout/cluster-status-indicator.tsx
"use client";

import { cn } from "@/lib/utils";

type ClusterStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export function ClusterStatusIndicator({ status = "unknown" }: { status?: ClusterStatus }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn("h-2.5 w-2.5 rounded-full", {
          "bg-green-500": status === "healthy",
          "bg-yellow-500": status === "degraded",
          "bg-red-500": status === "unhealthy",
          "bg-zinc-500": status === "unknown",
        })}
      />
      <span className="text-muted-foreground capitalize">{status}</span>
    </div>
  );
}
```

```tsx
// apps/web-v2/src/components/layout/top-bar.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { ClusterStatusIndicator } from "./cluster-status-indicator";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function TopBar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-medium text-muted-foreground">GMAC.IO</h1>
        <ClusterStatusIndicator />
      </div>
      <div className="flex items-center gap-3">
        {session?.user?.name && (
          <span className="text-sm text-muted-foreground">{session.user.name}</span>
        )}
        <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
```

**Step 3: Combine into app shell**

```tsx
// apps/web-v2/src/components/layout/app-shell.tsx
"use client";

import { useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">GMAC.IO Control Panel</h1>
          <p className="text-muted-foreground mb-6">Sign in to continue.</p>
          <a
            href="/api/auth/signin/github"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Sign in with GitHub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-16">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

**Step 4: Wire into root layout**

Update `apps/web-v2/src/app/layout.tsx`:

```tsx
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: "GMAC.IO Control Panel",
  description: "Application deployment dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
```

**Step 5: Verify layout renders**

Run: `pnpm --filter @repo/web-v2 dev`
Expected: Sidebar with 3 icons, top bar with "GMAC.IO" and cluster status dot, placeholder content.

**Step 6: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): add app shell layout with sidebar and top bar"
```

---

## Phase 3: App Grid (Home Page)

### Task 5: Build the app card component

**Files:**
- Create: `apps/web-v2/src/components/apps/app-card.tsx`
- Create: `apps/web-v2/src/components/apps/provider-badge.tsx`
- Create: `apps/web-v2/src/components/apps/health-dot.tsx`
- Create: `apps/web-v2/src/types/app.ts`

**Step 1: Define the app type**

```tsx
// apps/web-v2/src/types/app.ts
export type AppStatus = "healthy" | "degraded" | "unhealthy" | "unknown";
export type DeployProvider = "k8s" | "vercel";
export type GitProvider = "gitea" | "github";

export interface AppEnvironment {
  name: string; // "staging" | "production"
  provider: DeployProvider;
  status: AppStatus;
  podCount?: { ready: number; total: number };
  vercelStatus?: string; // "READY" | "BUILDING" | "ERROR"
  version?: string;
  lastDeployedAt?: string;
}

export interface AppSummary {
  id: string;
  name: string;
  slug: string;
  gitProvider: GitProvider;
  deployProviders: DeployProvider[];
  branch: string;
  latestCommit?: {
    sha: string;
    message: string;
    timestamp: string;
  };
  environments: AppEnvironment[];
  metrics?: {
    cpuPercent: number;
    memPercent: number;
    errorRate: number;
    p95Latency: number;
  };
  status: AppStatus;
}
```

**Step 2: Build the health dot and provider badge**

```tsx
// apps/web-v2/src/components/apps/health-dot.tsx
import { cn } from "@/lib/utils";
import type { AppStatus } from "@/types/app";

export function HealthDot({ status, size = "md" }: { status: AppStatus; size?: "sm" | "md" }) {
  return (
    <div
      className={cn("rounded-full", {
        "h-2 w-2": size === "sm",
        "h-2.5 w-2.5": size === "md",
        "bg-green-500": status === "healthy",
        "bg-yellow-500": status === "degraded",
        "bg-red-500": status === "unhealthy",
        "bg-zinc-500": status === "unknown",
      })}
    />
  );
}
```

```tsx
// apps/web-v2/src/components/apps/provider-badge.tsx
import { cn } from "@/lib/utils";

export function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
        {
          "bg-blue-500/10 text-blue-400": provider === "k8s",
          "bg-zinc-500/10 text-zinc-400": provider === "vercel",
          "bg-orange-500/10 text-orange-400": provider === "gitea",
          "bg-purple-500/10 text-purple-400": provider === "github",
        }
      )}
    >
      {provider}
    </span>
  );
}
```

**Step 3: Build the app card**

```tsx
// apps/web-v2/src/components/apps/app-card.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HealthDot } from "./health-dot";
import { ProviderBadge } from "./provider-badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Play, ScrollText, RotateCcw } from "lucide-react";
import type { AppSummary } from "@/types/app";

interface AppCardProps {
  app: AppSummary;
  onClick: () => void;
}

export function AppCard({ app, onClick }: AppCardProps) {
  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all hover:border-primary/30",
        {
          "border-yellow-600/30": app.status === "degraded",
          "border-red-600/30": app.status === "unhealthy",
        }
      )}
      onClick={onClick}
    >
      {/* Header: name + provider badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HealthDot status={app.status} />
          <span className="font-semibold text-sm">{app.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <ProviderBadge provider={app.gitProvider} />
          {app.deployProviders.map((p) => (
            <ProviderBadge key={p} provider={p} />
          ))}
        </div>
      </div>

      {/* Git line */}
      {app.latestCommit && (
        <p className="text-xs text-muted-foreground truncate mb-3">
          {app.branch} &bull; {app.latestCommit.sha.slice(0, 7)} &ldquo;{app.latestCommit.message}&rdquo;
          <span className="ml-1">
            {formatDistanceToNow(new Date(app.latestCommit.timestamp), { addSuffix: true })}
          </span>
        </p>
      )}

      {/* Environment status rows */}
      <div className="space-y-1.5 mb-3">
        {app.environments.map((env) => (
          <div key={env.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HealthDot status={env.status} size="sm" />
              <span className="text-muted-foreground capitalize">
                {env.provider === "k8s" ? `K8s ${env.name}` : "Vercel"}
              </span>
            </div>
            <span className="text-muted-foreground">
              {env.podCount
                ? `${env.podCount.ready}/${env.podCount.total} pods`
                : env.vercelStatus ?? "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Metrics row */}
      {app.metrics && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 border-t border-border pt-2">
          <span>CPU {app.metrics.cpuPercent}%</span>
          <span>MEM {app.metrics.memPercent}%</span>
          <span className={app.metrics.errorRate > 1 ? "text-red-400" : ""}>
            ERR {app.metrics.errorRate}%
          </span>
          <span>P95 {app.metrics.p95Latency}ms</span>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); }}>
          <Play className="h-3 w-3 mr-1" /> Deploy
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); }}>
          <ScrollText className="h-3 w-3 mr-1" /> Logs
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); }}>
          <RotateCcw className="h-3 w-3 mr-1" /> Restart
        </Button>
      </div>
    </Card>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): add app card component with health dots and provider badges"
```

---

### Task 6: Build the slide-over panel

**Files:**
- Create: `apps/web-v2/src/components/apps/app-slide-over.tsx`

**Step 1: Build slide-over panel**

A right-side panel that slides in when clicking an app card. Shows recent deploys, pod list, and a link to the full detail page.

```tsx
// apps/web-v2/src/components/apps/app-slide-over.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthDot } from "./health-dot";
import { cn } from "@/lib/utils";
import type { AppSummary } from "@/types/app";

interface AppSlideOverProps {
  app: AppSummary | null;
  onClose: () => void;
}

export function AppSlideOver({ app, onClose }: AppSlideOverProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          app ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[480px] bg-card border-l border-border shadow-2xl transition-transform duration-200",
          app ? "translate-x-0" : "translate-x-full"
        )}
      >
        {app && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <HealthDot status={app.status} />
                <h2 className="font-semibold">{app.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/apps/${app.slug}`}>
                  <Button variant="outline" size="sm">
                    Open <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Environments */}
              <section>
                <h3 className="text-sm font-medium mb-3">Environments</h3>
                <div className="space-y-2">
                  {app.environments.map((env) => (
                    <div
                      key={env.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <HealthDot status={env.status} size="sm" />
                        <span className="text-sm capitalize">{env.provider} {env.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {env.podCount
                          ? `${env.podCount.ready}/${env.podCount.total} pods`
                          : env.vercelStatus}
                        {env.version && ` • ${env.version}`}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Metrics */}
              {app.metrics && (
                <section>
                  <h3 className="text-sm font-medium mb-3">Current Metrics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "CPU", value: `${app.metrics.cpuPercent}%` },
                      { label: "Memory", value: `${app.metrics.memPercent}%` },
                      { label: "Error Rate", value: `${app.metrics.errorRate}%` },
                      { label: "P95 Latency", value: `${app.metrics.p95Latency}ms` },
                    ].map((m) => (
                      <div key={m.label} className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-lg font-semibold">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Placeholder for recent deploys and logs — will be wired later */}
              <section>
                <h3 className="text-sm font-medium mb-3">Recent Deployments</h3>
                <p className="text-sm text-muted-foreground">Loading...</p>
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): add app slide-over panel component"
```

---

### Task 7: Build the app grid home page

**Files:**
- Modify: `apps/web-v2/src/app/page.tsx`

**Step 1: Build the home page with app grid**

```tsx
// apps/web-v2/src/app/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { AppCard } from "@/components/apps/app-card";
import { AppSlideOver } from "@/components/apps/app-slide-over";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { AppSummary } from "@/types/app";

export default function AppsGrid() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppSummary | null>(null);

  // Fetch apps from tRPC — uses the existing applications router
  const { data: apps, isLoading } = trpc.applications.list.useQuery(undefined, {
    enabled: !!session,
  });

  // Transform DB apps into AppSummary format
  // This is a temporary mapper — in a later task we'll create a dedicated
  // tRPC procedure that returns the enriched AppSummary with K8s/Vercel status
  const appSummaries: AppSummary[] = (apps ?? []).map((app: any) => ({
    id: app.id,
    name: app.name,
    slug: app.slug ?? app.id,
    gitProvider: (app.gitProvider as any) ?? "gitea",
    deployProviders: [app.deployProvider ?? "k8s"].filter(Boolean) as any[],
    branch: app.defaultBranch ?? "main",
    latestCommit: app.latestCommitSha
      ? { sha: app.latestCommitSha, message: app.latestCommitMessage ?? "", timestamp: app.updatedAt ?? new Date().toISOString() }
      : undefined,
    environments: [],
    status: (app.status as any) ?? "unknown",
  }));

  const filtered = appSummaries.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleClose = useCallback(() => setSelectedApp(null), []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {appSummaries.length} apps across your infrastructure
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {search ? "No apps match your search." : "No applications found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((app) => (
            <AppCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
          ))}
        </div>
      )}

      {/* Slide-over */}
      <AppSlideOver app={selectedApp} onClose={handleClose} />
    </div>
  );
}
```

**Step 2: Verify the page renders**

Run: `pnpm --filter @repo/web-v2 dev`
Expected: Grid page with search, loading skeletons that resolve to app cards (or empty state). Clicking a card opens the slide-over.

**Step 3: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): add app grid home page with search and slide-over"
```

---

## Phase 4: App Detail Page

### Task 8: Build the app detail page with tabs

**Files:**
- Create: `apps/web-v2/src/app/apps/[slug]/page.tsx`
- Create: `apps/web-v2/src/app/apps/[slug]/layout.tsx`
- Create: `apps/web-v2/src/components/apps/detail/overview-tab.tsx`
- Create: `apps/web-v2/src/components/apps/detail/deployments-tab.tsx`
- Create: `apps/web-v2/src/components/apps/detail/logs-tab.tsx`
- Create: `apps/web-v2/src/components/apps/detail/metrics-tab.tsx`
- Create: `apps/web-v2/src/components/apps/detail/settings-tab.tsx`

**Step 1: Create the detail layout**

```tsx
// apps/web-v2/src/app/apps/[slug]/layout.tsx
export default function AppDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Step 2: Build stub tab components**

Create each tab as a minimal component that shows the tab name and fetches real data where available. Start with stubs that render section headers — we'll fill in real data in a follow-up task.

Each tab file in `apps/web-v2/src/components/apps/detail/` follows this pattern:

```tsx
// overview-tab.tsx
export function OverviewTab({ appId }: { appId: string }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Overview</h3>
      <p className="text-muted-foreground">App overview for {appId} — deploy status, git info, health charts.</p>
    </div>
  );
}
```

Repeat for: `DeploymentsTab`, `LogsTab`, `MetricsTab`, `SettingsTab`.

**Step 3: Build the detail page with tabs**

```tsx
// apps/web-v2/src/app/apps/[slug]/page.tsx
"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OverviewTab } from "@/components/apps/detail/overview-tab";
import { DeploymentsTab } from "@/components/apps/detail/deployments-tab";
import { LogsTab } from "@/components/apps/detail/logs-tab";
import { MetricsTab } from "@/components/apps/detail/metrics-tab";
import { SettingsTab } from "@/components/apps/detail/settings-tab";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "deployments", label: "Deployments" },
  { id: "logs", label: "Logs" },
  { id: "metrics", label: "Metrics" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as TabId) || "overview";

  const setTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{slug}</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab appId={slug} />}
      {activeTab === "deployments" && <DeploymentsTab appId={slug} />}
      {activeTab === "logs" && <LogsTab appId={slug} />}
      {activeTab === "metrics" && <MetricsTab appId={slug} />}
      {activeTab === "settings" && <SettingsTab appId={slug} />}
    </div>
  );
}
```

**Step 4: Verify navigation works**

Run dev server. Click an app card → slide-over → "Open" button → should navigate to `/apps/[slug]` with tabs.

**Step 5: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): add app detail page with 5 tab stubs"
```

---

## Phase 5: Infrastructure Page

### Task 9: Build the infrastructure page

**Files:**
- Create: `apps/web-v2/src/app/infrastructure/page.tsx`
- Create: `apps/web-v2/src/components/infra/node-grid.tsx`
- Create: `apps/web-v2/src/components/infra/pod-table.tsx`
- Create: `apps/web-v2/src/components/infra/cost-summary.tsx`

**Step 1: Create stub components for node grid, pod table, and costs**

Each component fetches from the existing tRPC routers or API routes. Start with the structure and placeholder content.

```tsx
// apps/web-v2/src/components/infra/node-grid.tsx
"use client";

export function NodeGrid() {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Nodes</h2>
      <p className="text-muted-foreground">Hetzner VPS nodes will appear here.</p>
    </section>
  );
}
```

```tsx
// apps/web-v2/src/components/infra/pod-table.tsx
"use client";

export function PodTable() {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Pods</h2>
      <p className="text-muted-foreground">K8s pod status will appear here.</p>
    </section>
  );
}
```

```tsx
// apps/web-v2/src/components/infra/cost-summary.tsx
"use client";

export function CostSummary() {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Costs & Capacity</h2>
      <p className="text-muted-foreground">Hetzner costs and resource utilization will appear here.</p>
    </section>
  );
}
```

**Step 2: Build the infrastructure page**

```tsx
// apps/web-v2/src/app/infrastructure/page.tsx
import { NodeGrid } from "@/components/infra/node-grid";
import { PodTable } from "@/components/infra/pod-table";
import { CostSummary } from "@/components/infra/cost-summary";

export default function InfrastructurePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Infrastructure</h1>
        <p className="text-sm text-muted-foreground mt-1">Cluster health, pods, and costs</p>
      </div>
      <NodeGrid />
      <PodTable />
      <CostSummary />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): add infrastructure page with stub components"
```

---

## Phase 6: Settings Page

### Task 10: Build the settings page

**Files:**
- Create: `apps/web-v2/src/app/settings/page.tsx`

**Step 1: Build a minimal settings page**

Reuse the API keys tRPC router from the existing packages/api. Keep it simple — just API key management and basic info.

```tsx
// apps/web-v2/src/app/settings/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Account and configuration</p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{session?.user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{session?.user?.email ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider</span>
            <span>GitHub</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>
        <p className="text-sm text-muted-foreground">API key management will be wired here via tRPC.</p>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web-v2/
git commit -m "feat(web-v2): add settings page with account info"
```

---

## Phase 7: Wire Real Data

### Task 11: Wire app grid to real K8s + Vercel data

This is the most important task — making the app cards show real deployment status.

**Files:**
- Create: `apps/web-v2/src/lib/app-enrichment.ts`
- Modify: `apps/web-v2/src/app/page.tsx`

**Step 1: Create an app enrichment function**

This server-side function takes DB applications and enriches them with live K8s pod status and Vercel deployment status from the existing provider adapters in `packages/api`.

The exact implementation depends on what tRPC procedures are available. Check `packages/api/src/routers/applications.ts` for the `list` procedure's return shape. If it already returns deploy/health data, use it directly. If not, create a new tRPC procedure `applications.listWithStatus` that:
1. Fetches apps from DB
2. For each K8s app: queries pod status via the K8s provider
3. For each Vercel app: queries latest deployment via the Vercel provider
4. Returns the enriched `AppSummary[]`

This is a design-then-implement step. Read the existing router, decide the right approach, build it.

**Step 2: Wire the home page to use enriched data**

Update `page.tsx` to use the new enriched tRPC procedure instead of the basic `applications.list`.

**Step 3: Commit**

```bash
git commit -m "feat(web-v2): wire app grid to real K8s and Vercel status data"
```

---

### Task 12: Wire infrastructure page to real data

**Files:**
- Modify: `apps/web-v2/src/components/infra/node-grid.tsx`
- Modify: `apps/web-v2/src/components/infra/pod-table.tsx`
- Modify: `apps/web-v2/src/components/infra/cost-summary.tsx`

**Step 1: Wire NodeGrid to Hetzner API**

Use the existing cluster/infrastructure tRPC routers or create API routes that call the Hetzner client at `src/lib/hetzner/client.ts` to fetch server list.

**Step 2: Wire PodTable to K8s API**

Use the K8s API client at `src/lib/cluster/k8s-api-client.ts` to list pods. Display in a filterable table.

**Step 3: Wire CostSummary to Hetzner cost data**

Use the cost tracker module at `src/lib/cluster/modules/cost-tracker.ts`.

**Step 4: Commit**

```bash
git commit -m "feat(web-v2): wire infrastructure page to Hetzner, K8s, and cost data"
```

---

### Task 13: Wire app detail tabs to real data

**Files:**
- Modify: All tab components in `apps/web-v2/src/components/apps/detail/`

**Step 1: Overview tab** — Wire to tRPC `applications.getById`, show deploy environments, git info, health metrics chart.

**Step 2: Deployments tab** — Wire to existing deployment data (K8s rollout history, Vercel deploy list). Show deploy/rollback buttons.

**Step 3: Logs tab** — Wire to K8s pod log streaming (SSE or polling). For Vercel, show a link to Vercel dashboard.

**Step 4: Metrics tab** — Wire to Prometheus client for CPU/MEM/latency/error charts over configurable time ranges.

**Step 5: Settings tab** — Wire to tRPC for app config: env vars, secrets, git repo link, delete app.

**Step 6: Commit per tab** — One commit per tab as you complete it.

---

### Task 14: Wire cluster health to top bar

**Files:**
- Modify: `apps/web-v2/src/components/layout/top-bar.tsx`
- Modify: `apps/web-v2/src/components/layout/cluster-status-indicator.tsx`

**Step 1: Create SSE connection to cluster health**

Use the existing `/api/cluster/health/stream` endpoint or create a new one in web-v2. Update `ClusterStatusIndicator` to show real-time cluster status.

**Step 2: Commit**

```bash
git commit -m "feat(web-v2): wire cluster health indicator to real-time SSE"
```

---

## Phase 8: Polish & Cleanup

### Task 15: Verify all pages work end-to-end

**Step 1:** Run `pnpm --filter @repo/web-v2 dev` and manually test all 4 routes.
**Step 2:** Run `pnpm --filter @repo/web-v2 typecheck` — fix any type errors.
**Step 3:** Run `pnpm --filter @repo/web-v2 build` — ensure production build passes.

### Task 16: Update turbo.json and root scripts

**Files:**
- Modify: `turbo.json` if needed for web-v2 pipeline
- Modify: root `package.json` to add `dev:web-v2` script

Add: `"dev:web-v2": "turbo dev --filter=@repo/web-v2"` to root package.json scripts.

**Commit:**

```bash
git commit -m "chore: add web-v2 to turbo pipeline and root scripts"
```
