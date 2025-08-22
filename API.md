# GMAC.IO Control Panel - API Documentation

This document provides comprehensive documentation for all API endpoints in the GMAC.IO Control Panel.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://control.gmac.io/api`

## Authentication

All API endpoints require authentication via NextAuth session cookies or Bearer tokens.

### Session-based Authentication (Web)
```http
Cookie: next-auth.session-token=<session-token>
```

### Token-based Authentication (API)
```http
Authorization: Bearer <api-token>
```

## Response Format

All API responses follow this standard format:

### Success Response
```json
{
  "success": true,
  "data": {},
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

---

## Authentication Endpoints

### Get Session
Get current user session information.

**Endpoint**: `GET /auth/session`

**Response**:
```json
{
  "user": {
    "id": "1",
    "name": "John Doe",
    "email": "john@gmac.io",
    "image": "https://avatars.githubusercontent.com/u/1?v=4"
  },
  "expires": "2024-12-31T23:59:59.999Z"
}
```

### Verify Session
Verify if current session is valid.

**Endpoint**: `GET /auth/verify`

**Parameters**:
- `token` (query, optional): Token to verify

**Response**:
```json
{
  "valid": true,
  "user": {
    "id": "1",
    "name": "John Doe",
    "email": "john@gmac.io"
  },
  "expires": "2024-12-31T23:59:59.999Z"
}
```

### Sign Out
Sign out current user.

**Endpoint**: `POST /auth/signout`

**Response**:
```json
{
  "success": true,
  "message": "Successfully signed out"
}
```

---

## Monitoring Endpoints

### Get Metrics
Retrieve system and application metrics.

**Endpoint**: `GET /monitoring/metrics`

**Parameters**:
- `timeRange` (query, optional): Time range for metrics (1h, 6h, 24h, 7d, 30d)
- `services` (query, optional): Comma-separated list of services to include
- `includeHistory` (query, optional): Include historical data (boolean)

**Example Request**:
```bash
curl -X GET "/api/monitoring/metrics?timeRange=1h&services=gitea,drone"
```

**Response**:
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "timeRange": "1h",
  "system": {
    "cpu": {
      "usage": 45.2,
      "cores": 8,
      "load": [1.2, 1.1, 0.9]
    },
    "memory": {
      "used": 2048,
      "total": 8192,
      "free": 6144,
      "cached": 1024
    },
    "disk": {
      "used": 25600,
      "total": 102400,
      "free": 76800,
      "io": {
        "read": 150,
        "write": 200
      }
    },
    "network": {
      "rx": 1024000,
      "tx": 512000,
      "connections": 45
    }
  },
  "applications": {
    "gitea": {
      "status": "healthy",
      "responseTime": 120,
      "uptime": 99.9,
      "version": "1.21.0"
    },
    "drone": {
      "status": "healthy",
      "responseTime": 85,
      "uptime": 99.5,
      "version": "2.19.0"
    }
  },
  "history": [
    {
      "timestamp": "2024-01-15T09:00:00Z",
      "cpu": 42.1,
      "memory": 1948,
      "disk": 25500
    }
  ]
}
```

### Get Alerts
Retrieve monitoring alerts.

**Endpoint**: `GET /monitoring/alerts`

**Parameters**:
- `status` (query, optional): Filter by status (firing, pending, resolved)
- `severity` (query, optional): Filter by severity (critical, high, medium, low, info)
- `limit` (query, optional): Number of alerts to return (default: 50)
- `offset` (query, optional): Offset for pagination (default: 0)

**Example Request**:
```bash
curl -X GET "/api/monitoring/alerts?status=firing&severity=high"
```

**Response**:
```json
{
  "alerts": [
    {
      "id": "1",
      "name": "High CPU Usage",
      "status": "firing",
      "severity": "high",
      "message": "CPU usage is above 80%",
      "labels": {
        "instance": "node-1",
        "job": "node-exporter"
      },
      "annotations": {
        "description": "High CPU usage detected on node-1",
        "runbook_url": "https://docs.gmac.io/runbooks/high-cpu"
      },
      "generatorURL": "https://prometheus.gmac.io/graph?g0.expr=cpu_usage",
      "fingerprint": "abc123def456",
      "startsAt": "2024-01-15T10:00:00Z",
      "endsAt": null,
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "summary": {
    "total": 5,
    "firing": 2,
    "pending": 1,
    "resolved": 2,
    "mttr": 120
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 5
  }
}
```

### Create Alert Rule
Create a new monitoring alert rule.

**Endpoint**: `POST /monitoring/alerts`

**Request Body**:
```json
{
  "name": "High Memory Usage",
  "query": "memory_usage_percent > 85",
  "severity": "high",
  "description": "Alert when memory usage exceeds 85%",
  "for": "5m",
  "labels": {
    "team": "infrastructure"
  },
  "annotations": {
    "summary": "High memory usage on {{ $labels.instance }}",
    "description": "Memory usage is {{ $value }}% on {{ $labels.instance }}"
  }
}
```

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "2",
    "name": "High Memory Usage",
    "query": "memory_usage_percent > 85",
    "severity": "high",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Acknowledge Alert
Acknowledge a firing alert.

**Endpoint**: `POST /monitoring/alerts/{id}/acknowledge`

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "1",
    "status": "acknowledged",
    "acknowledgedBy": "john@gmac.io",
    "acknowledgedAt": "2024-01-15T10:45:00Z"
  }
}
```

### Resolve Alert
Mark an alert as resolved.

**Endpoint**: `POST /monitoring/alerts/{id}/resolve`

**Response**:
```json
{
  "success": true,
  "alert": {
    "id": "1",
    "status": "resolved",
    "resolvedBy": "john@gmac.io",
    "resolvedAt": "2024-01-15T10:50:00Z"
  }
}
```

---

## Cluster Management Endpoints

### Get Cluster Nodes
Retrieve information about cluster nodes.

**Endpoint**: `GET /cluster/nodes`

**Response**:
```json
{
  "nodes": [
    {
      "name": "node-1",
      "status": "Ready",
      "roles": ["worker"],
      "age": "5d",
      "version": "v1.28.0",
      "ready": true,
      "schedulable": true,
      "cpu": {
        "usage": "45%",
        "capacity": "4 cores"
      },
      "memory": {
        "usage": "2.1GB",
        "capacity": "8GB"
      },
      "pods": {
        "running": 12,
        "capacity": 110
      },
      "conditions": [
        {
          "type": "Ready",
          "status": "True",
          "lastHeartbeatTime": "2024-01-15T10:00:00Z",
          "lastTransitionTime": "2024-01-10T08:00:00Z",
          "reason": "KubeletReady",
          "message": "kubelet is posting ready status"
        }
      ]
    }
  ],
  "summary": {
    "total": 3,
    "ready": 3,
    "notReady": 0,
    "schedulable": 3
  }
}
```

### Perform Node Action
Perform management actions on cluster nodes.

**Endpoint**: `POST /cluster/nodes`

**Request Body**:
```json
{
  "action": "cordon|uncordon|drain|reboot",
  "nodeName": "node-1",
  "force": false,
  "gracePeriod": 30
}
```

**Response**:
```json
{
  "success": true,
  "action": "cordon",
  "nodeName": "node-1",
  "timestamp": "2024-01-15T11:00:00Z"
}
```

### Get Cluster Health
Get overall cluster health status.

**Endpoint**: `GET /cluster/health`

**Response**:
```json
{
  "status": "healthy",
  "nodes": {
    "ready": 3,
    "total": 3,
    "master": 1,
    "worker": 2
  },
  "pods": {
    "running": 45,
    "pending": 0,
    "failed": 0,
    "succeeded": 12
  },
  "services": {
    "total": 15,
    "loadBalancer": 3,
    "clusterIP": 10,
    "nodePort": 2
  },
  "version": "v1.28.0",
  "uptime": "5d 12h 30m"
}
```

---

## Applications Management

### List Applications
Get all managed applications.

**Endpoint**: `GET /applications`

**Parameters**:
- `status` (query, optional): Filter by status (deployed, pending, failed, stopped)
- `environment` (query, optional): Filter by environment (development, staging, production)
- `limit` (query, optional): Number of applications to return
- `offset` (query, optional): Offset for pagination

**Response**:
```json
{
  "applications": [
    {
      "id": "1",
      "name": "sample-app",
      "gitRepo": "https://git.gmac.io/gmac/sample-app",
      "dockerImage": "registry.gmac.io/gmac/sample-app:latest",
      "status": "deployed",
      "environment": "production",
      "deployedAt": "2024-01-15T10:00:00Z",
      "health": "healthy",
      "version": "v1.2.3",
      "replicas": {
        "desired": 3,
        "current": 3,
        "ready": 3
      },
      "resources": {
        "cpu": "250m",
        "memory": "512Mi"
      }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

### Create Application
Deploy a new application.

**Endpoint**: `POST /applications`

**Request Body**:
```json
{
  "name": "my-app",
  "gitRepo": "https://git.gmac.io/gmac/my-app",
  "dockerImage": "registry.gmac.io/gmac/my-app:latest",
  "environment": "development",
  "replicas": 2,
  "resources": {
    "cpu": "100m",
    "memory": "256Mi"
  },
  "integrations": ["gitea", "drone", "harbor", "argocd"],
  "config": {
    "env": {
      "NODE_ENV": "development",
      "DATABASE_URL": "postgresql://..."
    },
    "secrets": {
      "API_KEY": "secret-ref"
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "application": {
    "id": "2",
    "name": "my-app",
    "status": "pending",
    "createdAt": "2024-01-15T11:00:00Z",
    "deploymentUrl": "https://argocd.gmac.io/applications/my-app"
  }
}
```

### Get Application Details
Get detailed information about a specific application.

**Endpoint**: `GET /applications/{id}`

**Response**:
```json
{
  "id": "1",
  "name": "sample-app",
  "gitRepo": "https://git.gmac.io/gmac/sample-app",
  "dockerImage": "registry.gmac.io/gmac/sample-app:latest",
  "status": "deployed",
  "environment": "production",
  "deployedAt": "2024-01-15T10:00:00Z",
  "health": "healthy",
  "metrics": {
    "requests": 1500,
    "errors": 12,
    "errorRate": 0.8,
    "responseTime": 245
  },
  "deployment": {
    "strategy": "RollingUpdate",
    "maxUnavailable": "25%",
    "maxSurge": "25%"
  },
  "integrations": {
    "gitea": {
      "connected": true,
      "repo": "https://git.gmac.io/gmac/sample-app",
      "lastCommit": "abc123"
    },
    "drone": {
      "connected": true,
      "buildNumber": 45,
      "buildStatus": "success"
    },
    "harbor": {
      "connected": true,
      "registry": "registry.gmac.io",
      "tags": ["latest", "v1.2.3", "dev"]
    },
    "argocd": {
      "connected": true,
      "syncStatus": "Synced",
      "healthStatus": "Healthy"
    }
  }
}
```

---

## Infrastructure Management

### Get Infrastructure Overview
Get overview of infrastructure resources and costs.

**Endpoint**: `GET /infrastructure/overview`

**Response**:
```json
{
  "cluster": {
    "status": "healthy",
    "nodes": 3,
    "pods": 45,
    "services": 12,
    "uptime": "5d 12h"
  },
  "resources": {
    "cpu": {
      "used": 45,
      "total": 100,
      "unit": "%"
    },
    "memory": {
      "used": 6.2,
      "total": 24,
      "unit": "GB"
    },
    "storage": {
      "used": 250,
      "total": 1000,
      "unit": "GB"
    }
  },
  "costs": {
    "current": 125.50,
    "projected": 3890.00,
    "currency": "USD",
    "breakdown": {
      "compute": 75.30,
      "storage": 35.20,
      "network": 15.00
    }
  },
  "providers": {
    "hetzner": {
      "instances": 3,
      "cost": 89.70
    },
    "aws": {
      "services": ["S3", "RDS"],
      "cost": 35.80
    }
  }
}
```

---

## Registry Management

### List Repositories
Get container registry repositories.

**Endpoint**: `GET /registry/repositories`

**Parameters**:
- `search` (query, optional): Search repositories by name
- `limit` (query, optional): Number of repositories to return

**Response**:
```json
{
  "repositories": [
    {
      "name": "gmac/control-panel",
      "tags": ["latest", "v1.0.0", "dev"],
      "size": "250MB",
      "lastPush": "2024-01-15T10:00:00Z",
      "pullCount": 145,
      "vulnerability": {
        "level": "low",
        "count": 3
      }
    },
    {
      "name": "gmac/sample-app",
      "tags": ["latest", "v1.2.3"],
      "size": "180MB",
      "lastPush": "2024-01-14T15:30:00Z",
      "pullCount": 89,
      "vulnerability": {
        "level": "none",
        "count": 0
      }
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 20,
    "offset": 0
  }
}
```

---

## Webhook Endpoints

### Deployment Webhook
Process deployment webhooks from various integrations.

**Endpoint**: `POST /webhooks/deployment`

**Headers**:
- `X-Gitea-Event`: For Gitea webhooks
- `X-Drone-Event`: For Drone CI webhooks
- `User-Agent`: Used to identify Harbor and ArgoCD webhooks

**Gitea Push Webhook**:
```json
{
  "action": "push",
  "repository": {
    "name": "test-repo",
    "full_name": "gmac/test-repo",
    "clone_url": "https://git.gmac.io/gmac/test-repo.git"
  },
  "pusher": {
    "login": "testuser",
    "email": "test@gmac.io"
  },
  "commits": [
    {
      "id": "abc123",
      "message": "Fix critical bug",
      "author": {
        "name": "Test User",
        "email": "test@gmac.io"
      }
    }
  ]
}
```

**Drone Build Webhook**:
```json
{
  "event": "build",
  "action": "updated",
  "repo": {
    "name": "test-repo",
    "namespace": "gmac"
  },
  "build": {
    "number": 123,
    "status": "success",
    "event": "push",
    "commit": "abc123",
    "branch": "main",
    "started": 1642694400,
    "finished": 1642694500
  }
}
```

**Response**:
```json
{
  "success": true,
  "processed": true,
  "source": "gitea",
  "event": "push",
  "repository": {
    "name": "test-repo",
    "fullName": "gmac/test-repo"
  },
  "timestamp": "2024-01-15T11:00:00Z"
}
```

---

## Health Check

### Application Health
Check application health status.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "environment": "production",
  "database": {
    "status": "healthy",
    "responseTime": 15
  },
  "integrations": {
    "gitea": {
      "status": "healthy",
      "responseTime": 120
    },
    "drone": {
      "status": "healthy",
      "responseTime": 85
    },
    "harbor": {
      "status": "healthy",
      "responseTime": 200
    },
    "argocd": {
      "status": "healthy",
      "responseTime": 95
    }
  }
}
```

---

## Real-time Streaming

### Metrics Stream
Server-Sent Events endpoint for real-time metrics.

**Endpoint**: `GET /stream/metrics`

**Parameters**:
- `types` (query, optional): Event types to stream (metric,health,alert)
- `interval` (query, optional): Update interval in milliseconds (default: 5000)

**Example**:
```bash
curl -N -H "Accept: text/event-stream" \
  "/api/stream/metrics?types=metric,health&interval=5000"
```

**Stream Format**:
```
data: {"type": "metric", "data": {"timestamp": "2024-01-15T10:00:00Z", "system": {...}}}

data: {"type": "health", "data": {"status": "healthy", "services": {...}}}

data: {"type": "alert", "data": {"alert": {"id": "1", "status": "firing", ...}}}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `AUTHENTICATION_ERROR` | Authentication required | User not authenticated |
| `AUTHORIZATION_ERROR` | Insufficient permissions | User lacks required permissions |
| `VALIDATION_ERROR` | Request validation failed | Invalid request parameters |
| `NOT_FOUND_ERROR` | Resource not found | Requested resource doesn't exist |
| `CONFLICT_ERROR` | Resource conflict | Resource already exists or conflict |
| `RATE_LIMIT_ERROR` | Rate limit exceeded | Too many requests |
| `INTEGRATION_ERROR` | External service error | Integration service unavailable |
| `DATABASE_ERROR` | Database operation failed | Database connection or query error |
| `INTERNAL_ERROR` | Internal server error | Unexpected server error |

---

## Rate Limits

| Endpoint Pattern | Limit | Window |
|------------------|-------|---------|
| `/api/auth/*` | 10 requests | 1 minute |
| `/api/monitoring/*` | 100 requests | 1 minute |
| `/api/cluster/*` | 50 requests | 1 minute |
| `/api/applications/*` | 30 requests | 1 minute |
| `/api/webhooks/*` | 1000 requests | 1 minute |
| All other endpoints | 60 requests | 1 minute |

## SDKs and Examples

### JavaScript/TypeScript
```typescript
import axios from 'axios'

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true // For session cookies
})

// Get metrics
const metrics = await client.get('/monitoring/metrics', {
  params: { timeRange: '1h' }
})

// Create application
const app = await client.post('/applications', {
  name: 'my-app',
  gitRepo: 'https://git.gmac.io/gmac/my-app',
  environment: 'development'
})
```

### Python
```python
import requests

session = requests.Session()
session.cookies.set('next-auth.session-token', 'your-token')

# Get cluster health
response = session.get('http://localhost:3000/api/cluster/health')
health = response.json()

# Acknowledge alert
response = session.post(
    'http://localhost:3000/api/monitoring/alerts/1/acknowledge'
)
```

### cURL Examples
```bash
# Get applications
curl -H "Cookie: next-auth.session-token=TOKEN" \
  "http://localhost:3000/api/applications"

# Create alert rule
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -d '{"name":"High CPU","query":"cpu > 80","severity":"high"}' \
  "http://localhost:3000/api/monitoring/alerts"
```

---

For more information or support, contact the development team or create an issue in the repository.