# GMAC.IO Control Panel

Unified monitoring and control dashboard for the GMAC.IO application ecosystem. Provides complete visibility into application lifecycle, infrastructure health, and third-party integrations.

## Features

- **Application Lifecycle Management** - Track repositories, CI/CD pipelines, deployments across staging/production
- **Infrastructure Monitoring** - Kubernetes cluster health, node status, resource utilization
- **Integration Hub** - Unified view of Clerk, Stripe, Turso, Supabase, and other service metrics
- **Real-time Alerts** - Configurable alerting with Slack, email, and webhook notifications
- **Cost Tracking** - Infrastructure costs across Hetzner VPS and cloud services

## Tech Stack

- **Web**: Next.js 15, TypeScript, tRPC v11, Tailwind CSS
- **Mobile**: React Native / Expo
- **Database**: Drizzle ORM with Neon PostgreSQL
- **Monorepo**: Turborepo with pnpm workspaces

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database (Neon recommended)

### Setup

```bash
# Clone the repository
git clone https://github.com/gmackie/control-panel.git
cd control-panel

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# At minimum, set: NEON_DATABASE_URL, NEXTAUTH_SECRET, GITHUB_ID, GITHUB_SECRET

# Generate and run database migrations
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev
```

The app will be available at http://localhost:3000

## Development

```bash
# Start development server
pnpm dev

# Run linting
pnpm lint

# Run tests
pnpm test

# Build for production
pnpm build

# Database management
pnpm db:generate   # Generate migrations
pnpm db:migrate    # Apply migrations
pnpm db:studio     # Open Drizzle Studio
```

## Project Structure

```
control-panel/
├── apps/
│   ├── web/              # Next.js web application
│   └── mobile/           # React Native / Expo mobile app
├── packages/
│   ├── api/              # tRPC routers and procedures
│   ├── db/               # Drizzle schema and database client
│   └── shared/           # Shared utilities and types
├── docs/                 # Documentation
├── k8s/                  # Kubernetes manifests
└── deployment-system/    # Deployment automation
```

## Environment Variables

See `.env.example` for all available configuration options. Required variables:

| Variable | Description |
|----------|-------------|
| `NEON_DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth.js secret (min 32 chars) |
| `NEXTAUTH_URL` | Application URL |
| `GITHUB_ID` | GitHub OAuth App ID |
| `GITHUB_SECRET` | GitHub OAuth App Secret |

## Deployment

### Docker

```bash
# Build Docker image
./build.sh

# Or manually
docker build -t control-panel .
```

### Kubernetes

```bash
# Deploy to cluster
./deploy.sh

# Or with kubectl
kubectl apply -f k8s/
```

### CI/CD

Automated via GitHub Actions:
1. Push to `main` triggers build
2. Docker image pushed to GitHub Container Registry
3. Optional deployment to staging/production clusters

## Mobile App

See [apps/mobile/README.md](apps/mobile/README.md) for mobile development setup.

## MCP Server (AI Assistant Integration)

The control panel includes an MCP (Model Context Protocol) server that allows AI assistants like Claude to interact with your infrastructure.

### Setup for OpenCode

1. **Build the MCP server:**
   ```bash
   pnpm mcp:build
   ```

2. **Create an API key:**
   - Start the dev server: `pnpm dev`
   - Go to http://localhost:3000/settings
   - Click the "API Keys" tab
   - Click "Create New API Key"
   - Copy the key (it's only shown once!)

3. **Configure OpenCode:**
   
   Set the API key as an environment variable:
   ```bash
   export CONTROL_PANEL_API_KEY="cp_your_key_here"
   ```

   The `.opencode.json` in this repo is already configured. OpenCode will automatically use it when you open this project.

4. **Verify the MCP server is connected:**
   ```bash
   opencode mcp list
   ```

### Available MCP Tools

Once connected, you can ask your AI assistant to:
- List and manage applications
- View cluster health and scale nodes
- Trigger deployments and rollbacks
- Check alerts and acknowledge them
- View activity feed and notifications
- Manage AI dev sessions for automated bug fixing

See [packages/mcp-server/README.md](packages/mcp-server/README.md) for the full list of tools.

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure lint and tests pass
4. Submit a pull request

## License

Private - GMAC.IO
