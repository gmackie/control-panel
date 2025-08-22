# GMAC.IO Control Panel - Administrator Guide

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation & Setup](#installation--setup)
3. [Configuration](#configuration)
4. [User Management](#user-management)
5. [Security Configuration](#security-configuration)
6. [Integration Setup](#integration-setup)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Backup & Recovery](#backup--recovery)
9. [Performance Tuning](#performance-tuning)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance](#maintenance)

---

## System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB
- **Network**: 1Gbps
- **OS**: Linux (Ubuntu 20.04+ recommended)

### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **Network**: 10Gbps
- **OS**: Ubuntu 22.04 LTS

### Dependencies
- **Kubernetes**: v1.26+ (K3s recommended for edge deployments)
- **Node.js**: v20+
- **PostgreSQL**: v14+
- **Redis**: v6+ (optional but recommended)
- **NGINX**: v1.20+ (as ingress controller)
- **cert-manager**: v1.12+ (for SSL certificates)

---

## Installation & Setup

### 1. Infrastructure Preparation

**Kubernetes Cluster Setup**:
```bash
# Install K3s
curl -sfL https://get.k3s.io | sh -

# Or install full Kubernetes
# Follow official Kubernetes installation guide

# Verify cluster
kubectl get nodes
```

**Database Setup**:
```bash
# Install PostgreSQL
sudo apt update && sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres createdb control_panel
sudo -u postgres createuser -P control_panel_user
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE control_panel TO control_panel_user;"
```

### 2. Application Deployment

**Using Kubernetes Manifests**:
```bash
# Clone repository
git clone https://github.com/yourusername/control-panel.git
cd control-panel

# Update configurations
cp k8s/03-secret.yaml.example k8s/03-secret.yaml
# Edit secrets with actual values

# Deploy to Kubernetes
kubectl apply -f k8s/
```

**Using Docker Compose** (Development):
```bash
# Copy environment file
cp .env.example .env.local
# Edit environment variables

# Start services
docker-compose up -d
```

**Using Helm** (Recommended):
```bash
# Add Helm repository
helm repo add gmac-control-panel https://charts.gmac.io/control-panel
helm repo update

# Install with custom values
helm install control-panel gmac-control-panel/control-panel \
  --namespace control-panel \
  --create-namespace \
  --values values.yaml
```

### 3. Initial Configuration

**Environment Variables**:
```bash
# Core settings
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=https://control.gmac.io
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/control_panel

# GitHub OAuth
GITHUB_CLIENT_ID=<github-app-id>
GITHUB_CLIENT_SECRET=<github-app-secret>

# Integration APIs
GITEA_URL=https://git.gmac.io
GITEA_TOKEN=<gitea-token>
DRONE_URL=https://ci.gmac.io
DRONE_TOKEN=<drone-token>
HARBOR_URL=https://registry.gmac.io
HARBOR_USERNAME=<harbor-user>
HARBOR_PASSWORD=<harbor-pass>
ARGOCD_URL=https://argocd.gmac.io
ARGOCD_TOKEN=<argocd-token>
```

**First Run Setup**:
```bash
# Run database migrations
npm run db:migrate

# Create admin user (if needed)
npm run create-admin-user

# Verify installation
curl https://control.gmac.io/api/health
```

---

## Configuration

### Database Configuration

**Connection Pool Settings**:
```yaml
database:
  pool:
    min: 2
    max: 10
    acquireTimeoutMillis: 30000
    createTimeoutMillis: 30000
    destroyTimeoutMillis: 5000
    idleTimeoutMillis: 30000
    reapIntervalMillis: 1000
    createRetryIntervalMillis: 100
```

**Performance Tuning**:
```sql
-- PostgreSQL optimizations
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
SELECT pg_reload_conf();
```

### Application Configuration

**config/production.js**:
```javascript
module.exports = {
  // Server settings
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    timeout: 30000
  },
  
  // Security settings
  security: {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      skipSuccessfulRequests: false
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://control.gmac.io'],
      credentials: true
    }
  },
  
  // Integration settings
  integrations: {
    gitea: {
      url: process.env.GITEA_URL,
      token: process.env.GITEA_TOKEN,
      timeout: 10000
    },
    drone: {
      url: process.env.DRONE_URL,
      token: process.env.DRONE_TOKEN,
      timeout: 10000
    }
  },
  
  // Monitoring settings
  monitoring: {
    metrics: {
      enabled: true,
      interval: 30000,
      retention: '7d'
    },
    alerts: {
      enabled: true,
      defaultSeverity: 'medium',
      escalationTimeout: '15m'
    }
  }
}
```

### Kubernetes Configuration

**Resource Limits**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: control-panel
spec:
  template:
    spec:
      containers:
      - name: control-panel
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

**Horizontal Pod Autoscaler**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: control-panel-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: control-panel
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## User Management

### Authentication Setup

**GitHub OAuth Application**:
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App with:
   - **Application name**: GMAC.IO Control Panel
   - **Homepage URL**: `https://control.gmac.io`
   - **Authorization callback URL**: `https://control.gmac.io/api/auth/callback/github`
3. Note Client ID and Client Secret

**User Authorization**:
```bash
# Add user to authorized list
kubectl exec -it deployment/control-panel -- npm run add-user -- \
  --email="user@gmac.io" \
  --role="admin" \
  --github-username="username"

# List authorized users
kubectl exec -it deployment/control-panel -- npm run list-users

# Remove user
kubectl exec -it deployment/control-panel -- npm run remove-user -- \
  --email="user@gmac.io"
```

### Role-Based Access Control (RBAC)

**Role Definitions**:
- **Super Admin**: Full system access, user management
- **Admin**: All features except user management
- **Operator**: Read/write access to applications and monitoring
- **Viewer**: Read-only access to dashboards and metrics

**Role Assignment**:
```sql
-- Update user role
UPDATE users SET role = 'admin' WHERE email = 'user@gmac.io';

-- Create custom roles
INSERT INTO roles (name, permissions) VALUES 
  ('DevOps', ARRAY['applications:write', 'monitoring:write', 'cluster:read']);
```

### Session Management

**Session Configuration**:
```javascript
// next-auth configuration
export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60,  // 1 hour
  },
  jwt: {
    maxAge: 8 * 60 * 60,
    encryption: true,
  }
}
```

---

## Security Configuration

### SSL/TLS Setup

**cert-manager Configuration**:
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@gmac.io
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

**Ingress Configuration**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: control-panel-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - control.gmac.io
    secretName: control-panel-tls
  rules:
  - host: control.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: control-panel-service
            port:
              number: 3000
```

### Network Security

**Network Policies**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: control-panel-netpol
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: control-panel
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: nginx-ingress
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS
    - protocol: TCP
      port: 5432 # PostgreSQL
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
```

### Secrets Management

**Using Kubernetes Secrets**:
```bash
# Create secrets from environment file
kubectl create secret generic control-panel-secrets \
  --from-env-file=.env.production

# Create TLS secret
kubectl create secret tls control-panel-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem
```

**Using External Secret Operators**:
```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-secret-store
spec:
  provider:
    vault:
      server: "https://vault.gmac.io"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "control-panel"
```

### Security Headers

**NGINX Configuration**:
```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss:" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## Integration Setup

### Gitea Integration

**API Token Creation**:
1. Log in to Gitea admin interface
2. Go to Settings → Applications → Generate New Token
3. Select scopes: `repo`, `admin:repo_hook`, `read:org`
4. Configure in control panel environment

**Webhook Configuration**:
```bash
# Webhook URL
https://control.gmac.io/api/webhooks/deployment

# Webhook secret (optional but recommended)
openssl rand -hex 32

# Events to trigger
- Push events
- Pull request events
- Repository events
```

### Drone CI Integration

**Token Generation**:
```bash
# Get user token from Drone CLI
drone user info

# Or create service account token
drone service account create control-panel-bot
```

**Pipeline Configuration** (.drone.yml):
```yaml
kind: pipeline
type: kubernetes
name: build-and-deploy

steps:
- name: webhook-notify
  image: plugins/webhook
  settings:
    urls: https://control.gmac.io/api/webhooks/deployment
    headers:
      - "X-Drone-Event: build"
  when:
    status: [ success, failure ]
```

### Harbor Integration

**Robot Account Setup**:
1. Go to Harbor → Projects → Robot Accounts
2. Create robot account with pull/push permissions
3. Download or copy credentials
4. Configure in control panel

**Webhook Configuration**:
```json
{
  "name": "control-panel-webhook",
  "description": "Send events to control panel",
  "targets": [
    {
      "type": "http",
      "address": "https://control.gmac.io/api/webhooks/deployment",
      "skip_cert_verify": false,
      "auth_header": "Authorization: Bearer YOUR_TOKEN"
    }
  ],
  "event_types": [
    "pushImage",
    "pullImage",
    "scanningCompleted"
  ]
}
```

### ArgoCD Integration

**Token Creation**:
```bash
# Create service account
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: control-panel-sa
  namespace: argocd
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: control-panel-role
rules:
- apiGroups: [""]
  resources: ["*"]
  verbs: ["get", "list"]
- apiGroups: ["argoproj.io"]
  resources: ["applications"]
  verbs: ["get", "list", "patch", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: control-panel-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: control-panel-role
subjects:
- kind: ServiceAccount
  name: control-panel-sa
  namespace: argocd
EOF

# Get token
kubectl -n argocd create token control-panel-sa --duration=8760h
```

---

## Monitoring & Alerting

### Prometheus Configuration

**Scrape Configuration**:
```yaml
# prometheus.yml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'control-panel'
    static_configs:
    - targets: ['control-panel-service:3000']
    metrics_path: /api/metrics
    scrape_interval: 30s

  - job_name: 'kubernetes-nodes'
    kubernetes_sd_configs:
    - role: node
    relabel_configs:
    - source_labels: [__address__]
      regex: '(.*):10250'
      target_label: __address__
      replacement: '${1}:9100'

alertmanager:
  alertmanagers:
  - static_configs:
    - targets: ['alertmanager:9093']
```

### Alert Rules

**High-Level Alerts**:
```yaml
# alert_rules.yml
groups:
- name: control-panel
  rules:
  - alert: ControlPanelDown
    expr: up{job="control-panel"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Control Panel is down"
      description: "Control Panel has been down for more than 1 minute"

  - alert: HighMemoryUsage
    expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
    for: 5m
    labels:
      severity: high
    annotations:
      summary: "High memory usage on {{ $labels.instance }}"
      description: "Memory usage is above 90% on {{ $labels.instance }}"

  - alert: PodCrashLooping
    expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
    for: 5m
    labels:
      severity: high
    annotations:
      summary: "Pod {{ $labels.pod }} is crash looping"
      description: "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} is restarting frequently"
```

### Grafana Dashboards

**Control Panel Dashboard** (JSON):
```json
{
  "dashboard": {
    "title": "GMAC.IO Control Panel",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_ms_bucket[5m])) by (le))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph", 
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m]))",
            "legendFormat": "Requests/sec"
          }
        ]
      }
    ]
  }
}
```

### Log Aggregation

**Loki Configuration**:
```yaml
# loki-config.yml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1

schema_config:
  configs:
  - from: 2020-10-24
    store: boltdb-shipper
    object_store: filesystem
    schema: v11
    index:
      prefix: index_
      period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /tmp/loki/boltdb-shipper-active
    cache_location: /tmp/loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /tmp/loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

---

## Backup & Recovery

### Automated Backup Script

**Database Backup**:
```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="control_panel"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Dump database
pg_dump "$DB_NAME" | gzip > "$BACKUP_DIR/database_$DATE.sql.gz"

# Upload to S3 (optional)
if [ -n "$S3_BUCKET" ]; then
  aws s3 cp "$BACKUP_DIR/database_$DATE.sql.gz" "s3://$S3_BUCKET/database/"
fi

# Clean up old backups (keep 30 days)
find "$BACKUP_DIR" -name "database_*.sql.gz" -mtime +30 -delete

echo "Database backup completed: database_$DATE.sql.gz"
```

**Kubernetes Backup**:
```bash
#!/bin/bash
# backup-kubernetes.sh

BACKUP_DIR="/backups/kubernetes"
DATE=$(date +%Y%m%d_%H%M%S)
NAMESPACE="control-panel"

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Backup namespace resources
kubectl get all,configmap,secret,ingress,pvc -n "$NAMESPACE" -o yaml > "$BACKUP_DIR/$DATE/resources.yaml"

# Backup cluster-level resources
kubectl get clusterrole,clusterrolebinding -o yaml > "$BACKUP_DIR/$DATE/cluster-resources.yaml"

# Create archive
tar -czf "$BACKUP_DIR/k8s_backup_$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"
rm -rf "$BACKUP_DIR/$DATE"

echo "Kubernetes backup completed: k8s_backup_$DATE.tar.gz"
```

### Backup Schedule

**Cron Configuration**:
```bash
# /etc/cron.d/control-panel-backup
0 2 * * * root /opt/control-panel/scripts/backup-database.sh
0 3 * * * root /opt/control-panel/scripts/backup-kubernetes.sh
0 4 * * 0 root /opt/control-panel/scripts/backup-full.sh
```

### Recovery Procedures

**Database Recovery**:
```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE="$1"
DB_NAME="control_panel"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

# Stop application
kubectl scale deployment control-panel --replicas=0

# Drop and recreate database
dropdb "$DB_NAME"
createdb "$DB_NAME"

# Restore from backup
gunzip -c "$BACKUP_FILE" | psql "$DB_NAME"

# Restart application
kubectl scale deployment control-panel --replicas=3

echo "Database restored from $BACKUP_FILE"
```

**Application Recovery**:
```bash
#!/bin/bash
# restore-application.sh

BACKUP_DIR="$1"

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: $0 <backup-directory>"
  exit 1
fi

# Apply Kubernetes resources
kubectl apply -f "$BACKUP_DIR/resources.yaml"

# Wait for pods to be ready
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=control-panel --timeout=300s

echo "Application restored from $BACKUP_DIR"
```

---

## Performance Tuning

### Application Performance

**Node.js Optimization**:
```javascript
// package.json production settings
{
  "scripts": {
    "start": "NODE_ENV=production node --max-old-space-size=2048 server.js"
  }
}
```

**Next.js Configuration**:
```javascript
// next.config.js
module.exports = {
  experimental: {
    runtime: 'nodejs',
    serverComponentsExternalPackages: ['pg', 'bcryptjs']
  },
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  httpAgentOptions: {
    keepAlive: true,
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: ['avatars.githubusercontent.com']
  }
}
```

### Database Performance

**Connection Pooling**:
```javascript
// lib/database.js
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000
})
```

**Query Optimization**:
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_environment ON applications(environment);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);

-- Optimize queries with EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM applications WHERE status = 'deployed';
```

### Kubernetes Performance

**Resource Requests/Limits**:
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

**Readiness/Liveness Probes**:
```yaml
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 5
```

---

## Troubleshooting

### Common Issues

**Application Won't Start**:
1. Check environment variables
2. Verify database connectivity
3. Review application logs
4. Check resource constraints

**Database Connection Issues**:
```bash
# Test database connectivity
pg_isready -h localhost -p 5432 -U control_panel_user

# Check connection pool status
kubectl exec -it deployment/control-panel -- npm run db:status

# Review database logs
kubectl logs deployment/postgres
```

**Integration Failures**:
```bash
# Test external service connectivity
curl -I https://git.gmac.io/api/v1/version
curl -I https://ci.gmac.io/api/user
curl -I https://registry.gmac.io/api/health

# Check webhook delivery
kubectl logs -f deployment/control-panel | grep webhook
```

**Performance Issues**:
```bash
# Check resource usage
kubectl top pods -n control-panel
kubectl top nodes

# Review slow queries
kubectl exec -it deployment/postgres -- psql -U control_panel_user -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Log Analysis

**Application Logs**:
```bash
# Follow application logs
kubectl logs -f deployment/control-panel

# Search for errors
kubectl logs deployment/control-panel | grep ERROR

# Export logs for analysis
kubectl logs deployment/control-panel --since=1h > app-logs.txt
```

**System Logs**:
```bash
# Check system events
kubectl get events --sort-by=.metadata.creationTimestamp

# Review pod events
kubectl describe pod <pod-name>

# Check node status
kubectl describe nodes
```

---

## Maintenance

### Regular Maintenance Tasks

**Daily**:
- Monitor application health
- Check alert status
- Review error logs
- Verify backup completion

**Weekly**:
- Update container images
- Review security alerts
- Analyze performance metrics
- Check disk space usage

**Monthly**:
- Update dependencies
- Review access logs
- Optimize database
- Update documentation

**Quarterly**:
- Security audit
- Performance review
- Disaster recovery testing
- Infrastructure cost review

### Update Procedures

**Application Updates**:
```bash
# Rolling update with zero downtime
kubectl set image deployment/control-panel \
  control-panel=registry.gmac.io/gmac/control-panel:v1.1.0

# Monitor rollout
kubectl rollout status deployment/control-panel

# Rollback if needed
kubectl rollout undo deployment/control-panel
```

**Database Schema Updates**:
```bash
# Create database backup before migration
kubectl exec -it deployment/postgres -- pg_dump control_panel > backup.sql

# Run migrations
kubectl exec -it deployment/control-panel -- npm run db:migrate

# Verify migration success
kubectl exec -it deployment/control-panel -- npm run db:status
```

### Monitoring Scripts

**Health Check Script**:
```bash
#!/bin/bash
# health-check.sh

ENDPOINTS=(
  "https://control.gmac.io/api/health"
  "https://control.gmac.io/api/auth/verify"
)

for endpoint in "${ENDPOINTS[@]}"; do
  if curl -sf "$endpoint" > /dev/null; then
    echo "✓ $endpoint - OK"
  else
    echo "✗ $endpoint - FAILED"
    # Send alert notification
    curl -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"Health check failed for $endpoint\"}"
  fi
done
```

**Disk Space Monitor**:
```bash
#!/bin/bash
# disk-monitor.sh

THRESHOLD=80
USAGE=$(df /data | tail -1 | awk '{print $5}' | sed 's/%//')

if [ "$USAGE" -gt "$THRESHOLD" ]; then
  echo "Warning: Disk usage is ${USAGE}% (threshold: ${THRESHOLD}%)"
  # Clean up old logs
  find /data/logs -name "*.log" -mtime +7 -delete
  # Send alert
  curl -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"Disk usage warning: ${USAGE}%\"}"
fi
```

### Security Maintenance

**Certificate Renewal**:
```bash
# Check certificate expiration
kubectl get certificates -A

# Manual renewal if needed
kubectl delete certificaterequest <cert-request-name>
kubectl annotate certificate control-panel-tls cert-manager.io/force-renewal=true
```

**Security Updates**:
```bash
# Update base images
docker pull node:20-alpine
docker pull postgres:15-alpine
docker pull nginx:1.24-alpine

# Scan for vulnerabilities
trivy image registry.gmac.io/gmac/control-panel:latest

# Update Kubernetes
kubectl version --short
# Follow cluster upgrade procedures
```

---

For additional administrative support or advanced configuration needs, consult the API documentation or contact the development team.