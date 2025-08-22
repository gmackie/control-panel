# API Specification

## Overview

The gmac.io Business Control Panel provides a comprehensive REST API for managing services, integrations, databases, and monitoring. All APIs follow RESTful principles and use JSON for data exchange.

## Base URL

```
https://api.gmac.io/v1
```

## Authentication

All API requests require authentication using JWT tokens.

### Authentication Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### JWT Token Structure

```json
{
  "sub": "user_id",
  "org": "organization_id",
  "roles": ["admin", "developer"],
  "permissions": ["services:read", "services:write"],
  "exp": 1640995200,
  "iat": 1640908800
}
```

## Common Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "name",
      "issue": "Required field missing"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

## Services API

### Get Services

**GET** `/services`

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search term for service name/description
- `category` (string): Filter by service category
- `framework` (string): Filter by framework
- `status` (string): Filter by service status
- `environment` (string): Filter by environment

**Response**:
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "svc_123456789",
        "name": "Control Panel",
        "description": "Main control panel application",
        "type": "nextjs",
        "status": "healthy",
        "environment": "production",
        "url": "https://control.gmac.io",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "metrics": {
          "cpu": 45,
          "memory": 67,
          "requests": 1234,
          "responseTime": 120,
          "errorRate": 0.1
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

### Create Service

**POST** `/services`

**Request Body**:
```json
{
  "template": "nextjs-web",
  "config": {
    "name": "my-service",
    "description": "My new service",
    "environment": "production",
    "namespace": "default",
    "replicas": 2,
    "resources": {
      "cpu": "200m",
      "memory": "256Mi"
    },
    "ports": [
      {
        "name": "http",
        "port": 80,
        "targetPort": 3000,
        "protocol": "TCP"
      }
    ],
    "envVars": {
      "NODE_ENV": "production",
      "PORT": "3000"
    },
    "secrets": ["database-url", "api-key"],
    "healthCheck": {
      "path": "/health",
      "initialDelaySeconds": 30,
      "periodSeconds": 10,
      "timeoutSeconds": 5,
      "failureThreshold": 3
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "svc_123456789",
    "name": "my-service",
    "status": "creating",
    "deployment": {
      "id": "dep_123456789",
      "status": "pending",
      "url": "https://my-service.staging.gmac.io"
    }
  }
}
```

### Get Service

**GET** `/services/{serviceId}`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "svc_123456789",
    "name": "Control Panel",
    "description": "Main control panel application",
    "type": "nextjs",
    "status": "healthy",
    "environment": "production",
    "url": "https://control.gmac.io",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "config": {
      "namespace": "default",
      "replicas": 2,
      "resources": {
        "cpu": "200m",
        "memory": "256Mi"
      },
      "ports": [
        {
          "name": "http",
          "port": 80,
          "targetPort": 3000,
          "protocol": "TCP"
        }
      ],
      "envVars": {
        "NODE_ENV": "production"
      },
      "secrets": ["database-url"],
      "healthCheck": {
        "path": "/health",
        "initialDelaySeconds": 30,
        "periodSeconds": 10,
        "timeoutSeconds": 5,
        "failureThreshold": 3
      }
    },
    "metrics": {
      "cpu": 45,
      "memory": 67,
      "requests": 1234,
      "responseTime": 120,
      "errorRate": 0.1
    },
    "integrations": {
      "clerk": true,
      "stripe": true,
      "turso": true
    }
  }
}
```

### Update Service

**PUT** `/services/{serviceId}`

**Request Body**:
```json
{
  "description": "Updated description",
  "config": {
    "replicas": 3,
    "resources": {
      "cpu": "300m",
      "memory": "512Mi"
    }
  }
}
```

### Delete Service

**DELETE** `/services/{serviceId}`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Service deleted successfully"
  }
}
```

## Service Templates API

### Get Templates

**GET** `/services/templates`

**Response**:
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "nextjs-web",
        "name": "Next.js Web Application",
        "description": "A modern React web application with Next.js framework",
        "category": "web",
        "framework": "nextjs",
        "features": ["SSR", "API Routes", "TypeScript", "Tailwind CSS"],
        "defaultConfig": {
          "replicas": 2,
          "resources": {
            "cpu": "200m",
            "memory": "256Mi"
          },
          "ports": [
            {
              "name": "http",
              "port": 80,
              "targetPort": 3000,
              "protocol": "TCP"
            }
          ],
          "envVars": {
            "NODE_ENV": "production",
            "PORT": "3000"
          },
          "healthCheck": {
            "path": "/api/health",
            "initialDelaySeconds": 30,
            "periodSeconds": 10,
            "timeoutSeconds": 5,
            "failureThreshold": 3
          }
        },
        "dockerfile": "FROM node:20-alpine...",
        "k8sManifests": [
          "apiVersion: apps/v1\nkind: Deployment..."
        ],
        "ciConfig": "name: Deploy to Kubernetes..."
      }
    ]
  }
}
```

## Integrations API

### Get Service Integrations

**GET** `/services/{serviceId}/integrations`

**Response**:
```json
{
  "success": true,
  "data": {
    "integrations": [
      {
        "id": "int_123456789",
        "serviceId": "svc_123456789",
        "type": "auth",
        "provider": "clerk",
        "name": "Clerk Authentication",
        "config": {
          "publishableKey": "pk_test_...",
          "secretKey": "sk_test_..."
        },
        "status": "active",
        "lastChecked": "2024-01-15T10:30:00Z",
        "apiKeys": ["clerk-publishable-key", "clerk-secret-key"],
        "webhooks": ["https://control.gmac.io/api/webhooks/clerk"],
        "health": {
          "status": "healthy",
          "lastCheck": "2024-01-15T10:30:00Z",
          "responseTime": 45
        }
      }
    ]
  }
}
```

### Create Integration

**POST** `/services/{serviceId}/integrations`

**Request Body**:
```json
{
  "type": "payment",
  "provider": "stripe",
  "name": "Stripe Payments",
  "config": {
    "publishableKey": "pk_test_...",
    "secretKey": "sk_test_...",
    "webhookSecret": "whsec_..."
  },
  "apiKeys": ["stripe-publishable-key", "stripe-secret-key"],
  "webhooks": ["https://control.gmac.io/api/webhooks/stripe"]
}
```

### Update Integration

**PUT** `/services/{serviceId}/integrations/{integrationId}`

### Delete Integration

**DELETE** `/services/{serviceId}/integrations/{integrationId}`

## Databases API

### Get Service Databases

**GET** `/services/{serviceId}/databases`

**Response**:
```json
{
  "success": true,
  "data": {
    "databases": [
      {
        "id": "db_123456789",
        "serviceId": "svc_123456789",
        "name": "control-panel-db",
        "type": "turso",
        "provider": "turso",
        "status": "healthy",
        "connectionString": "libsql://control-panel-db.turso.io",
        "size": 52428800,
        "connections": 12,
        "operations": {
          "reads": 150,
          "writes": 25
        },
        "migrations": [
          {
            "id": "mig_123456789",
            "version": "001",
            "name": "create_users_table",
            "status": "completed",
            "appliedAt": "2024-01-15T10:30:00Z",
            "duration": 120,
            "sql": "CREATE TABLE users..."
          }
        ],
        "backups": [
          {
            "id": "backup_123456789",
            "name": "backup-2024-01-15",
            "size": 52428800,
            "status": "completed",
            "createdAt": "2024-01-15T10:30:00Z",
            "expiresAt": "2024-02-15T10:30:00Z",
            "location": "s3://backups/control-panel-db/2024-01-15.sql"
          }
        ],
        "monitoring": {
          "queries": [
            {
              "sql": "SELECT * FROM users WHERE email = ?",
              "count": 1250,
              "avgTime": 2.5,
              "maxTime": 15.2,
              "lastExecuted": "2024-01-15T10:30:00Z"
            }
          ],
          "connections": {
            "active": 8,
            "idle": 4,
            "max": 20
          },
          "performance": {
            "slowQueries": 2,
            "deadlocks": 0,
            "cacheHitRatio": 0.95
          }
        }
      }
    ]
  }
}
```

### Create Database

**POST** `/services/{serviceId}/databases`

**Request Body**:
```json
{
  "name": "my-database",
  "type": "turso",
  "provider": "turso",
  "config": {
    "region": "us-east-1",
    "size": "small",
    "backupRetention": "30d"
  }
}
```

### Get Database Migrations

**GET** `/services/{serviceId}/databases/{databaseId}/migrations`

### Create Migration

**POST** `/services/{serviceId}/databases/{databaseId}/migrations`

**Request Body**:
```json
{
  "name": "add_user_roles",
  "sql": "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
  "description": "Add role column to users table"
}
```

## Monitoring API

### Get Service Monitoring

**GET** `/services/{serviceId}/monitoring`

**Response**:
```json
{
  "success": true,
  "data": {
    "prometheus": {
      "enabled": true,
      "url": "http://prometheus.gmac.io",
      "metrics": [
        "http_requests_total",
        "http_request_duration_seconds",
        "process_cpu_seconds_total"
      ],
      "alerts": [
        {
          "id": "alert_123456789",
          "name": "High CPU Usage",
          "severity": "warning",
          "status": "firing",
          "startsAt": "2024-01-15T10:30:00Z",
          "summary": "CPU usage is above 80%",
          "description": "The service is experiencing high CPU usage"
        }
      ]
    },
    "grafana": {
      "enabled": true,
      "url": "http://grafana.gmac.io",
      "dashboards": [
        {
          "id": "dashboard_123456789",
          "title": "Control Panel Overview",
          "uid": "control-panel-overview",
          "url": "http://grafana.gmac.io/d/control-panel-overview",
          "version": 1,
          "updatedAt": "2024-01-15T10:30:00Z"
        }
      ]
    },
    "alertmanager": {
      "enabled": true,
      "url": "http://alertmanager.gmac.io",
      "receivers": [
        {
          "id": "receiver_123456789",
          "name": "Slack Alerts",
          "type": "slack",
          "config": {
            "webhookUrl": "https://hooks.slack.com/services/...",
            "channel": "#alerts"
          },
          "status": "active"
        }
      ]
    },
    "logs": {
      "enabled": true,
      "provider": "loki",
      "retention": "30d",
      "filters": [
        {
          "id": "filter_123456789",
          "name": "Error Logs",
          "query": "{service=\"control-panel\"} |= \"error\"",
          "level": "error",
          "timeRange": "1h"
        }
      ]
    }
  }
}
```

### Update Monitoring Configuration

**PUT** `/services/{serviceId}/monitoring`

**Request Body**:
```json
{
  "prometheus": {
    "enabled": true,
    "metrics": [
      "http_requests_total",
      "http_request_duration_seconds"
    ]
  },
  "grafana": {
    "enabled": true,
    "dashboards": [
      {
        "title": "Custom Dashboard",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total[5m])",
                "legendFormat": "{{method}} {{status}}"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Deployments API

### Get Service Deployments

**GET** `/services/{serviceId}/deployments`

**Response**:
```json
{
  "success": true,
  "data": {
    "deployments": [
      {
        "id": "dep_123456789",
        "serviceId": "svc_123456789",
        "version": "v1.2.0",
        "status": "success",
        "environment": "production",
        "strategy": "blue-green",
        "createdAt": "2024-01-15T10:30:00Z",
        "completedAt": "2024-01-15T10:35:00Z",
        "duration": 300,
        "commit": {
          "sha": "abc123def456",
          "message": "Add new feature",
          "author": "john.doe@gmac.io"
        },
        "resources": {
          "replicas": 3,
          "cpu": "300m",
          "memory": "512Mi"
        },
        "health": {
          "status": "healthy",
          "checks": [
            {
              "name": "http-health",
              "status": "passing",
              "responseTime": 45
            }
          ]
        }
      }
    ]
  }
}
```

### Create Deployment

**POST** `/services/{serviceId}/deployments`

**Request Body**:
```json
{
  "version": "v1.3.0",
  "environment": "production",
  "strategy": "blue-green",
  "config": {
    "replicas": 3,
    "resources": {
      "cpu": "300m",
      "memory": "512Mi"
    }
  }
}
```

### Rollback Deployment

**POST** `/services/{serviceId}/deployments/{deploymentId}/rollback`

## Metrics API

### Get Service Metrics

**GET** `/services/{serviceId}/metrics`

**Query Parameters**:
- `period` (string): Time period (1h, 6h, 24h, 7d, 30d)
- `metric` (string): Metric name (cpu, memory, requests, errors)
- `aggregation` (string): Aggregation function (avg, sum, min, max)

**Response**:
```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "name": "cpu_usage",
        "values": [
          {
            "timestamp": "2024-01-15T10:00:00Z",
            "value": 45.2
          },
          {
            "timestamp": "2024-01-15T10:05:00Z",
            "value": 47.8
          }
        ]
      },
      {
        "name": "memory_usage",
        "values": [
          {
            "timestamp": "2024-01-15T10:00:00Z",
            "value": 67.3
          },
          {
            "timestamp": "2024-01-15T10:05:00Z",
            "value": 68.1
          }
        ]
      }
    ]
  }
}
```

## Alerts API

### Get Alerts

**GET** `/alerts`

**Query Parameters**:
- `service` (string): Filter by service ID
- `severity` (string): Filter by severity (critical, warning, info)
- `status` (string): Filter by status (firing, resolved)
- `active` (boolean): Show only active alerts

**Response**:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert_123456789",
        "name": "High CPU Usage",
        "severity": "warning",
        "status": "firing",
        "serviceId": "svc_123456789",
        "serviceName": "Control Panel",
        "startsAt": "2024-01-15T10:30:00Z",
        "summary": "CPU usage is above 80%",
        "description": "The service is experiencing high CPU usage",
        "labels": {
          "service": "control-panel",
          "environment": "production"
        }
      }
    ]
  }
}
```

### Acknowledge Alert

**POST** `/alerts/{alertId}/acknowledge`

**Request Body**:
```json
{
  "comment": "Investigating the issue"
}
```

## Webhooks API

### Get Webhooks

**GET** `/webhooks`

**Response**:
```json
{
  "success": true,
  "data": {
    "webhooks": [
      {
        "id": "webhook_123456789",
        "name": "Stripe Payment Events",
        "url": "https://control.gmac.io/api/webhooks/stripe",
        "events": ["payment_intent.succeeded", "payment_intent.failed"],
        "status": "active",
        "lastTriggered": "2024-01-15T10:30:00Z",
        "deliveryStats": {
          "total": 1250,
          "successful": 1245,
          "failed": 5,
          "successRate": 0.996
        }
      }
    ]
  }
}
```

### Create Webhook

**POST** `/webhooks`

**Request Body**:
```json
{
  "name": "GitHub Push Events",
  "url": "https://control.gmac.io/api/webhooks/github",
  "events": ["push", "pull_request"],
  "secret": "webhook_secret_key"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid input data |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RESOURCE_CONFLICT` | Resource already exists |
| `DEPENDENCY_ERROR` | Required dependency not available |
| `DEPLOYMENT_ERROR` | Deployment operation failed |
| `INTEGRATION_ERROR` | Third-party integration error |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| `INTERNAL_ERROR` | Internal server error |

## Rate Limiting

- **Standard Plan**: 1000 requests per hour
- **Pro Plan**: 10000 requests per hour
- **Enterprise Plan**: 100000 requests per hour

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1640995200
```

## Pagination

All list endpoints support pagination with the following parameters:

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)

Response includes pagination metadata:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## WebSocket API

### Real-time Updates

**WebSocket URL**: `wss://api.gmac.io/v1/ws`

**Connection**:
```javascript
const ws = new WebSocket('wss://api.gmac.io/v1/ws', {
  headers: {
    'Authorization': 'Bearer <jwt_token>'
  }
});
```

**Event Types**:
- `service.updated`: Service status or configuration changed
- `deployment.started`: New deployment started
- `deployment.completed`: Deployment completed
- `alert.firing`: New alert triggered
- `alert.resolved`: Alert resolved
- `integration.health_changed`: Integration health status changed

**Message Format**:
```json
{
  "type": "service.updated",
  "data": {
    "serviceId": "svc_123456789",
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
``` 