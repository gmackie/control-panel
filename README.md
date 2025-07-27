# gmac.io Business Control Panel

A comprehensive bootstrapable service manager for creating, deploying, and monitoring applications with integrated third-party services.

## Features

### **Service Management**
- **Service Creation**: Bootstrap new applications with predefined templates (Next.js, Go API, Workers, etc.)
- **Service Templates**: Pre-configured templates with best practices, Dockerfiles, and K8s manifests
- **Multi-Environment Deployment**: Deploy to staging and production clusters
- **Service Health Monitoring**: Real-time health status, metrics, and alerts

### **Third-Party Integrations**
- **API Key Management**: Centralized management for Stripe, Turso, AWS, ElevenLabs, OpenRouter
- **Integration Templates**: One-click setup for common service integrations
- **Secret Rotation**: Automated key rotation and security management
- **Webhook Management**: Configure and monitor webhook endpoints

### **Database Management**
- **Database Creation**: Provision databases (Turso, PostgreSQL, MySQL, Redis)
- **Migration Management**: Track and apply database migrations
- **Backup Management**: Automated backups with retention policies
- **Performance Monitoring**: Query analysis, connection monitoring, and performance metrics

### **Monitoring & Observability**
- **Prometheus Integration**: Metrics collection and alerting
- **Grafana Dashboards**: Custom dashboards per service
- **AlertManager**: Configurable alerting with multiple receivers
- **Log Aggregation**: Centralized logging with Loki/Elasticsearch

### **Deployment Pipeline**
- **Git Integration**: Repository management with Gitea/GitHub
- **CI/CD Pipeline**: Automated deployments with GitHub Actions
- **Blue-Green Deployments**: Zero-downtime deployment strategies
- **Rollback Capabilities**: Quick rollback to previous versions

### **Business Intelligence**
- **Revenue Analytics**: MRR, ARR, customer growth via Stripe
- **Customer Management**: User metrics and trends
- **Usage Analytics**: API usage, data processing, and performance
- **Cost Optimization**: Resource utilization and cost analysis

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **UI Components**: React with Tailwind CSS
- **Data Fetching**: React Query for caching and real-time updates
- **Icons**: Lucide React
- **Authentication**: NextAuth.js with GitHub OAuth
- **Database**: Drizzle ORM with Turso SQLite
- **Backend Integration**: REST APIs for Gitea, Prometheus, Kubernetes

## Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your tokens
```

3. Run database migrations:
```bash
npm run db:migrate
```

4. Run development server:
```bash
npm run dev
```

The app will be available at http://localhost:3000

## Authentication

The control panel uses GitHub OAuth for authentication, restricted to the `gmackie` GitHub account only. To set up:

1. Create a GitHub OAuth App at https://github.com/settings/developers
2. Set the callback URL to `https://gmac.io/oauth2/callback`
3. Add the client ID and secret to your `.env.local` file
4. Generate a NextAuth secret: `openssl rand -base64 32`

## API Integration

The dashboard integrates with:
- **Stripe API**: Subscription management, revenue metrics, and payment data
- **Turso API**: Database health, size, and operation statistics
- **Kubernetes API**: Application deployment status and health
- **Prometheus API**: Application performance metrics
- **Custom Analytics**: API usage, data processing, and endpoint performance

## Environment Variables

- `GITHUB_ID`: GitHub OAuth client ID
- `GITHUB_SECRET`: GitHub OAuth client secret
- `NEXTAUTH_URL`: NextAuth.js base URL (https://gmac.io for production)
- `NEXTAUTH_SECRET`: NextAuth.js secret key (generate with `openssl rand -base64 32`)
- `TURSO_DATABASE_URL`: Turso database URL
- `TURSO_AUTH_TOKEN`: Turso authentication token
- `OAUTH_TOKEN`: Bearer token for accessing protected services
- `STRIPE_SECRET_KEY`: Stripe API secret key for payment data
- `NEXT_PUBLIC_GITEA_TOKEN`: Gitea API token for repository access
- `NEXT_PUBLIC_K8S_TOKEN`: Kubernetes service account token

## Database Management

The application uses Drizzle ORM with Turso SQLite:

```bash
# Generate new migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Open database studio
npm run db:studio
```

## Deployment

The control panel is designed to be deployed on the K3s cluster:

```bash
# Build Docker image
docker build -t control-panel:latest .

# Deploy to K8s
kubectl apply -f k8s/
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐
│   Next.js App   │────▶│  API Routes  │
└─────────────────┘     └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ┌─────────┐ ┌──────────┐ ┌────────┐
              │  Gitea  │ │Prometheus│ │  K8s   │
              └─────────┘ └──────────┘ └────────┘
```

## Components

- **RevenueMetrics**: MRR, ARR, and revenue tracking from Stripe
- **AppServicesGrid**: Health status and metrics for all applications
- **CustomerMetrics**: User statistics and top customers
- **DatabaseStatus**: Turso database health and operations
- **UsageAnalytics**: API usage, data processing, and endpoint performance
- **RecentDeployments**: Deployment history with git information

## Business Metrics

The dashboard provides insights into:
- Monthly Recurring Revenue (MRR) and Annual Run Rate (ARR)
- Customer acquisition and churn rates
- API usage patterns and top endpoints
- Database performance and storage utilization
- Application health and error rates
- Customer profitability analysis