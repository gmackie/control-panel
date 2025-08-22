# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development Commands
```bash
# Development
npm run dev           # Start Next.js development server on http://localhost:3000

# Build & Production
npm run build         # Build the Next.js application for production
npm run start         # Start the production server

# Code Quality
npm run lint          # Run ESLint to check code quality

# Database Management
npm run db:generate   # Generate database migrations using Drizzle Kit
npm run db:migrate    # Apply database migrations (runs scripts/migrate.ts)
npm run db:studio     # Open Drizzle Studio for database management
```

### Deployment Commands
```bash
# Build Docker image for production
./build.sh            # Builds optimized Docker image

# Deploy to Kubernetes
./deploy.sh           # Deploy using standard configuration
./deploy-optimized.sh # Deploy with optimized settings

# Update cluster secrets
./update-cluster-secrets.sh  # Update Kubernetes secrets from .env.local
```

## Application Architecture

This is the main control center for GMAC.IO's entire application ecosystem - a comprehensive monitoring and control dashboard that provides complete visibility into every aspect of the application lifecycle.

### Core Vision: Unified Application Lifecycle Monitoring

The control panel provides a sleek, unified dashboard UI for monitoring and controlling:

**Application Lifecycle Management**
- View all applications with direct links to their Gitea repositories
- Monitor container images in the registry
- Track Gitea CI workflow status in real-time
- View staging environment health checks
- Monitor production metrics and alerts
- Single-click deployments across environments

**Third-Party Integration Hub**
Each application has dedicated integration tabs for:
- **Stripe**: Payment processing, revenue metrics, subscription management
- **Clerk**: Authentication metrics, user sessions, MFA adoption
- **Turso**: Database health, query performance, storage metrics
- **Supabase**: Real-time connections, database usage, auth statistics
- **ElevenLabs**: Voice generation usage, API quotas, cost tracking
- **OpenRouter/OpenAI**: AI API usage, token consumption, model performance
- Additional integrations: SendGrid, Twilio, AWS services, and more

**Infrastructure Overview**
- **Gitea Server**: Self-hosted Git repository on dedicated VPS with CI/CD pipelines
- **Kubernetes Clusters**: K3s/K8s clusters on Hetzner VPS with auto-scaling
- **Container Registry**: Harbor/Docker registry for image management
- **Monitoring Stack**: Real-time metrics, logs, traces, and alerts

Built with Next.js 14 and TypeScript, this control panel serves as the single pane of glass for complete infrastructure observability and control.

### Dashboard UI Architecture

The control panel implements a comprehensive dashboard system with:

**Main Dashboard Views** (`src/app/`)
- **Applications View**: Unified application management with repository links, CI/CD status, deployments
- **Services View**: Grid/list views of all services with health indicators
- **Cluster View**: Real-time cluster monitoring with node health, resources, and costs
- **Registry View**: Container image management and deployment tracking
- **Alerts View**: Centralized alerting dashboard with rules and active alerts
- **Integrations View**: Third-party service configuration and monitoring

**Real-time Monitoring Components** (`src/components/`)
- `realtime-metrics.tsx`: Live streaming metrics with SSE
- `system-health.tsx`: Service health monitoring dashboard
- `clerk-auth-metrics.tsx`: Authentication analytics
- `AlertMonitor.tsx`: Real-time alert evaluation
- `HealthDashboard.tsx`: Cluster health visualization
- `UnifiedApplicationView.tsx`: Single app monitoring hub

### Key Architectural Components

1. **Multi-Tier Application Structure**
   - **Frontend**: Next.js with React, using App Router pattern
   - **API Layer**: Next.js API routes providing REST endpoints with streaming support
   - **Business Logic**: Service managers in `src/lib/` handling core operations
   - **Infrastructure**: Modular cluster management system with Kubernetes orchestration
   - **Real-time Layer**: Server-sent events for live metrics and monitoring

2. **Authentication Flow**
   - Uses NextAuth.js with GitHub OAuth provider
   - Restricted to specific GitHub user ("gmackie")
   - Session management via JWT tokens
   - Protected routes handled by middleware (`src/middleware.ts`)

3. **Database Architecture**
   - Primary database: Turso (distributed SQLite) with Drizzle ORM
   - Schema defined in `src/lib/schema.ts`
   - Migrations managed through Drizzle Kit
   - Connection handling in `src/lib/db.ts`

4. **Infrastructure Management Systems**
   
   **Gitea Management** (`src/lib/gitea/`)
   - Repository creation and management
   - User access control
   - Webhook configuration for CI/CD
   - Integration with deployment pipelines
   
   **Cluster Management** (`src/lib/cluster/`)
   - **Orchestrator Pattern**: Central orchestrator coordinates multiple specialized modules
   - **Module System**: Pluggable modules for different cluster operations:
     - `kubeconfig-manager`: Manages Kubernetes configurations across multiple clusters
     - `node-onboarding-simple`: Automated K3s node provisioning on Hetzner VPS
     - `registry-manager`: Container registry management (Harbor/Docker Registry)
     - `deployment-manager`: Application deployment orchestration
     - `autoscaler`: Dynamic cluster scaling based on metrics
     - `health-monitor`: Node and service health monitoring
     - `cost-tracker`: Hetzner infrastructure cost tracking
   
   **Hetzner Integration** (`src/lib/hetzner/`)
   - VPS provisioning and management
   - Network configuration
   - DNS management
   - Server lifecycle operations (create, resize, delete)
   - SSH key management for node access

5. **Application Monitoring Architecture** (`src/lib/`)
   
   **Application Manager** (`src/lib/applications/manager.ts`)
   - Complete application lifecycle management
   - Integration with Gitea for repository management
   - CI/CD pipeline status tracking
   - Environment-specific deployments (staging/production)
   - Metrics and alert aggregation per application
   
   **Integration Monitoring** (`src/lib/monitoring/`)
   - `clerk-monitor.ts`: Authentication service monitoring
   - `stripe-monitor.ts`: Payment processing metrics
   - `turso-monitor.ts`: Database performance tracking
   - `k3s-service-monitor.ts`: Kubernetes service health
   - `secrets-monitor.ts`: Secrets rotation and compliance
   - Real-time health checks and metric collection
   
   **Alert System** (`src/lib/monitoring/alert-monitor.ts`)
   - Rule-based alerting with severity levels
   - Multi-channel notifications (email, Slack, webhook, PagerDuty)
   - Alert correlation and deduplication
   - Automatic incident creation and tracking

6. **API Structure** (`src/app/api/`)
   - RESTful endpoints organized by domain
   - Consistent error handling and response format
   - Authentication checks on protected endpoints
   - Real-time streaming endpoints for metrics and health data

### State Management & Data Flow

1. **Client-Side State**
   - React Query for server state synchronization
   - SWR for real-time data fetching
   - Component-level state with React hooks
   - Optimistic updates for responsive UI

2. **Server-Side Rendering**
   - Server Components for initial data fetching
   - Dynamic imports for code splitting
   - Streaming responses for real-time updates
   - Parallel data fetching for dashboard views

3. **Real-Time Features**
   - Server-Sent Events for live metrics streaming
   - WebSocket-like connections for health monitoring
   - Polling fallbacks for compatibility
   - Real-time CI/CD status updates from Gitea webhooks
   - Live deployment progress tracking

4. **Data Aggregation**
   - Per-application metric aggregation
   - Cross-environment health rollups
   - Integration status consolidation
   - Cost tracking across all resources

### Security Considerations

- Environment variables stored in `.env.local` (never commit)
- Secrets managed through Kubernetes secrets
- API tokens and credentials encrypted at rest
- GitHub OAuth restricted to specific user
- All external API calls use authenticated connections

### Infrastructure Topology

1. **Gitea Server (Dedicated VPS)**
   - Standalone Git repository hosting
   - CI/CD webhook triggers
   - Source code management for all applications
   - Integration with control panel for repository operations

2. **K3s/K8s Clusters (Hetzner VPS)**
   - Multiple cluster support (dev, staging, production)
   - Dynamic node provisioning via Hetzner API
   - Automatic K3s installation and configuration
   - Cross-cluster deployment capabilities

3. **Control Panel Deployment**
   - Can run on Kubernetes cluster or standalone
   - Manages infrastructure across multiple VPS instances
   - Centralized monitoring and alerting
   - Single authentication point for all operations

### Deployment Architecture

1. **Container Strategy**
   - Multi-stage Docker builds for optimization
   - Standalone Next.js output for minimal image size
   - Node.js Alpine base for production runtime

2. **Kubernetes Deployment**
   - Namespace isolation for different environments
   - ConfigMaps for non-sensitive configuration
   - Secrets for sensitive data
   - Ingress with TLS termination
   - Service mesh ready architecture

3. **CI/CD Pipeline**
   - Gitea Actions for automated builds
   - Docker image pushed to Harbor registry
   - Kubernetes rolling updates across clusters
   - Health checks before traffic routing

### Module Dependencies

When modifying core modules, be aware of these critical dependencies:
- `cluster/orchestrator` orchestrates all cluster modules and Hetzner VPS operations
- `applications/manager` depends on cluster, gitea, and deployment managers
- `infrastructure/manager` coordinates gitea (on dedicated VPS), harbor, and hetzner clients
- `hetzner/client` manages VPS lifecycle for K3s/K8s nodes
- `gitea/client` communicates with external Gitea server
- `k3s/manager` handles K3s installation on Hetzner VPS instances
- Monitoring services depend on external API clients (Clerk, Stripe, Turso)
- Alert system depends on monitoring services for metric evaluation

### Environment Variables Required

Critical environment variables that must be set:

**Core Authentication & Database**
- `TURSO_DATABASE_URL`: Turso database connection URL
- `TURSO_AUTH_TOKEN`: Turso authentication token
- `GITHUB_ID` & `GITHUB_SECRET`: GitHub OAuth credentials
- `NEXTAUTH_URL` & `NEXTAUTH_SECRET`: NextAuth configuration

**Infrastructure Management**
- `GITEA_TOKEN`: Gitea API authentication for repository operations
- `K3S_SA_TOKEN`: Kubernetes service account token for cluster management
- `HETZNER_API_TOKEN`: Hetzner Cloud API token for VPS provisioning

**Third-Party Integrations** (per application)
- `STRIPE_API_KEY`: Payment processing
- `CLERK_API_KEY`: Authentication service
- `SUPABASE_URL` & `SUPABASE_ANON_KEY`: Supabase integration
- `ELEVENLABS_API_KEY`: Voice generation service
- `OPENROUTER_API_KEY`: AI model routing
- Additional keys for SendGrid, Twilio, AWS services as needed

### Application Monitoring Features

When working on application monitoring features, keep in mind:

**Per-Application Dashboard Should Display:**
- Repository link and latest commit info from Gitea
- CI/CD pipeline status with build logs
- Container images in registry with tags and sizes
- Staging environment health checks and test results
- Production metrics (requests/sec, error rates, response times)
- Active alerts and incidents
- All configured integrations with their status
- Cost breakdown by resource and service

**Integration Tabs Should Show:**
- Service-specific metrics and usage
- API quota consumption and limits
- Cost tracking and billing information
- Error logs and debugging information
- Configuration status and webhooks
- Historical trends and analytics