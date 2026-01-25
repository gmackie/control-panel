# Control Panel Genericization: Design Document

> **Status**: Draft v1.0  
> **Date**: January 10, 2026  
> **Author**: Architecture Review  

## Executive Summary

This document outlines the plan to transform the GMAC.IO Control Panel from a bespoke internal tool into a generic, self-hostable application lifecycle management platform. The goal is to enable any developer or small team to deploy their own instance and manage their applications with the same capabilities.

---

## Part 1: Architecture Decision Records (ADRs)

### ADR-001: Deployment Strategy - Vercel-First with K8s Escape Hatch

**Status**: Proposed

**Context**: Users need to deploy applications. Current system is K8s-only, which has high operational overhead.

**Decision**: **Vercel as default, K8s as optional power-user feature**

| Workload Type | Recommended Platform | Rationale |
|---------------|---------------------|-----------|
| Web apps (Next.js, static) | Vercel | Zero-config, automatic scaling, preview deployments |
| APIs (serverless) | Vercel Functions | Same deployment, no separate infra |
| Background jobs | Vercel Cron + Functions | Simple cron, scales to zero |
| Long-running processes | K8s (optional) | When you need persistent processes |
| WebSocket servers | K8s or Railway | Vercel doesn't support long-lived connections |
| Self-hosted requirement | K8s | Full control, air-gapped environments |

**Abstraction Layer**:
```typescript
interface DeploymentProvider {
  deploy(app: Application, options: DeployOptions): Promise<Deployment>;
  rollback(deploymentId: string): Promise<void>;
  getStatus(deploymentId: string): Promise<DeploymentStatus>;
  getLogs(deploymentId: string, options?: LogOptions): AsyncIterable<LogEntry>;
}

// Implementations
class VercelProvider implements DeploymentProvider { }
class K8sProvider implements DeploymentProvider { }
class RailwayProvider implements DeploymentProvider { }  // Future
```

**Consequences**:
- Most users get simple Vercel deployments
- Power users can opt into K8s complexity
- Control panel itself can run on either

---

### ADR-002: Git Provider Abstraction

**Status**: Proposed

**Context**: Currently tightly coupled to Gitea. Users may prefer GitHub or GitLab.

**Decision**: **GitHub as default, pluggable providers**

| Provider | Priority | Use Case |
|----------|----------|----------|
| GitHub | P0 (Default) | Most users, best ecosystem |
| Gitea | P1 | Self-hosted, existing GMAC setup |
| GitLab | P2 | Enterprise users |

**Interface**:
```typescript
interface GitProvider {
  // Repository operations
  listRepos(): Promise<Repository[]>;
  getRepo(owner: string, name: string): Promise<Repository>;
  createRepo(options: CreateRepoOptions): Promise<Repository>;
  
  // Webhook management
  createWebhook(repo: Repository, config: WebhookConfig): Promise<Webhook>;
  
  // CI/CD status
  getWorkflowRuns(repo: Repository): Promise<WorkflowRun[]>;
  
  // Releases
  createRelease(repo: Repository, release: ReleaseOptions): Promise<Release>;
}
```

**Consequences**:
- New users can start with GitHub (zero setup)
- Existing Gitea users continue working
- CI/CD abstraction follows naturally

---

### ADR-003: Auth Provider Strategy

**Status**: Proposed

**Context**: Currently uses NextAuth with GitHub OAuth (single user). Need multi-user support.

**Decision**: **Clerk as recommended default, NextAuth as fallback**

| Scenario | Recommendation |
|----------|----------------|
| New users wanting quick setup | Clerk (managed) |
| Self-hosted, privacy-focused | NextAuth + own OAuth |
| Enterprise with existing IdP | NextAuth + SAML/OIDC |

**For Control Panel Auth**:
```typescript
// Control panel uses Clerk by default
// Users configure their own apps' auth separately
interface AuthConfig {
  provider: 'clerk' | 'nextauth';
  // Clerk config
  clerkPublishableKey?: string;
  clerkSecretKey?: string;
  // NextAuth config  
  nextAuthProviders?: AuthProvider[];
}
```

**Consequences**:
- Clerk provides best UX out of box (social login, MFA, user management)
- Self-hosters can use NextAuth with any provider
- Control panel auth is separate from managed apps' auth

---

### ADR-004: Database Strategy

**Status**: Proposed

**Context**: Control panel uses Neon (Postgres). Template uses Neon. Need flexibility.

**Decision**: **Neon as default, support Turso and self-hosted Postgres**

| Database | Use Case | Pros | Cons |
|----------|----------|------|------|
| Neon | Default | Serverless, branching, generous free tier | Postgres-only |
| Turso | Edge-first apps | SQLite, global replication, very cheap | Less mature ORM support |
| Self-hosted Postgres | Enterprise/compliance | Full control | Operational overhead |

**Implementation**:
- Drizzle ORM abstracts database differences
- Schema remains Postgres-compatible
- Turso requires schema translation (future)

```typescript
// packages/db/src/client.ts
export function createDb(config: DbConfig) {
  switch (config.provider) {
    case 'neon':
      return drizzle(neon(config.connectionString), { schema });
    case 'turso':
      return drizzle(createClient(config.tursoConfig), { schema });
    case 'postgres':
      return drizzle(postgres(config.connectionString), { schema });
  }
}
```

---

### ADR-005: CI/CD Approach

**Status**: Proposed

**Context**: Currently uses Gitea Actions. Need provider-agnostic CI/CD.

**Decision**: **GitHub Actions as default, generate CI configs per provider**

**Standard Pipeline Stages**:
```yaml
# .github/workflows/ci.yml (generated)
name: CI/CD
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, pnpm install, pnpm lint]
    
  typecheck:
    runs-on: ubuntu-latest  
    steps: [checkout, setup-node, pnpm install, pnpm typecheck]
    
  test:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, pnpm install, pnpm test]
    
  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, pnpm install, pnpm build]
    
  deploy-preview:
    if: github.event_name == 'pull_request'
    needs: [build]
    # Vercel preview deployment
    
  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: [build]
    # Vercel production deployment
```

**Secrets Injection**:
- GitHub: Use GitHub Secrets + Vercel integration
- Gitea: Use Gitea Secrets + webhook to control panel
- Control panel syncs secrets to CI environments

---

## Part 2: System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONTROL PANEL                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Web UI    │  │  tRPC API   │  │ MCP Server  │  │  Webhooks   │    │
│  │  (Next.js)  │  │  (Router)   │  │ (AI Tools)  │  │  (Ingest)   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                                   │                                      │
│                        ┌──────────┴──────────┐                          │
│                        │   Core Services     │                          │
│                        │  ┌───────────────┐  │                          │
│                        │  │ App Manager   │  │                          │
│                        │  │ Deploy Manager│  │                          │
│                        │  │ Integration   │  │                          │
│                        │  │   Manager     │  │                          │
│                        │  │ Secret Manager│  │                          │
│                        │  └───────────────┘  │                          │
│                        └──────────┬──────────┘                          │
│                                   │                                      │
│  ┌────────────────────────────────┴────────────────────────────────┐   │
│  │                    Provider Adapters                             │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │ Vercel  │ │ GitHub  │ │  Clerk  │ │  Neon   │ │ Stripe  │   │   │
│  │  │Adapter  │ │Adapter  │ │Adapter  │ │Adapter  │ │Adapter  │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │   │
│  │  │   K8s   │ │  Gitea  │ │  Turso  │ │ PostHog │               │   │
│  │  │Adapter  │ │Adapter  │ │Adapter  │ │Adapter  │               │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   Vercel    │ │   GitHub    │ │    Neon     │
            │  (Deploy)   │ │   (Code)    │ │    (DB)     │
            └─────────────┘ └─────────────┘ └─────────────┘
```

### Data Flow: Application Creation

```
User clicks "Create App"
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Wizard collects: name, slug, template, integrations needed   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Control Panel creates Application record in DB               │
│    - Generates unique slug                                       │
│    - Sets initial status: "provisioning"                        │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. GitProvider.createRepo()                                      │
│    - Creates repo from template                                  │
│    - Replaces placeholders with app slug                        │
│    - Sets up branch protection                                   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. For each selected integration:                                │
│    - DatabaseProvider.createDatabase() → connection string      │
│    - AuthProvider.createApp() → API keys                        │
│    - PaymentProvider.createWebhook() → webhook secret           │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. DeployProvider.configure()                                    │
│    - Link Vercel project to repo                                │
│    - Set environment variables                                   │
│    - Configure preview deployments                              │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Initial deployment triggered                                  │
│    - CI runs: lint → test → build → deploy                      │
│    - Control panel receives webhook on completion               │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Application status updated to "active"                        │
│    - User redirected to app dashboard                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Template App Specification

### Directory Structure (Target State)

```
vercel-neon-expo-template/
├── .template/                      # NEW: Template metadata
│   ├── config.json                 # Template configuration
│   ├── placeholders.json           # Placeholder definitions
│   └── integrations/               # Optional integration modules
│       ├── stripe.json
│       ├── clerk.json
│       └── posthog.json
│
├── apps/
│   ├── web/                        # Next.js (always included)
│   └── mobile/                     # Expo (optional)
│
├── packages/
│   ├── api/                        # tRPC (always included)
│   ├── db/                         # Drizzle (always included)
│   ├── shared/                     # Types/utils (always included)
│   ├── analytics/                  # PostHog (optional module)
│   ├── monitoring/                 # Sentry (optional module)
│   ├── payments/                   # Stripe (optional module)
│   ├── email/                      # Email (optional module)
│   └── auth/                       # NEW: Auth abstraction
│
├── scripts/
│   ├── setup.sh                    # ENHANCED: More automation
│   ├── provision.sh                # ENHANCED: Control panel integration
│   └── register.sh                 # NEW: Register with control panel
│
└── turbo.json
```

### Placeholder Convention

```json
// .template/placeholders.json
{
  "placeholders": {
    "{{APP_NAME}}": {
      "description": "Human-readable app name",
      "example": "My SaaS App",
      "files": ["apps/web/src/app/layout.tsx", "apps/mobile/app.json"]
    },
    "{{APP_SLUG}}": {
      "description": "URL-safe identifier",
      "example": "my-saas-app",
      "validation": "^[a-z0-9-]+$",
      "files": ["package.json", "apps/*/package.json", "packages/*/package.json"]
    },
    "{{PACKAGE_SCOPE}}": {
      "description": "npm package scope",
      "example": "@my-saas-app",
      "derived_from": "APP_SLUG",
      "transform": "slug => `@${slug}`"
    }
  }
}
```

### Integration Module System

```json
// .template/integrations/stripe.json
{
  "id": "stripe",
  "name": "Stripe Payments",
  "description": "Accept payments with Stripe",
  "category": "payments",
  
  "package": "packages/payments",
  "dependencies": {
    "stripe": "^14.0.0",
    "@stripe/stripe-js": "^2.0.0"
  },
  
  "envVars": {
    "required": [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET"
    ],
    "public": [
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
    ]
  },
  
  "files": {
    "include": [
      "packages/payments/**",
      "apps/web/src/app/api/webhooks/stripe/**"
    ]
  },
  
  "setup": {
    "manual": "Create a Stripe account at https://dashboard.stripe.com",
    "provision": {
      "command": "stripe login && stripe listen --forward-to localhost:3000/api/webhooks/stripe",
      "instructions": "Run this in a separate terminal during development"
    }
  }
}
```

### CLI Tool Design (Future)

```bash
# Create new app from template
npx create-gmac-app my-app

# Interactive prompts:
# ? App name: My SaaS App
# ? Include mobile app? (Y/n)
# ? Select integrations:
#   [x] Clerk (Authentication)
#   [x] Stripe (Payments)
#   [ ] PostHog (Analytics)
#   [ ] Sentry (Monitoring)
# ? Database provider:
#   > Neon (recommended)
#     Turso
#     Self-hosted Postgres
# ? Register with Control Panel? (Y/n)
#   Enter your Control Panel URL: https://control.example.com
#   Enter your API key: cp_...

# Creates app, provisions resources, registers with control panel
```

---

## Part 4: UI/UX Recommendations

### Key Screens

| Screen | Purpose | Priority |
|--------|---------|----------|
| **Dashboard** | Overview of all apps, quick stats, recent activity | P0 |
| **Applications List** | Grid/list of apps with health indicators | P0 |
| **Application Detail** | Single app: deployments, integrations, settings | P0 |
| **Create App Wizard** | Step-by-step app creation | P0 |
| **Integrations Hub** | Org-level integration management | P1 |
| **Settings** | User profile, API keys, org settings | P1 |
| **Costs** | Spending across all apps and providers | P2 |

### Application Creation Wizard Flow

```
Step 1: Basics
┌─────────────────────────────────────────────────────────────┐
│  Create New Application                              [1/4]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  App Name                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ My SaaS App                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Slug (auto-generated, editable)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ my-saas-app                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│  Will be used for: URLs, namespaces, package names         │
│                                                             │
│  Template                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ▼ Full Stack (Web + Mobile + API)                   │   │
│  │   Web Only (Next.js)                                │   │
│  │   API Only (tRPC + DB)                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                    [Cancel]  [Next →]       │
└─────────────────────────────────────────────────────────────┘

Step 2: Integrations
┌─────────────────────────────────────────────────────────────┐
│  Select Integrations                                 [2/4]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Authentication                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] Clerk (recommended)                             │   │
│  │     Social login, MFA, user management              │   │
│  │ [ ] NextAuth                                        │   │
│  │     Self-hosted, flexible providers                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Database                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] Neon (recommended)                              │   │
│  │     Serverless Postgres, autoscaling, branching     │   │
│  │ [ ] Turso                                           │   │
│  │     SQLite at the edge, global replication          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Payments (optional)                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] Stripe                                          │   │
│  │     Subscriptions, one-time payments, invoicing     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Analytics (optional)                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [ ] PostHog                                         │   │
│  │     Product analytics, feature flags, session replay│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                  [← Back]  [Next →]         │
└─────────────────────────────────────────────────────────────┘

Step 3: Git & Deployment
┌─────────────────────────────────────────────────────────────┐
│  Git & Deployment                                    [3/4]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Git Provider                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] GitHub (connected as @gmackie)                  │   │
│  │ [ ] Gitea (git.gmac.dev)                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Repository                                                 │
│  ○ Create new repository: gmackie/my-saas-app              │
│  ○ Use existing repository: [Select...]                    │
│                                                             │
│  Deployment Platform                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] Vercel (recommended)                            │   │
│  │     Automatic deployments, preview URLs             │   │
│  │ [ ] Kubernetes                                      │   │
│  │     Self-managed, more control                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Environments                                               │
│  [✓] Production (main branch)                              │
│  [✓] Staging (develop branch)                              │
│  [✓] Preview (pull requests)                               │
│                                                             │
│                                  [← Back]  [Next →]         │
└─────────────────────────────────────────────────────────────┘

Step 4: Review & Create
┌─────────────────────────────────────────────────────────────┐
│  Review & Create                                     [4/4]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Summary                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ App Name:     My SaaS App                           │   │
│  │ Slug:         my-saas-app                           │   │
│  │ Template:     Full Stack (Web + Mobile + API)       │   │
│  │                                                     │   │
│  │ Integrations:                                       │   │
│  │   • Clerk (Authentication)                          │   │
│  │   • Neon (Database)                                 │   │
│  │   • Stripe (Payments)                               │   │
│  │                                                     │   │
│  │ Git:          github.com/gmackie/my-saas-app        │   │
│  │ Deploy:       Vercel                                │   │
│  │ Environments: production, staging, preview          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  What will happen:                                          │
│  1. Create GitHub repository from template                  │
│  2. Create Neon database project                           │
│  3. Create Clerk application                               │
│  4. Set up Stripe webhook                                  │
│  5. Connect Vercel project                                 │
│  6. Configure environment variables                        │
│  7. Trigger initial deployment                             │
│                                                             │
│  Estimated time: ~2 minutes                                │
│                                                             │
│                                [← Back]  [Create App]       │
└─────────────────────────────────────────────────────────────┘
```

### Design System Recommendations

**Component Library**: Continue with **shadcn/ui** (already in use)
- Tailwind-based, highly customizable
- Accessible components
- Good dark mode support

**Improvements Needed**:
1. **Consistent spacing/sizing** - Define design tokens
2. **Loading states** - Skeleton loaders for all data-fetching components
3. **Empty states** - Helpful messages when no data exists
4. **Error boundaries** - Graceful error handling with retry options
5. **Mobile responsiveness** - Current UI needs responsive improvements

---

## Part 5: Migration Plan

### Phase 1: Foundation (Weeks 1-3)

**Goal**: Establish provider abstraction layer without breaking existing functionality

| Task | Effort | Risk |
|------|--------|------|
| Create provider interfaces (Git, Deploy, Auth, DB) | 3 days | Low |
| Implement GitHub adapter (new default) | 2 days | Low |
| Implement Vercel adapter (new default) | 2 days | Low |
| Refactor existing Gitea code into adapter | 2 days | Medium |
| Refactor existing K8s code into adapter | 3 days | Medium |
| Add provider selection to app settings | 1 day | Low |
| Update MCP tools to use new abstractions | 2 days | Low |

**Deliverable**: Control panel works with both GitHub/Vercel AND existing Gitea/K8s

### Phase 2: Template Enhancement (Weeks 4-5)

**Goal**: Make template truly reusable

| Task | Effort | Risk |
|------|--------|------|
| Create `.template/` metadata structure | 1 day | Low |
| Define placeholder convention | 1 day | Low |
| Create integration module configs | 2 days | Low |
| Enhance setup.sh with control panel registration | 1 day | Low |
| Build template instantiation API in control panel | 3 days | Medium |
| Test end-to-end app creation flow | 2 days | Medium |

**Deliverable**: Can create new app from control panel UI using template

### Phase 3: UI/UX Overhaul (Weeks 6-8)

**Goal**: Clean, generic dashboard UI

| Task | Effort | Risk |
|------|--------|------|
| Design system audit and token definition | 2 days | Low |
| Implement Create App Wizard | 3 days | Medium |
| Redesign Applications List page | 2 days | Low |
| Redesign Application Detail page | 3 days | Medium |
| Add environment variable management UI | 2 days | Low |
| Add resource linking UI | 2 days | Low |
| Mobile responsiveness pass | 2 days | Low |
| Accessibility audit and fixes | 2 days | Low |

**Deliverable**: Polished, generic UI suitable for any organization

### Phase 4: Migration & Documentation (Weeks 9-10)

**Goal**: Migrate existing apps, document everything

| Task | Effort | Risk |
|------|--------|------|
| Write migration script for existing 22 apps | 2 days | Medium |
| Run migration in staging | 1 day | Low |
| Run migration in production | 1 day | Medium |
| Write user documentation | 3 days | Low |
| Write deployment guide | 2 days | Low |
| Create video walkthrough | 1 day | Low |

**Deliverable**: All existing apps migrated, documentation complete

---

## Part 6: Implementation Priority Matrix

### MVP Scope (Must Have)

| Feature | Why Essential |
|---------|--------------|
| GitHub integration | Most users have GitHub |
| Vercel deployment | Zero-config deployments |
| Neon database | Best serverless Postgres |
| Clerk auth (for control panel) | Quick user management |
| Create App Wizard | Core value proposition |
| Application dashboard | Basic monitoring |
| Environment variable management | Essential for deployments |

### V1.1 Scope (Should Have)

| Feature | Why Important |
|---------|--------------|
| Gitea adapter | Backward compatibility |
| K8s adapter | Power users |
| Turso support | Edge use cases |
| Cost tracking | Financial visibility |
| AI Dev Sessions | Differentiator |
| Stripe integration setup | Common need |

### Future Scope (Nice to Have)

| Feature | Notes |
|---------|-------|
| GitLab adapter | Enterprise users |
| Railway/Fly.io adapters | Alternative deployment targets |
| Multi-tenancy | If demand exists |
| CLI tool (`create-gmac-app`) | Developer experience |
| Marketplace for templates | Community growth |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing Gitea/K8s setup | Medium | High | Implement as separate adapters, extensive testing |
| GitHub API rate limits | Low | Medium | Use authenticated requests, implement caching |
| Vercel API changes | Low | Low | Abstract behind adapter |
| Clerk pricing for large orgs | Low | Medium | NextAuth fallback documented |
| Template versioning conflicts | Medium | Medium | Version templates, migration guides |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to create new app | < 5 minutes | From wizard start to deployed |
| Setup documentation | Zero calls for help | Track support requests |
| Provider coverage | 3 git, 2 deploy, 2 db | Adapter count |
| Existing app migration | 100% | All 22 apps migrated |
| User satisfaction | > 4/5 | Post-launch survey |

---

## Appendix: Current vs Future State

| Aspect | Current (Bespoke) | Future (Generic) |
|--------|-------------------|------------------|
| Git | Gitea only | GitHub (default), Gitea, GitLab |
| Deploy | K8s only | Vercel (default), K8s |
| Database | Neon (hardcoded) | Neon (default), Turso, Postgres |
| Auth | NextAuth (single user) | Clerk (default), NextAuth |
| CI/CD | Gitea Actions | GitHub Actions (default), any |
| Template | Manual copy | Automated wizard |
| Secrets | K8s secrets | Provider-native + encrypted DB |
| Onboarding | N/A (internal tool) | 5-minute wizard |
