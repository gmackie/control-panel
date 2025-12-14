# Control Panel Implementation Plan

## Current Issues Summary

### Authentication Issues (HIGHEST PRIORITY)
1. **No landing page for unauthenticated users** - App shows empty content instead of proper signin page
2. **Signout returns 405 error** - useAuth.signOut() does GET request but route expects POST
3. **Missing middleware** - No route protection, deleted from src/middleware.ts
4. **Conflicting signout implementations** - Custom signout route conflicts with NextAuth's built-in signout

### Navigation Issues
- Sidebar shows all navigation items even when not authenticated
- Most navigation links point to non-existent or incomplete pages
- No proper routing structure for nested navigation items

---

## Phase 1: Fix Authentication (IMMEDIATE)

### 1.1 Fix useAuth Hook
**File**: `src/hooks/useAuth.ts`

**Current Issue**:
```typescript
signOut: () => window.location.href = '/api/auth/signout', // GET request, returns 405
```

**Fix**: Use NextAuth's signOut function properly
```typescript
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    authenticated: status === 'authenticated',
    loading: status === 'loading',
    signOut: () => nextAuthSignOut({ callbackUrl: '/auth/signin' }),
  };
}
```

### 1.2 Create Middleware for Route Protection
**File**: `src/middleware.ts` (DELETED - needs recreation)

**Purpose**: Protect all routes except public ones
```typescript
import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
})

export const config = {
  matcher: [
    '/((?!api/auth|auth|_next/static|_next/image|favicon.ico|public).*)',
  ]
}
```

### 1.3 Create Proper Landing Page
**File**: `src/app/page.tsx`

**Current Issue**: Shows dashboard tabs even when not authenticated

**Fix**: Redirect to proper landing or signin page
- Option A: Create marketing landing page at `/` and move dashboard to `/dashboard`
- Option B: Redirect unauthenticated users to `/auth/signin` immediately

**Recommended**: Option B for now (simpler), Option A for production

### 1.4 Clean Up Auth Routes
**Actions**:
- Remove custom `/api/auth/signout/route.ts` (conflicts with NextAuth)
- Remove `/api/auth/github/route.ts` and `/api/auth/github/callback/route.ts` (NextAuth handles this)
- Keep only `/api/auth/[...nextauth]/route.ts`

### 1.5 Update MainLayout
**File**: `src/components/layout/main-layout.tsx`

**Current Issue**: Shows header with "Sign In" button but doesn't redirect unauthenticated users

**Fix**: Middleware will handle redirects, but layout should handle loading states better

---

## Phase 2: Page Structure Audit

### Pages in Sidebar Navigation (from main-layout.tsx)

#### ✅ Exists | ❌ Missing | ⚠️ Partial

| Route | Status | Priority | Description |
|-------|--------|----------|-------------|
| `/` | ⚠️ Partial | HIGH | Dashboard - exists but needs auth fix |
| `/infrastructure` | ⚠️ Partial | HIGH | Infrastructure page exists |
| `/infrastructure/cluster` | ❌ Missing | MEDIUM | Cluster management page |
| `/infrastructure/network` | ❌ Missing | LOW | Network management page |
| `/monitoring/metrics` | ❌ Missing | HIGH | Metrics dashboard |
| `/monitoring/alerts` | ✅ Exists | MEDIUM | Alerts page (`/alerts`) but wrong path |
| `/monitoring/logs` | ❌ Missing | MEDIUM | Logs viewer |
| `/integrations` | ✅ Exists | MEDIUM | Integrations overview |
| `/integrations/gitea` | ❌ Missing | MEDIUM | Gitea integration page |
| `/integrations/drone` | ❌ Missing | MEDIUM | Drone CI/CD page |
| `/integrations/harbor` | ❌ Missing | MEDIUM | Harbor registry page |
| `/integrations/argocd` | ❌ Missing | MEDIUM | ArgoCD deployment page |
| `/applications` | ✅ Exists | HIGH | Applications list |
| `/deployments` | ✅ Exists | HIGH | Deployments overview |
| `/deployments?tab=applications` | ⚠️ Partial | MEDIUM | Tab view of deployments |
| `/deployments?tab=repositories` | ⚠️ Partial | MEDIUM | Tab view of repos |
| `/deployments?tab=deploy` | ⚠️ Partial | MEDIUM | Deploy new app form |
| `/security/vulnerabilities` | ❌ Missing | LOW | Security vulnerabilities |
| `/security/access` | ❌ Missing | LOW | Access control |
| `/settings` | ❌ Missing | MEDIUM | Settings page |
| `/help` | ❌ Missing | LOW | Help documentation |

### Existing Pages Not in Sidebar

| Route | Purpose | Action |
|-------|---------|--------|
| `/services` | Services overview | Consider adding to sidebar or removing |
| `/services/[id]` | Service details | Keep as dynamic route |
| `/applications/[id]` | Application details | Keep as dynamic route |
| `/applications/[id]/integrations` | App integration details | Keep as dynamic route |
| `/applications/dashboard` | Duplicate? | Review and possibly merge with `/applications` |
| `/registry` | Container registry | Add to sidebar under Infrastructure? |
| `/cluster` | Cluster page | Duplicate of `/infrastructure/cluster`? |
| `/webhooks` | Webhooks management | Add to Settings? |
| `/alerts` | Should be `/monitoring/alerts` | Fix routing |
| `/costs` | Cost tracking | Add to sidebar under Monitoring? |
| `/health` | Health checks | Internal page or add to Monitoring? |
| `/secrets` | Secrets management | Add to Security? |
| `/starter` | Unknown purpose | Review and possibly remove |
| `/test` | Test page | Remove from production |
| `/simple-auth` | Test auth page | Remove from production |
| `/deployments/advanced` | Advanced deployments | Merge into main deployments? |

---

## Phase 3: Implementation Priority

### Sprint 1: Authentication & Core Navigation (1-2 days)
1. ✅ Fix useAuth hook to use proper NextAuth signOut
2. ✅ Create middleware.ts for route protection
3. ✅ Update landing page (/) to redirect unauthenticated users
4. ✅ Remove conflicting auth routes
5. ✅ Test complete auth flow (signin, signout, protected routes)

### Sprint 2: Core Infrastructure Pages (2-3 days)
1. **Monitoring Dashboard** (`/monitoring/metrics`)
   - Real-time metrics display
   - System health charts
   - Resource utilization graphs
   - Integration with Prometheus/monitoring APIs

2. **Cluster Management** (`/infrastructure/cluster`)
   - K8s cluster overview
   - Node list with status
   - Resource allocation
   - Scaling controls

3. **Settings Page** (`/settings`)
   - User preferences
   - API keys management
   - Notification settings
   - Integration configurations

### Sprint 3: Integration Pages (2-3 days)
1. **Gitea Integration** (`/integrations/gitea`)
   - Repository list
   - CI/CD status
   - Webhook configuration
   - User access management

2. **Harbor Registry** (`/integrations/harbor`)
   - Container images list
   - Image vulnerabilities
   - Registry statistics
   - Image deployment tracking

3. **ArgoCD Deployments** (`/integrations/argocd`)
   - Application deployments
   - Sync status
   - Deployment history
   - Rollback controls

4. **Drone CI/CD** (`/integrations/drone`)
   - Pipeline status
   - Build logs
   - Pipeline configuration
   - Trigger builds

### Sprint 4: Security & Advanced Features (1-2 days)
1. **Logs Viewer** (`/monitoring/logs`)
   - Centralized log aggregation
   - Log search and filtering
   - Real-time log streaming
   - Log export

2. **Secrets Management** (move to `/security/secrets`)
   - Kubernetes secrets viewer
   - Secrets rotation tracking
   - Secrets compliance checks

3. **Network Management** (`/infrastructure/network`)
   - Ingress configuration
   - Service mesh status
   - Network policies
   - DNS management

### Sprint 5: Polish & Cleanup (1 day)
1. Remove test pages (`/test`, `/simple-auth`, `/starter`)
2. Consolidate duplicate routes
3. Add proper error pages (404, 500)
4. Add loading states to all pages
5. Implement breadcrumb navigation
6. Add help documentation (`/help`)

---

## Page Implementation Template

Each new page should follow this structure:

```typescript
'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PageName() {
  const { data: session } = useSession()

  const { data, isLoading, error } = useQuery({
    queryKey: ['page-data'],
    queryFn: async () => {
      const res = await fetch('/api/your-endpoint')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">Loading...</div>
    </div>
  }

  if (error) {
    return <div className="p-4">
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">Error: {error.message}</p>
      </div>
    </div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Page Title</h1>
        <p className="text-muted-foreground">Page description</p>
      </div>

      {/* Page content */}
      <Card className="p-6">
        {/* Your content here */}
      </Card>
    </div>
  )
}
```

---

## API Routes to Implement

### Monitoring
- `GET /api/monitoring/metrics` - System metrics
- `GET /api/monitoring/logs` - Log entries
- `GET /api/monitoring/alerts` - Already exists at `/api/alerts`

### Infrastructure
- `GET /api/infrastructure/cluster` - Cluster status
- `GET /api/infrastructure/cluster/nodes` - Node list
- `POST /api/infrastructure/cluster/scale` - Scale cluster
- `GET /api/infrastructure/network` - Network config

### Integrations
- `GET /api/integrations/gitea/repos` - Repository list
- `GET /api/integrations/harbor/images` - Container images
- `GET /api/integrations/argocd/apps` - ArgoCD applications
- `GET /api/integrations/drone/pipelines` - Drone pipelines

### Security
- `GET /api/security/secrets` - Secrets list
- `GET /api/security/vulnerabilities` - Security scan results
- `GET /api/security/access` - Access control list

### Settings
- `GET /api/settings/user` - User preferences
- `PUT /api/settings/user` - Update preferences
- `GET /api/settings/integrations` - Integration configs
- `PUT /api/settings/integrations` - Update integration configs

---

## Success Criteria

### Phase 1 (Authentication)
- [ ] User can sign in with GitHub
- [ ] User can sign out without errors
- [ ] Unauthenticated users are redirected to signin
- [ ] Protected routes require authentication
- [ ] Session persists across page refreshes

### Phase 2-4 (Pages)
- [ ] All sidebar navigation links work
- [ ] Each page displays relevant data
- [ ] Loading states show while fetching data
- [ ] Error states display user-friendly messages
- [ ] Pages are responsive on mobile/tablet/desktop

### Phase 5 (Polish)
- [ ] No test/debug pages in production
- [ ] All routes have proper error handling
- [ ] Navigation is intuitive and consistent
- [ ] Help documentation is available
- [ ] Application is ready for production use

---

## Notes

- Keep fake data for now as requested
- Focus on UI/UX and navigation structure
- Real API integration can come later
- Prioritize getting the authentication and basic structure working
- Each sprint should result in deployable, testable features
