# MCP Server Design

Design document for the Control Panel MCP Server - enabling AI assistants (primarily Claude) to interact with the control panel programmatically.

## Overview

**Purpose**: General-purpose MCP API for AI assistants to manage applications, infrastructure, monitoring, CI/CD, and integrations.

**Primary Consumer**: Claude Code during development sessions.

**Access Level**: Full admin access - trust Claude's judgment + user approval in conversation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
│                    (spawns via stdio)                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ stdin/stdout (JSON-RPC)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  packages/mcp-server                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  MCP SDK    │  │   Auth      │  │    Tool Handlers        │  │
│  │  (stdio)    │──│  (bearer)   │──│  (apps, cluster, etc.)  │  │
│  └─────────────┘  └─────────────┘  └───────────┬─────────────┘  │
└────────────────────────────────────────────────┼────────────────┘
                                                 │ direct imports
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 apps/web/src/lib/*                               │
│  ClusterOrchestrator, GiteaClient, HarborClient,                │
│  ApplicationManager, IntegrationMonitors, etc.                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Decisions

- **Location**: New `packages/mcp-server` package in monorepo
- **Transport**: stdio (Claude Code spawns as subprocess)
- **Auth**: Bearer token via `MCP_API_TOKEN` env var
- **Service Access**: Direct imports from `apps/web/src/lib/*` (no HTTP hop)
- **Guardrails**: None in MCP layer - trust Claude + user approval

## MCP Tools

### Applications & Deployments (~12 tools)

| Tool | Description |
|------|-------------|
| `list_applications` | Array of {id, name, slug, status, integrations[]} |
| `get_application` | Full application details with secrets, deployments, integrations |
| `create_application` | Creates app record, optionally links Gitea repo |
| `update_application` | Updates app metadata |
| `delete_application` | Removes app and unlinks all resources |
| `deploy_application` | Triggers K3s deployment to staging/production |
| `rollback_deployment` | Rolls back to previous deployment version |
| `get_deployment_status` | Current deployment state, replicas, health |
| `list_application_secrets` | Secret keys (not values) for an app |
| `set_application_secret` | Creates or updates a secret |
| `delete_application_secret` | Removes a secret |

### Cluster & Infrastructure (~11 tools)

| Tool | Description |
|------|-------------|
| `get_cluster_health` | Nodes, alerts, summary {healthy, degraded, critical} |
| `get_node_details` | CPU, memory, disk, pods, status, metrics history |
| `list_nodes` | All K3s nodes with status, role, resources |
| `create_node` | Provisions Hetzner VPS, installs K3s, joins cluster |
| `delete_node` | Drains, cordons, removes from cluster, destroys VPS |
| `scale_cluster` | Auto-provisions or removes workers to match count |
| `get_autoscaling_status` | Current policies, thresholds, scaling history |
| `list_vps_servers` | All Hetzner servers (including non-K3s) |
| `get_vps_details` | Server specs, IP, status, monthly cost |
| `reboot_vps` | Hard reboot a server |

### Monitoring & Alerts (~11 tools)

| Tool | Description |
|------|-------------|
| `get_health_summary` | Overall system health: apps, cluster, integrations |
| `check_service_health` | HTTP health check against a specific service |
| `list_alerts` | Current alerts with severity, source, message |
| `get_alert_details` | Full alert context, history, related metrics |
| `acknowledge_alert` | Mark alert as acknowledged |
| `list_alert_rules` | Configured alert rules and thresholds |
| `create_alert_rule` | New rule (e.g., "CPU > 90% for 5min → critical") |
| `update_alert_rule` | Modify existing rule |
| `delete_alert_rule` | Remove a rule |
| `get_integration_health` | Status of all third-party integrations |
| `get_integration_metrics` | Detailed metrics for a specific integration |

### CI/CD & Registry (~11 tools)

| Tool | Description |
|------|-------------|
| `list_workflow_runs` | Recent workflow runs across repos |
| `get_workflow_run` | Run details, jobs, steps, duration |
| `get_workflow_logs` | Stdout/stderr logs from a workflow run |
| `trigger_workflow` | Manually trigger a Gitea Actions workflow |
| `cancel_workflow_run` | Cancel an in-progress workflow |
| `list_registry_repositories` | All repos in Harbor with image counts |
| `list_registry_images` | Tags, sizes, push dates, vulnerability scans |
| `get_image_vulnerabilities` | Detailed CVE report for an image |
| `delete_registry_image` | Remove a specific image tag |
| `list_repositories` | All Gitea repos with last commit, branch info |
| `get_repository` | Repo details, branches, recent commits |

### Integrations & Resource Provisioning (~12 tools)

| Tool | Description |
|------|-------------|
| `list_integrations` | All configured integrations with status |
| `validate_integration` | Test connection, return capabilities |
| `provision_neon_database` | Creates Neon Postgres, returns connection string |
| `provision_vercel_project` | Creates Vercel project, returns URLs |
| `provision_expo_app` | Creates Expo app, returns app ID |
| `provision_k3s_namespace` | Creates K3s namespace with optional limits |
| `provision_turso_database` | Creates Turso database, returns URL and token |
| `assign_resource_to_application` | Links resource to app, injects secrets |
| `unassign_resource` | Unlinks resource (doesn't delete it) |
| `list_application_resources` | All resources assigned to an app |
| `list_unassigned_resources` | Resources not linked to any app |

**Total: ~57 tools** across 5 domains.

## Package Structure

```
packages/mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point, stdio transport setup
│   ├── auth.ts               # Bearer token validation
│   ├── server.ts             # MCP server configuration
│   └── tools/
│       ├── index.ts          # Tool registry
│       ├── applications.ts   # Application & deployment tools
│       ├── cluster.ts        # Cluster & infrastructure tools
│       ├── monitoring.ts     # Monitoring & alert tools
│       ├── cicd.ts           # CI/CD & registry tools
│       └── integrations.ts   # Integration & provisioning tools
└── bin/
    └── mcp-server.js         # CLI entry: #!/usr/bin/env node
```

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

Plus workspace imports from `apps/web/src/lib/*`.

## Configuration

### Claude Code Setup

Add to `~/.claude.json` (or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "control-panel": {
      "command": "node",
      "args": ["/path/to/control-panel/packages/mcp-server/dist/index.js"],
      "env": {
        "MCP_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Environment Variables

The MCP server needs access to all env vars from the web app:

- `MCP_API_TOKEN` - Bearer token for auth
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` - Database
- `HETZNER_API_TOKEN` - VPS provisioning
- `GITEA_API_TOKEN`, `GITEA_BASE_URL` - Git operations
- `HARBOR_BASE_URL`, `HARBOR_USERNAME`, `HARBOR_PASSWORD` - Registry
- Integration keys (Neon, Vercel, Expo, Stripe, Clerk, etc.)

## Implementation Notes

### Service Reuse

Tools should directly instantiate service classes from `apps/web/src/lib/*`:

```typescript
import { getApplications, createApplication } from '@web/lib/applications/manager';
import { ClusterOrchestrator } from '@web/lib/cluster/orchestrator';
import { GiteaClient } from '@web/lib/gitea/client';
```

### Error Handling

Return structured errors that Claude can understand:

```typescript
{
  error: true,
  code: "NOT_FOUND" | "UNAUTHORIZED" | "VALIDATION_ERROR" | "INTERNAL_ERROR",
  message: "Human-readable description",
  details?: object
}
```

### Tool Response Format

Consistent response structure:

```typescript
{
  success: true,
  data: { ... },
  metadata?: {
    timestamp: string,
    duration_ms: number
  }
}
```

## Future Considerations

- **HTTP/SSE transport**: For remote access or shared servers
- **Resources**: MCP resources for streaming logs, metrics
- **Prompts**: Pre-built prompts for common workflows
- **Rate limiting**: If opened to multiple consumers
- **Audit logging**: Track all operations for compliance
