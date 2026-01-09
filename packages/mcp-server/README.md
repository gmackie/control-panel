# GMAC Control Panel MCP Server

MCP (Model Context Protocol) server that provides AI assistants with access to the GMAC.IO Control Panel API for application monitoring, deployments, and infrastructure management.

## Features

- **Application Management**: List, create, and monitor applications
- **Cluster Operations**: View cluster health, nodes, costs, and scale operations
- **Deployment Control**: Trigger deployments, rollbacks, and view deployment stats
- **Monitoring**: Access alerts, metrics, service health, and system overview
- **Infrastructure**: Manage repositories, container images, and VPS servers
- **AI Dev Sessions**: Automated bug fixing with AI agents
- **Notifications**: View and manage system notifications
- **Activity Feed**: Track activity across all systems

## Installation

### npm (Global)

```bash
npm install -g @gmac/control-panel-mcp
```

### npm (Local)

```bash
npm install @gmac/control-panel-mcp
```

### Docker

```bash
docker pull ghcr.io/gmackie/control-panel-mcp:latest
```

## Configuration

The MCP server requires two environment variables:

| Variable | Description |
|----------|-------------|
| `CONTROL_PANEL_URL` | URL of the control panel (e.g., `https://control.gmac.io`) |
| `CONTROL_PANEL_API_KEY` | API key from Settings > API Keys in the control panel |

### Getting an API Key

1. Log in to the Control Panel web app
2. Go to Settings > API Keys
3. Click "Create New API Key"
4. Copy the key (it's only shown once)

## Usage

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gmac-control-panel": {
      "command": "npx",
      "args": ["-y", "@gmac/control-panel-mcp"],
      "env": {
        "CONTROL_PANEL_URL": "https://control.gmac.io",
        "CONTROL_PANEL_API_KEY": "cp_your_api_key_here"
      }
    }
  }
}
```

### OpenCode

Add to your `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "servers": {
      "gmac-control-panel": {
        "command": "npx",
        "args": ["-y", "@gmac/control-panel-mcp"],
        "env": {
          "CONTROL_PANEL_URL": "https://control.gmac.io",
          "CONTROL_PANEL_API_KEY": "cp_your_api_key_here"
        }
      }
    }
  }
}
```

### Docker

```bash
docker run -it \
  -e CONTROL_PANEL_URL=https://control.gmac.io \
  -e CONTROL_PANEL_API_KEY=cp_your_api_key_here \
  ghcr.io/gmackie/control-panel-mcp:latest
```

## Available Tools

### Applications
- `list_applications` - List all applications
- `list_applications_with_health` - List apps with health status
- `get_application` - Get application by ID
- `get_application_by_slug` - Get application by slug
- `create_application` - Create new application

### Clusters
- `list_clusters` - List Kubernetes clusters
- `get_cluster` - Get cluster details
- `list_cluster_nodes` - List nodes in cluster
- `get_cluster_health` - Get cluster health
- `get_cluster_costs` - Get cost breakdown
- `scale_cluster` - Scale cluster nodes
- `list_vps_servers` - List Hetzner VPS servers
- `get_vps_server` - Get server details
- `server_power_action` - Start/stop/reboot server

### Deployments
- `list_deployments` - List deployments
- `get_deployment` - Get deployment details
- `get_deployment_stats` - Get deployment statistics
- `trigger_deployment` - Trigger new deployment
- `rollback_deployment` - Rollback deployment
- `cancel_deployment` - Cancel running deployment

### Monitoring
- `get_health_summary` - System health overview
- `list_alerts` - List alerts
- `get_alert` - Get alert details
- `get_alert_stats` - Alert statistics
- `acknowledge_alert` - Acknowledge alert
- `get_metrics` - System metrics
- `list_services` - Service health
- `get_service_health` - Specific service health

### CI/CD & Infrastructure
- `list_repositories` - Git repositories
- `get_repository` - Repository details
- `list_container_images` - Container images
- `get_container_image` - Image details
- `delete_image_tag` - Delete image tag
- `get_infrastructure_health` - Infrastructure status

### AI Dev Sessions
- `list_ai_dev_sessions` - List AI dev sessions
- `get_ai_dev_session` - Get session details
- `get_ai_dev_stats` - Session statistics
- `list_active_ai_sessions` - Active sessions
- `get_ai_session_logs` - Session logs
- `create_ai_dev_session` - Create session
- `approve_ai_dev_session` - Approve fix
- `reject_ai_dev_session` - Reject fix
- `cancel_ai_dev_session` - Cancel session

### Activity & Notifications
- `get_recent_activity` - Recent activity events
- `get_activity_stats` - Activity statistics
- `list_notifications` - List notifications
- `get_notification` - Notification details
- `get_unread_notification_count` - Unread count
- `mark_notification_as_read` - Mark as read
- `mark_all_notifications_as_read` - Mark all read

### System
- `get_control_panel_status` - API connection status
- `get_infrastructure_status` - Infrastructure health
- `get_system_overview` - Complete system overview

## Example Prompts

Once connected, you can ask your AI assistant things like:

- "What's the current system health?"
- "List all applications and their status"
- "Show me recent deployments for the frontend app"
- "Are there any critical alerts right now?"
- "Deploy version v1.2.3 to production for app-id"
- "What are the cluster costs this month?"
- "Create an AI dev session to fix Sentry issue #12345"

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## License

MIT
