# Control Panel Genericization: Detailed Task Breakdown

> **Status**: Planning  
> **Date**: January 10, 2026  
> **Total Estimated Duration**: 10 weeks  

---

## Phase 1: Foundation (Weeks 1-3)

**Goal**: Establish provider abstraction layer without breaking existing functionality

### Week 1: Provider Interfaces & Core Abstractions

#### Task 1.1: Define Provider Interfaces
**Estimate**: 1 day  
**Files to create**:
```
packages/api/src/providers/
├── index.ts                    # Re-exports all providers
├── types.ts                    # Shared types
├── git/
│   ├── index.ts               # GitProvider interface
│   └── types.ts               # Git-specific types
├── deploy/
│   ├── index.ts               # DeploymentProvider interface
│   └── types.ts               # Deployment-specific types
├── database/
│   ├── index.ts               # DatabaseProvider interface
│   └── types.ts               # Database-specific types
└── auth/
    ├── index.ts               # AuthProvider interface (for managed apps)
    └── types.ts               # Auth-specific types
```

**Deliverables**:
- [ ] `GitProvider` interface with methods: `listRepos`, `getRepo`, `createRepo`, `createWebhook`, `getWorkflowRuns`, `createRelease`, `getCommits`
- [ ] `DeploymentProvider` interface with methods: `deploy`, `rollback`, `getStatus`, `getLogs`, `getDeployments`, `setEnvVars`
- [ ] `DatabaseProvider` interface with methods: `createDatabase`, `deleteDatabase`, `getConnectionString`, `listDatabases`
- [ ] `IntegrationProvider` base interface for Clerk, Stripe, PostHog, etc.
- [ ] Shared types: `Repository`, `Deployment`, `DeploymentStatus`, `LogEntry`, `Webhook`

---

#### Task 1.2: Implement GitHub Adapter
**Estimate**: 2 days  
**Dependencies**: Task 1.1  
**Files to create**:
```
packages/api/src/providers/git/adapters/
├── github.ts                  # GitHub implementation
└── github.test.ts             # Tests
```

**Deliverables**:
- [ ] `GitHubProvider` class implementing `GitProvider`
- [ ] Use Octokit SDK for API calls
- [ ] Implement repository CRUD operations
- [ ] Implement webhook management
- [ ] Implement workflow run status fetching
- [ ] Implement release creation
- [ ] Handle rate limiting with exponential backoff
- [ ] Unit tests with mocked responses

**API Methods**:
```typescript
class GitHubProvider implements GitProvider {
  constructor(config: { token: string; owner?: string }) {}
  
  async listRepos(options?: { org?: string }): Promise<Repository[]>
  async getRepo(owner: string, name: string): Promise<Repository>
  async createRepo(options: CreateRepoOptions): Promise<Repository>
  async createRepoFromTemplate(template: string, options: CreateRepoOptions): Promise<Repository>
  async createWebhook(repo: Repository, config: WebhookConfig): Promise<Webhook>
  async deleteWebhook(repo: Repository, webhookId: string): Promise<void>
  async getWorkflowRuns(repo: Repository, options?: WorkflowRunOptions): Promise<WorkflowRun[]>
  async createRelease(repo: Repository, release: ReleaseOptions): Promise<Release>
  async getCommits(repo: Repository, options?: CommitOptions): Promise<Commit[]>
}
```

---

#### Task 1.3: Implement Vercel Adapter
**Estimate**: 2 days  
**Dependencies**: Task 1.1  
**Files to create**:
```
packages/api/src/providers/deploy/adapters/
├── vercel.ts                  # Vercel implementation
└── vercel.test.ts             # Tests
```

**Deliverables**:
- [ ] `VercelProvider` class implementing `DeploymentProvider`
- [ ] Use Vercel REST API
- [ ] Implement project creation and linking to Git repo
- [ ] Implement deployment triggering
- [ ] Implement deployment status polling
- [ ] Implement log streaming
- [ ] Implement environment variable management
- [ ] Implement domain management
- [ ] Unit tests with mocked responses

**API Methods**:
```typescript
class VercelProvider implements DeploymentProvider {
  constructor(config: { token: string; teamId?: string }) {}
  
  async listProjects(): Promise<VercelProject[]>
  async getProject(projectId: string): Promise<VercelProject>
  async createProject(options: CreateProjectOptions): Promise<VercelProject>
  async linkToGitRepo(projectId: string, repo: GitRepoLink): Promise<void>
  async deploy(projectId: string, options?: DeployOptions): Promise<Deployment>
  async getDeployment(deploymentId: string): Promise<Deployment>
  async getDeployments(projectId: string, options?: ListOptions): Promise<Deployment[]>
  async rollback(projectId: string, deploymentId: string): Promise<Deployment>
  async getLogs(deploymentId: string): AsyncIterable<LogEntry>
  async setEnvVars(projectId: string, envVars: EnvVar[]): Promise<void>
  async getEnvVars(projectId: string): Promise<EnvVar[]>
}
```

---

### Week 2: Existing Provider Refactoring

#### Task 1.4: Refactor Gitea into Adapter
**Estimate**: 2 days  
**Dependencies**: Task 1.1  
**Files to modify/create**:
```
packages/api/src/providers/git/adapters/
├── gitea.ts                   # Gitea implementation (refactored)
└── gitea.test.ts              # Tests

# Move existing code from:
# apps/web/src/lib/gitea/ → packages/api/src/providers/git/adapters/gitea.ts
```

**Deliverables**:
- [ ] Extract existing Gitea logic from `apps/web/src/lib/gitea/`
- [ ] Refactor into `GiteaProvider` class implementing `GitProvider`
- [ ] Ensure backward compatibility with existing Gitea setup
- [ ] Maintain webhook handling for CI/CD
- [ ] Update all existing code to use new provider interface
- [ ] Integration tests against real Gitea instance

---

#### Task 1.5: Refactor K8s into Adapter
**Estimate**: 3 days  
**Dependencies**: Task 1.1  
**Files to modify/create**:
```
packages/api/src/providers/deploy/adapters/
├── kubernetes.ts              # K8s implementation (refactored)
└── kubernetes.test.ts         # Tests

# Move existing code from:
# apps/web/src/lib/cluster/ → packages/api/src/providers/deploy/adapters/kubernetes.ts
```

**Deliverables**:
- [ ] Extract K8s deployment logic from `apps/web/src/lib/cluster/`
- [ ] Refactor into `KubernetesProvider` class implementing `DeploymentProvider`
- [ ] Handle namespace management (app-slug, app-slug-staging)
- [ ] Handle secret management (K8s Secrets)
- [ ] Handle deployment creation/update
- [ ] Handle pod log streaming
- [ ] Handle rollback via deployment revision
- [ ] Maintain integration with Harbor registry
- [ ] Integration tests against real K3s cluster

---

#### Task 1.6: Implement Neon Adapter
**Estimate**: 1 day  
**Dependencies**: Task 1.1  
**Files to create**:
```
packages/api/src/providers/database/adapters/
├── neon.ts                    # Neon implementation
└── neon.test.ts               # Tests
```

**Deliverables**:
- [ ] `NeonProvider` class implementing `DatabaseProvider`
- [ ] Use Neon API for project/database management
- [ ] Implement database creation
- [ ] Implement connection string retrieval
- [ ] Implement branch management (for preview deployments)
- [ ] Unit tests

---

### Week 3: Provider Registry & Integration

#### Task 1.7: Create Provider Registry
**Estimate**: 1 day  
**Dependencies**: Tasks 1.2-1.6  
**Files to create**:
```
packages/api/src/providers/
├── registry.ts                # Provider registration and factory
└── config.ts                  # Provider configuration types
```

**Deliverables**:
- [ ] `ProviderRegistry` singleton for managing provider instances
- [ ] Factory methods: `getGitProvider()`, `getDeployProvider()`, `getDbProvider()`
- [ ] Configuration loading from environment variables
- [ ] Support for multiple provider instances (e.g., both GitHub and Gitea)

```typescript
// Usage
const registry = ProviderRegistry.getInstance();

// Configure providers
registry.registerGitProvider('github', new GitHubProvider({ token: process.env.GITHUB_TOKEN }));
registry.registerGitProvider('gitea', new GiteaProvider({ url: process.env.GITEA_URL, token: process.env.GITEA_TOKEN }));

// Get provider for an app
const gitProvider = registry.getGitProvider(app.gitProvider); // 'github' | 'gitea'
```

---

#### Task 1.8: Add Provider Selection to Database Schema
**Estimate**: 0.5 days  
**Dependencies**: Task 1.7  
**Files to modify**:
```
packages/db/src/schema.ts      # Add provider fields
```

**Deliverables**:
- [ ] Add `gitProvider` field to `applications` table (enum: 'github' | 'gitea' | 'gitlab')
- [ ] Add `deployProvider` field to `applications` table (enum: 'vercel' | 'kubernetes')
- [ ] Add `dbProvider` field to `applications` table (enum: 'neon' | 'turso' | 'postgres')
- [ ] Create migration
- [ ] Set defaults for existing apps (gitea, kubernetes, neon)

```sql
ALTER TABLE applications 
ADD COLUMN git_provider VARCHAR(50) DEFAULT 'gitea',
ADD COLUMN deploy_provider VARCHAR(50) DEFAULT 'kubernetes',
ADD COLUMN db_provider VARCHAR(50) DEFAULT 'neon';
```

---

#### Task 1.9: Update tRPC Routers to Use Providers
**Estimate**: 2 days  
**Dependencies**: Tasks 1.7, 1.8  
**Files to modify**:
```
packages/api/src/routers/applications.ts
packages/api/src/routers/deployments.ts
packages/api/src/routers/integrations.ts
```

**Deliverables**:
- [ ] Refactor `applications` router to use `ProviderRegistry`
- [ ] Refactor `deployments` router to use `DeploymentProvider` interface
- [ ] Refactor `integrations` router to use provider abstractions
- [ ] Ensure all existing functionality works with both old and new providers
- [ ] Add provider selection to relevant API procedures

---

#### Task 1.10: Update MCP Tools
**Estimate**: 1.5 days  
**Dependencies**: Task 1.9  
**Files to modify**:
```
packages/mcp-server/src/tools/
├── applications.ts
├── deployments.ts
└── clusters.ts
```

**Deliverables**:
- [ ] Update `trigger_deployment` to use provider abstraction
- [ ] Update `rollback_deployment` to use provider abstraction
- [ ] Update cluster tools to work with both K8s and Vercel
- [ ] Add provider-aware tool descriptions
- [ ] Test with both GitHub/Vercel and Gitea/K8s configurations

---

#### Task 1.11: End-to-End Testing
**Estimate**: 1 day  
**Dependencies**: All previous tasks  

**Deliverables**:
- [ ] Test full deployment flow with GitHub + Vercel
- [ ] Test full deployment flow with Gitea + K8s (existing)
- [ ] Test provider switching for an application
- [ ] Document any breaking changes
- [ ] Create rollback plan if issues found

---

## Phase 1 Summary

| Task | Estimate | Dependencies | Status |
|------|----------|--------------|--------|
| 1.1 Define Provider Interfaces | 1 day | - | Pending |
| 1.2 Implement GitHub Adapter | 2 days | 1.1 | Pending |
| 1.3 Implement Vercel Adapter | 2 days | 1.1 | Pending |
| 1.4 Refactor Gitea into Adapter | 2 days | 1.1 | Pending |
| 1.5 Refactor K8s into Adapter | 3 days | 1.1 | Pending |
| 1.6 Implement Neon Adapter | 1 day | 1.1 | Pending |
| 1.7 Create Provider Registry | 1 day | 1.2-1.6 | Pending |
| 1.8 Add Provider Selection to Schema | 0.5 days | 1.7 | Pending |
| 1.9 Update tRPC Routers | 2 days | 1.7, 1.8 | Pending |
| 1.10 Update MCP Tools | 1.5 days | 1.9 | Pending |
| 1.11 End-to-End Testing | 1 day | All | Pending |
| **Total** | **17 days** | | |

---

## Phase 2: Template Enhancement (Weeks 4-5)

**Goal**: Make template truly reusable with modular integrations

### Week 4: Template Metadata & Module System

#### Task 2.1: Create Template Metadata Structure
**Estimate**: 1 day  
**Files to create in template repo**:
```
.template/
├── config.json                # Template configuration
├── placeholders.json          # Placeholder definitions
└── hooks/
    ├── pre-setup.sh          # Run before setup
    └── post-setup.sh         # Run after setup
```

**Deliverables**:
- [ ] Define `config.json` schema (name, version, description, author, supported features)
- [ ] Define `placeholders.json` schema (placeholder patterns, files, transforms)
- [ ] Create hook scripts for custom setup logic
- [ ] Document the template metadata format

**config.json**:
```json
{
  "name": "vercel-neon-expo-template",
  "version": "1.0.0",
  "description": "Full-stack template with Next.js, Expo, tRPC, and Neon",
  "features": {
    "web": true,
    "mobile": true,
    "api": true
  },
  "supportedProviders": {
    "git": ["github", "gitea"],
    "deploy": ["vercel", "kubernetes"],
    "database": ["neon", "turso"]
  },
  "defaultIntegrations": ["clerk", "neon"],
  "optionalIntegrations": ["stripe", "posthog", "sentry"]
}
```

---

#### Task 2.2: Define Placeholder Convention
**Estimate**: 0.5 days  
**Dependencies**: Task 2.1  

**Deliverables**:
- [ ] Define placeholder syntax: `{{PLACEHOLDER_NAME}}`
- [ ] Define file patterns for replacement
- [ ] Define transformation functions (slug, scope, uppercase, etc.)
- [ ] Document all standard placeholders

**placeholders.json**:
```json
{
  "placeholders": {
    "{{APP_NAME}}": {
      "description": "Human-readable application name",
      "example": "My SaaS App",
      "validation": ".{3,50}",
      "files": [
        "apps/web/src/app/layout.tsx",
        "apps/mobile/app.json",
        "README.md"
      ]
    },
    "{{APP_SLUG}}": {
      "description": "URL-safe identifier (lowercase, hyphens only)",
      "example": "my-saas-app",
      "validation": "^[a-z][a-z0-9-]{2,49}$",
      "files": [
        "package.json",
        "apps/*/package.json",
        "packages/*/package.json",
        "k8s/*.yaml"
      ]
    },
    "{{PACKAGE_SCOPE}}": {
      "description": "npm package scope",
      "derived": {
        "from": "APP_SLUG",
        "transform": "value => `@${value}`"
      },
      "files": [
        "package.json",
        "apps/*/package.json",
        "packages/*/package.json",
        "turbo.json"
      ]
    },
    "{{REPO_URL}}": {
      "description": "Git repository URL",
      "example": "https://github.com/user/my-saas-app",
      "provided_by": "control_panel",
      "files": [
        "package.json"
      ]
    }
  }
}
```

---

#### Task 2.3: Create Integration Module Configs
**Estimate**: 2 days  
**Dependencies**: Task 2.1  
**Files to create in template repo**:
```
.template/integrations/
├── clerk.json
├── stripe.json
├── posthog.json
├── sentry.json
├── neon.json
└── turso.json
```

**Deliverables**:
- [ ] Define integration module schema
- [ ] Create module config for each integration
- [ ] Define which files/packages each integration requires
- [ ] Define environment variables for each integration
- [ ] Define setup instructions (manual and automated)

**Integration Module Schema**:
```json
{
  "id": "stripe",
  "name": "Stripe Payments",
  "description": "Accept payments and manage subscriptions",
  "category": "payments",
  "documentation": "https://stripe.com/docs",
  
  "package": {
    "path": "packages/payments",
    "dependencies": {
      "stripe": "^17.0.0",
      "@stripe/stripe-js": "^4.0.0"
    }
  },
  
  "envVars": {
    "required": {
      "STRIPE_SECRET_KEY": {
        "description": "Stripe secret API key",
        "pattern": "^sk_(test|live)_[a-zA-Z0-9]+$"
      },
      "STRIPE_WEBHOOK_SECRET": {
        "description": "Stripe webhook signing secret",
        "pattern": "^whsec_[a-zA-Z0-9]+$"
      }
    },
    "public": {
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": {
        "description": "Stripe publishable key (safe for client)",
        "pattern": "^pk_(test|live)_[a-zA-Z0-9]+$"
      }
    }
  },
  
  "files": {
    "include": [
      "packages/payments/**",
      "apps/web/src/app/api/webhooks/stripe/**",
      "apps/web/src/app/(app)/billing/**"
    ],
    "exclude_without": [
      "apps/web/src/app/(app)/billing/**"
    ]
  },
  
  "setup": {
    "manual": [
      "1. Create Stripe account at https://dashboard.stripe.com",
      "2. Get API keys from Developers > API Keys",
      "3. Create webhook endpoint pointing to /api/webhooks/stripe"
    ],
    "automated": {
      "supported": false,
      "reason": "Stripe requires manual account creation"
    }
  },
  
  "controlPanelIntegration": {
    "provider": "stripe",
    "syncMetrics": true,
    "webhookEvents": ["checkout.session.completed", "customer.subscription.*"]
  }
}
```

---

#### Task 2.4: Enhance setup.sh Script
**Estimate**: 1 day  
**Dependencies**: Tasks 2.1-2.3  
**Files to modify in template repo**:
```
scripts/
├── setup.sh                   # Enhanced with module selection
├── lib/
│   ├── placeholders.sh       # Placeholder replacement functions
│   ├── modules.sh            # Module enable/disable functions
│   └── validation.sh         # Input validation
└── provision.sh              # Enhanced with control panel integration
```

**Deliverables**:
- [ ] Add interactive module selection to setup.sh
- [ ] Implement placeholder replacement engine
- [ ] Implement module file inclusion/exclusion
- [ ] Add `--non-interactive` mode for CI/automated setup
- [ ] Add `--modules` flag for specifying modules

**Enhanced setup.sh flow**:
```bash
#!/bin/bash
# Usage: ./scripts/setup.sh my-app [options]
#   --no-mobile          Skip mobile app
#   --modules=clerk,stripe,posthog  Select specific modules
#   --non-interactive    Use defaults, no prompts
#   --control-panel=URL  Register with control panel

# 1. Parse arguments
# 2. Load .template/config.json
# 3. Prompt for app name/slug (or use args)
# 4. Prompt for module selection (or use --modules)
# 5. Replace placeholders in all files
# 6. Enable/disable modules (delete unused package dirs)
# 7. Update package.json dependencies
# 8. Run pnpm install
# 9. Initialize git repo
# 10. Run post-setup hooks
# 11. Optionally register with control panel
```

---

### Week 5: Control Panel Integration

#### Task 2.5: Build Template Instantiation API
**Estimate**: 2 days  
**Dependencies**: Tasks 2.1-2.4  
**Files to create in control panel**:
```
packages/api/src/routers/templates.ts
packages/api/src/lib/template-engine.ts
```

**Deliverables**:
- [ ] `templates` tRPC router with procedures:
  - `list`: List available templates
  - `get`: Get template details including modules
  - `instantiate`: Create new app from template
- [ ] Template engine that:
  - Clones template repo
  - Applies placeholder replacements
  - Enables/disables modules
  - Creates new Git repo
  - Pushes to user's Git provider

**tRPC Procedures**:
```typescript
export const templatesRouter = router({
  list: publicProcedure.query(async () => {
    // Return available templates from config or GitHub
  }),
  
  get: publicProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ input }) => {
      // Return template config including available modules
    }),
  
  instantiate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      appName: z.string(),
      appSlug: z.string(),
      modules: z.array(z.string()),
      gitProvider: z.enum(['github', 'gitea']),
      deployProvider: z.enum(['vercel', 'kubernetes']),
      dbProvider: z.enum(['neon', 'turso']),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Clone template
      // 2. Apply placeholders
      // 3. Enable modules
      // 4. Create Git repo
      // 5. Create Application record
      // 6. Provision integrations
      // 7. Configure deployment
      // 8. Return new application
    }),
});
```

---

#### Task 2.6: Build Integration Provisioning Service
**Estimate**: 2 days  
**Dependencies**: Task 2.5  
**Files to create**:
```
packages/api/src/lib/provisioning/
├── index.ts                   # Provisioning orchestrator
├── neon.ts                    # Neon database provisioning
├── clerk.ts                   # Clerk app provisioning
├── vercel.ts                  # Vercel project provisioning
└── stripe.ts                  # Stripe webhook setup
```

**Deliverables**:
- [ ] `ProvisioningService` class that orchestrates resource creation
- [ ] Neon: Create project, database, get connection string
- [ ] Clerk: Create application (if API supports, else manual)
- [ ] Vercel: Create project, link to repo, set env vars
- [ ] Stripe: Create webhook endpoint
- [ ] Rollback support if any provisioning step fails

**Provisioning Flow**:
```typescript
class ProvisioningService {
  async provisionApplication(app: Application, modules: string[]): Promise<ProvisioningResult> {
    const results: ProvisioningStepResult[] = [];
    
    try {
      // 1. Database
      if (app.dbProvider === 'neon') {
        results.push(await this.provisionNeon(app));
      }
      
      // 2. Auth (if module enabled)
      if (modules.includes('clerk')) {
        results.push(await this.provisionClerk(app));
      }
      
      // 3. Deployment
      if (app.deployProvider === 'vercel') {
        results.push(await this.provisionVercel(app));
      }
      
      // 4. Payments (if module enabled)
      if (modules.includes('stripe')) {
        results.push(await this.provisionStripe(app));
      }
      
      return { success: true, results };
    } catch (error) {
      await this.rollback(results);
      throw error;
    }
  }
}
```

---

#### Task 2.7: Add Control Panel Registration to Template
**Estimate**: 1 day  
**Dependencies**: Task 2.5  
**Files to create in template repo**:
```
scripts/register.sh            # Register with control panel
```

**Deliverables**:
- [ ] `register.sh` script that:
  - Prompts for control panel URL
  - Prompts for API key
  - Sends app metadata to control panel
  - Receives and stores app ID
- [ ] Add registration step to provision.sh
- [ ] Store control panel config in `.control-panel.json`

---

#### Task 2.8: End-to-End App Creation Testing
**Estimate**: 1 day  
**Dependencies**: All Phase 2 tasks  

**Deliverables**:
- [ ] Test: Create app via CLI (setup.sh) → registers with control panel
- [ ] Test: Create app via control panel UI → creates repo, provisions resources
- [ ] Test: Module selection works correctly
- [ ] Test: Placeholder replacement is complete
- [ ] Test: Generated app builds and deploys successfully
- [ ] Document any issues found

---

## Phase 2 Summary

| Task | Estimate | Dependencies | Status |
|------|----------|--------------|--------|
| 2.1 Create Template Metadata Structure | 1 day | - | Pending |
| 2.2 Define Placeholder Convention | 0.5 days | 2.1 | Pending |
| 2.3 Create Integration Module Configs | 2 days | 2.1 | Pending |
| 2.4 Enhance setup.sh Script | 1 day | 2.1-2.3 | Pending |
| 2.5 Build Template Instantiation API | 2 days | 2.1-2.4 | Pending |
| 2.6 Build Integration Provisioning Service | 2 days | 2.5 | Pending |
| 2.7 Add Control Panel Registration | 1 day | 2.5 | Pending |
| 2.8 End-to-End Testing | 1 day | All | Pending |
| **Total** | **10.5 days** | | |

---

## Phase 3: UI/UX Overhaul (Weeks 6-8)

**Goal**: Clean, generic dashboard UI suitable for any organization

### Week 6: Design System & Core Components

#### Task 3.1: Design System Audit & Token Definition
**Estimate**: 1.5 days  
**Files to create/modify**:
```
apps/web/src/styles/
├── tokens.css                 # CSS custom properties
└── globals.css                # Update with tokens

packages/ui/                   # NEW: Shared UI package
├── src/
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   └── typography.ts
│   └── components/
│       └── index.ts
└── package.json
```

**Deliverables**:
- [ ] Audit current component usage
- [ ] Define color tokens (primary, secondary, success, warning, error, neutral)
- [ ] Define spacing scale (0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24)
- [ ] Define typography scale (xs, sm, base, lg, xl, 2xl, 3xl)
- [ ] Define border radius tokens
- [ ] Define shadow tokens
- [ ] Create shared UI package for reusable components

---

#### Task 3.2: Create Core UI Components
**Estimate**: 2 days  
**Dependencies**: Task 3.1  
**Files to create**:
```
packages/ui/src/components/
├── Button/
├── Card/
├── Input/
├── Select/
├── Badge/
├── Avatar/
├── Skeleton/
├── EmptyState/
├── ErrorBoundary/
└── LoadingSpinner/
```

**Deliverables**:
- [ ] Standardize Button variants (primary, secondary, ghost, destructive)
- [ ] Create Card component with header, body, footer slots
- [ ] Create form components (Input, Select, Checkbox, Radio)
- [ ] Create Badge component for status indicators
- [ ] Create Skeleton loaders for all common patterns
- [ ] Create EmptyState component with icon, title, description, action
- [ ] Create ErrorBoundary with retry functionality
- [ ] Document all components with examples

---

#### Task 3.3: Create Data Display Components
**Estimate**: 1.5 days  
**Dependencies**: Task 3.2  
**Files to create**:
```
packages/ui/src/components/
├── DataTable/
├── StatCard/
├── StatusIndicator/
├── Timeline/
└── LogViewer/
```

**Deliverables**:
- [ ] DataTable with sorting, filtering, pagination
- [ ] StatCard for metrics display (value, label, trend)
- [ ] StatusIndicator (healthy, warning, error, unknown)
- [ ] Timeline for activity/deployment history
- [ ] LogViewer with syntax highlighting and search

---

### Week 7: Create App Wizard & Applications Pages

#### Task 3.4: Implement Create App Wizard
**Estimate**: 3 days  
**Dependencies**: Tasks 2.5, 3.2  
**Files to create**:
```
apps/web/src/app/applications/new/
├── page.tsx                   # Wizard container
├── components/
│   ├── WizardProgress.tsx    # Step indicator
│   ├── StepBasics.tsx        # Name, slug, template
│   ├── StepIntegrations.tsx  # Module selection
│   ├── StepGitDeploy.tsx     # Git & deploy config
│   ├── StepReview.tsx        # Summary & create
│   └── ProvisioningStatus.tsx # Real-time progress
└── hooks/
    └── useCreateApp.ts       # Wizard state management
```

**Deliverables**:
- [ ] Multi-step wizard with progress indicator
- [ ] Step 1: Basics (name, slug validation, template selection)
- [ ] Step 2: Integrations (module selection with descriptions)
- [ ] Step 3: Git & Deploy (provider selection, repo config)
- [ ] Step 4: Review (summary of all selections)
- [ ] Provisioning status with real-time updates
- [ ] Error handling and retry for failed provisioning
- [ ] Mobile-responsive layout

**Wizard State**:
```typescript
interface CreateAppWizardState {
  step: 1 | 2 | 3 | 4;
  basics: {
    name: string;
    slug: string;
    template: string;
  };
  integrations: {
    selected: string[];
  };
  gitDeploy: {
    gitProvider: 'github' | 'gitea';
    repoVisibility: 'public' | 'private';
    deployProvider: 'vercel' | 'kubernetes';
    environments: ('production' | 'staging' | 'preview')[];
  };
  provisioning: {
    status: 'idle' | 'provisioning' | 'success' | 'error';
    steps: ProvisioningStep[];
    error?: string;
  };
}
```

---

#### Task 3.5: Redesign Applications List Page
**Estimate**: 2 days  
**Dependencies**: Tasks 3.2, 3.3  
**Files to modify**:
```
apps/web/src/app/applications/
├── page.tsx                   # List page
└── components/
    ├── ApplicationCard.tsx   # Grid view card
    ├── ApplicationRow.tsx    # List view row
    ├── ApplicationFilters.tsx # Filter controls
    └── ViewToggle.tsx        # Grid/list toggle
```

**Deliverables**:
- [ ] Grid view with application cards
- [ ] List view with sortable columns
- [ ] View toggle (grid/list) with persistence
- [ ] Filters: status, provider, search
- [ ] Quick actions: deploy, open, settings
- [ ] Health status indicators
- [ ] Last deployment info
- [ ] Empty state for no applications
- [ ] Loading skeletons

**Application Card Design**:
```
┌─────────────────────────────────────────┐
│ [Icon] My SaaS App              [•••]   │
│                                         │
│ ● Healthy    vercel    github           │
│                                         │
│ Last deployed: 2 hours ago              │
│ main @ abc1234                          │
│                                         │
│ [View] [Deploy] [Settings]              │
└─────────────────────────────────────────┘
```

---

#### Task 3.6: Redesign Application Detail Page
**Estimate**: 3 days  
**Dependencies**: Tasks 3.2, 3.3  
**Files to modify**:
```
apps/web/src/app/applications/[id]/
├── page.tsx                   # Overview
├── layout.tsx                 # Tab navigation
├── deployments/page.tsx       # Deployment history
├── integrations/page.tsx      # Linked integrations
├── settings/page.tsx          # App settings
├── secrets/page.tsx           # Env vars management
└── components/
    ├── AppHeader.tsx         # Name, status, actions
    ├── DeploymentCard.tsx    # Recent deployment
    ├── IntegrationCard.tsx   # Integration status
    ├── MetricsOverview.tsx   # Key metrics
    └── ActivityFeed.tsx      # Recent activity
```

**Deliverables**:
- [ ] Application header with status, quick actions
- [ ] Tab navigation: Overview, Deployments, Integrations, Secrets, Settings
- [ ] Overview: metrics, recent deployment, integrations, activity
- [ ] Deployments: history table, deploy button, rollback
- [ ] Integrations: linked services with status
- [ ] Secrets: env var management with masking
- [ ] Settings: name, slug, providers, danger zone (delete)

---

### Week 8: Supporting Pages & Polish

#### Task 3.7: Environment Variable Management UI
**Estimate**: 2 days  
**Dependencies**: Task 3.6  
**Files to create/modify**:
```
apps/web/src/app/applications/[id]/secrets/
├── page.tsx
└── components/
    ├── EnvVarTable.tsx
    ├── EnvVarEditor.tsx
    ├── EnvVarImport.tsx
    └── EnvVarDiff.tsx
```

**Deliverables**:
- [ ] Table view of all environment variables
- [ ] Environment tabs (production, staging, preview)
- [ ] Add/edit/delete variables
- [ ] Bulk import from .env file
- [ ] Sensitive value masking with reveal toggle
- [ ] Sync status indicator (synced with Vercel/K8s)
- [ ] Diff view for pending changes
- [ ] Deploy button to apply changes

---

#### Task 3.8: Resource Linking UI
**Estimate**: 1.5 days  
**Dependencies**: Task 3.6  
**Files to modify**:
```
apps/web/src/app/applications/[id]/integrations/
├── page.tsx
└── components/
    ├── IntegrationsList.tsx
    ├── LinkIntegrationModal.tsx
    └── IntegrationDetail.tsx
```

**Deliverables**:
- [ ] List of linked integrations with status
- [ ] "Link Integration" modal with:
  - Provider selection
  - Resource discovery (list available Vercel projects, Neon databases, etc.)
  - Manual credential entry option
- [ ] Integration detail view with metrics
- [ ] Unlink integration with confirmation

---

#### Task 3.9: Mobile Responsiveness Pass
**Estimate**: 1.5 days  
**Dependencies**: Tasks 3.4-3.8  

**Deliverables**:
- [ ] Audit all pages on mobile viewport (375px)
- [ ] Fix navigation (collapsible sidebar or bottom nav)
- [ ] Fix tables (horizontal scroll or card layout)
- [ ] Fix forms (full-width inputs)
- [ ] Fix modals (full-screen on mobile)
- [ ] Test touch interactions

---

#### Task 3.10: Accessibility Audit & Fixes
**Estimate**: 1.5 days  
**Dependencies**: Tasks 3.4-3.8  

**Deliverables**:
- [ ] Run automated accessibility audit (axe, lighthouse)
- [ ] Fix color contrast issues
- [ ] Add ARIA labels to interactive elements
- [ ] Ensure keyboard navigation works
- [ ] Add focus indicators
- [ ] Test with screen reader
- [ ] Add skip links

---

#### Task 3.11: Dashboard Redesign
**Estimate**: 1 day  
**Dependencies**: Tasks 3.2, 3.3  
**Files to modify**:
```
apps/web/src/app/page.tsx
apps/web/src/app/components/dashboard/
```

**Deliverables**:
- [ ] Simplified dashboard layout
- [ ] Key metrics: total apps, healthy/unhealthy, recent deploys
- [ ] Quick actions: create app, view alerts
- [ ] Recent activity feed
- [ ] Applications requiring attention (unhealthy, pending)

---

## Phase 3 Summary

| Task | Estimate | Dependencies | Status |
|------|----------|--------------|--------|
| 3.1 Design System Audit & Tokens | 1.5 days | - | Pending |
| 3.2 Create Core UI Components | 2 days | 3.1 | Pending |
| 3.3 Create Data Display Components | 1.5 days | 3.2 | Pending |
| 3.4 Implement Create App Wizard | 3 days | 2.5, 3.2 | Pending |
| 3.5 Redesign Applications List | 2 days | 3.2, 3.3 | Pending |
| 3.6 Redesign Application Detail | 3 days | 3.2, 3.3 | Pending |
| 3.7 Environment Variable Management | 2 days | 3.6 | Pending |
| 3.8 Resource Linking UI | 1.5 days | 3.6 | Pending |
| 3.9 Mobile Responsiveness | 1.5 days | 3.4-3.8 | Pending |
| 3.10 Accessibility Audit | 1.5 days | 3.4-3.8 | Pending |
| 3.11 Dashboard Redesign | 1 day | 3.2, 3.3 | Pending |
| **Total** | **20.5 days** | | |

---

## Phase 4: Migration & Documentation (Weeks 9-10)

**Goal**: Migrate existing apps, comprehensive documentation

### Week 9: Migration

#### Task 4.1: Create Migration Script
**Estimate**: 2 days  
**Files to create**:
```
scripts/migrate-existing-apps.ts
packages/db/src/migrations/
```

**Deliverables**:
- [ ] Script that:
  - Reads all 22 existing applications
  - Determines current provider setup (Gitea/K8s)
  - Sets provider fields in database
  - Validates all required data exists
  - Generates migration report
- [ ] Dry-run mode for testing
- [ ] Rollback capability

**Migration Logic**:
```typescript
async function migrateApplication(app: Application) {
  // 1. Determine providers from existing data
  const gitProvider = app.repositoryUrl?.includes('github.com') ? 'github' : 'gitea';
  const deployProvider = app.k8sNamespace ? 'kubernetes' : 'vercel';
  const dbProvider = 'neon'; // All existing apps use Neon
  
  // 2. Update application record
  await db.update(applications)
    .set({ gitProvider, deployProvider, dbProvider })
    .where(eq(applications.id, app.id));
  
  // 3. Verify integrations are linked
  await verifyIntegrations(app);
  
  // 4. Verify deployment provider can reach the app
  await verifyDeployment(app);
  
  return { success: true, app: app.slug };
}
```

---

#### Task 4.2: Staging Migration Test
**Estimate**: 1 day  
**Dependencies**: Task 4.1  

**Deliverables**:
- [ ] Run migration script in dry-run mode
- [ ] Review migration report
- [ ] Test with 2-3 apps in staging
- [ ] Verify UI works correctly with migrated apps
- [ ] Verify deployments still work
- [ ] Document any issues found

---

#### Task 4.3: Production Migration
**Estimate**: 1 day  
**Dependencies**: Task 4.2  

**Deliverables**:
- [ ] Schedule maintenance window
- [ ] Run database backup
- [ ] Execute migration script
- [ ] Verify all 22 apps migrated successfully
- [ ] Test sample of apps (deploy, view, edit)
- [ ] Monitor for errors

---

#### Task 4.4: Provider Data Backfill
**Estimate**: 1 day  
**Dependencies**: Task 4.3  

**Deliverables**:
- [ ] Sync GitHub repos for apps that have them
- [ ] Sync Vercel projects for apps deployed there
- [ ] Update integration links
- [ ] Verify all resource links are valid

---

### Week 10: Documentation

#### Task 4.5: User Documentation
**Estimate**: 2 days  
**Files to create**:
```
docs/
├── getting-started.md
├── creating-applications.md
├── managing-deployments.md
├── environment-variables.md
├── integrations/
│   ├── github.md
│   ├── vercel.md
│   ├── neon.md
│   ├── clerk.md
│   └── stripe.md
└── faq.md
```

**Deliverables**:
- [ ] Getting Started guide (5-minute quickstart)
- [ ] Creating Applications (wizard walkthrough)
- [ ] Managing Deployments (deploy, rollback, logs)
- [ ] Environment Variables (add, edit, sync)
- [ ] Integration guides for each provider
- [ ] FAQ with common issues

---

#### Task 4.6: Deployment Guide
**Estimate**: 1.5 days  
**Files to create**:
```
docs/
├── deployment/
│   ├── vercel.md             # Deploy control panel to Vercel
│   ├── kubernetes.md         # Deploy to K8s
│   ├── docker.md             # Docker deployment
│   └── configuration.md      # Environment variables reference
```

**Deliverables**:
- [ ] Vercel deployment guide (recommended)
- [ ] Kubernetes deployment guide (self-hosted)
- [ ] Docker Compose for local development
- [ ] Environment variables reference
- [ ] Database setup guide
- [ ] Authentication setup guide

---

#### Task 4.7: API Documentation
**Estimate**: 1 day  
**Files to create**:
```
docs/
├── api/
│   ├── overview.md
│   ├── authentication.md
│   └── endpoints.md
```

**Deliverables**:
- [ ] API overview (tRPC structure)
- [ ] Authentication (API keys)
- [ ] Endpoint reference (auto-generated from tRPC?)
- [ ] MCP tools reference

---

#### Task 4.8: Template Documentation
**Estimate**: 1 day  
**Dependencies**: Phase 2  
**Files to create in template repo**:
```
docs/
├── customization.md
├── adding-integrations.md
└── deployment.md
```

**Deliverables**:
- [ ] Template customization guide
- [ ] Adding new integrations
- [ ] Deployment options
- [ ] Troubleshooting guide

---

#### Task 4.9: Video Walkthrough
**Estimate**: 0.5 days  

**Deliverables**:
- [ ] Record 5-minute demo video:
  - Creating account / signing in
  - Creating first application
  - Viewing deployment
  - Managing environment variables
- [ ] Upload to YouTube/Loom
- [ ] Embed in documentation

---

#### Task 4.10: Final Review & Launch Prep
**Estimate**: 1 day  

**Deliverables**:
- [ ] Review all documentation
- [ ] Test all documented flows
- [ ] Update README with new features
- [ ] Prepare changelog
- [ ] Create launch announcement

---

## Phase 4 Summary

| Task | Estimate | Dependencies | Status |
|------|----------|--------------|--------|
| 4.1 Create Migration Script | 2 days | Phase 1 | Pending |
| 4.2 Staging Migration Test | 1 day | 4.1 | Pending |
| 4.3 Production Migration | 1 day | 4.2 | Pending |
| 4.4 Provider Data Backfill | 1 day | 4.3 | Pending |
| 4.5 User Documentation | 2 days | Phase 3 | Pending |
| 4.6 Deployment Guide | 1.5 days | - | Pending |
| 4.7 API Documentation | 1 day | Phase 1 | Pending |
| 4.8 Template Documentation | 1 day | Phase 2 | Pending |
| 4.9 Video Walkthrough | 0.5 days | Phase 3 | Pending |
| 4.10 Final Review & Launch | 1 day | All | Pending |
| **Total** | **12 days** | | |

---

## Overall Summary

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| **Phase 1: Foundation** | 17 days (3.5 weeks) | Provider abstraction layer |
| **Phase 2: Template Enhancement** | 10.5 days (2 weeks) | Modular template system |
| **Phase 3: UI/UX Overhaul** | 20.5 days (4 weeks) | Polished generic UI |
| **Phase 4: Migration & Docs** | 12 days (2.5 weeks) | All apps migrated, docs complete |
| **Total** | **60 days (~12 weeks)** | |

### Critical Path

```
Phase 1 ──────────────────────────────────────────┐
  Task 1.1 (Interfaces) ─┬─> Task 1.2 (GitHub)    │
                         ├─> Task 1.3 (Vercel)    │
                         ├─> Task 1.4 (Gitea)     ├──> Task 1.7 (Registry) ──> Task 1.9 (tRPC)
                         ├─> Task 1.5 (K8s)       │
                         └─> Task 1.6 (Neon)      │
                                                  │
Phase 2 ──────────────────────────────────────────┤
  Task 2.1 (Metadata) ───> Task 2.3 (Modules) ───>├──> Task 2.5 (API) ──> Task 2.6 (Provisioning)
                                                  │
Phase 3 ──────────────────────────────────────────┤
  Task 3.1 (Tokens) ──> Task 3.2 (Components) ───>├──> Task 3.4 (Wizard) ──> Task 3.6 (Detail)
                                                  │
Phase 4 ──────────────────────────────────────────┘
  Task 4.1 (Migration) ──> Task 4.3 (Production) ──> Task 4.5 (Docs)
```

### Parallelization Opportunities

- **Phase 1**: Tasks 1.2-1.6 can run in parallel after 1.1
- **Phase 2**: Tasks 2.1-2.4 (template) can run parallel to Phase 1 completion
- **Phase 3**: Tasks 3.1-3.3 can start during Phase 2; UI work can overlap
- **Phase 4**: Documentation (4.5-4.8) can start during Phase 3

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Provider API changes | Abstract behind interfaces, write adapter tests |
| Migration breaks existing apps | Dry-run mode, staged rollout, rollback plan |
| UI takes longer than estimated | Prioritize wizard over polish |
| Template complexity | Start simple, iterate based on feedback |
