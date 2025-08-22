# GMAC.IO Control Panel - Deployment Guide

This guide provides comprehensive instructions for deploying the GMAC.IO Control Panel to production.

## Prerequisites

### Infrastructure Requirements
- Kubernetes cluster (K3s, K8s, or managed service)
- Container registry (Harbor recommended)
- PostgreSQL database
- Redis instance (optional but recommended)
- NGINX Ingress Controller
- cert-manager for SSL certificates

### Development Tools
- Docker
- kubectl
- Node.js 20+
- npm or yarn

### Required Access
- Kubernetes cluster admin access
- Container registry push/pull access
- DNS management for domain configuration
- GitHub repository access (for CI/CD)

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/control-panel.git
cd control-panel
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Edit configuration
nano .env.local
```

Required environment variables:
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` - GitHub OAuth app
- Database connection details
- Integration API tokens (Gitea, Drone, Harbor, ArgoCD)

### 3. Kubernetes Secrets
```bash
# Create namespace
kubectl apply -f k8s/01-namespace.yaml

# Update secrets in k8s/03-secret.yaml
kubectl apply -f k8s/03-secret.yaml
```

**Security Note**: Use sealed-secrets or external secret management in production.

## Building and Deployment

### Method 1: Docker Build and Push

```bash
# Build container image
docker build -t registry.gmac.io/gmac/control-panel:latest .

# Push to registry
docker push registry.gmac.io/gmac/control-panel:latest

# Deploy to Kubernetes
kubectl apply -f k8s/
```

### Method 2: CI/CD Pipeline

1. Configure GitHub secrets:
   ```
   HARBOR_USERNAME
   HARBOR_PASSWORD
   KUBE_CONFIG_STAGING
   KUBE_CONFIG_PRODUCTION
   SLACK_WEBHOOK_URL (optional)
   ```

2. Push code to trigger deployment:
   ```bash
   git push origin main           # Deploys to production
   git push origin develop        # Deploys to staging
   ```

### Method 3: ArgoCD GitOps

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: control-panel
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://git.gmac.io/gmac/control-panel
    targetRevision: HEAD
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: control-panel
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## Database Setup

### PostgreSQL Installation

```bash
# Using Helm
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgres bitnami/postgresql \
  --namespace control-panel \
  --set auth.postgresPassword=your-password \
  --set auth.database=control_panel
```

### Database Initialization

```bash
# Connect to database
kubectl exec -it postgres-0 -n control-panel -- psql -U postgres -d control_panel

# Create application user
CREATE USER control_panel_user WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE control_panel TO control_panel_user;
```

## SSL/TLS Configuration

### cert-manager Setup

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create Let's Encrypt issuer
kubectl apply -f - <<EOF
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
EOF
```

## Monitoring Setup

### Prometheus Configuration

```bash
# Apply Prometheus configuration
kubectl create configmap prometheus-config \
  --from-file=monitoring/prometheus.yml \
  --from-file=monitoring/alert_rules.yml \
  -n monitoring

# Deploy Prometheus (using Helm)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

### Grafana Dashboards

Import the following dashboard IDs:
- Node Exporter Full: `1860`
- Kubernetes Cluster Monitoring: `7249`
- NGINX Ingress Controller: `9614`

## Health Checks and Monitoring

### Application Health
```bash
# Check pod status
kubectl get pods -n control-panel

# Check application health
kubectl exec -n control-panel deployment/control-panel -- curl http://localhost:3000/api/health

# View logs
kubectl logs -f deployment/control-panel -n control-panel
```

### Integration Health
```bash
# Test Gitea connection
curl -H "Authorization: token YOUR_TOKEN" https://git.gmac.io/api/v1/version

# Test Drone connection
curl -H "Authorization: Bearer YOUR_TOKEN" https://ci.gmac.io/api/user

# Test Harbor connection
curl -u "admin:PASSWORD" https://registry.gmac.io/api/v2.0/health
```

## Backup and Disaster Recovery

### Automated Backups

```bash
# Run backup script
./scripts/backup.sh

# Schedule with cron
0 2 * * * /path/to/control-panel/scripts/backup.sh
```

### Restore Process

```bash
# Interactive restore
./scripts/restore.sh interactive

# Restore from specific backup
./scripts/restore.sh restore control-panel-backup-20240115_020000.tar.gz
```

## Scaling and Performance

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: control-panel-hpa
  namespace: control-panel
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

### Resource Optimization

```bash
# Monitor resource usage
kubectl top pods -n control-panel

# Adjust resource limits in deployment
kubectl edit deployment control-panel -n control-panel
```

## Security Hardening

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: control-panel-netpol
  namespace: control-panel
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
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
  - to: []
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis
    - protocol: TCP
      port: 443   # HTTPS
```

### Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: control-panel
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## Troubleshooting

### Common Issues

#### Pod Not Starting
```bash
# Check pod events
kubectl describe pod -n control-panel -l app.kubernetes.io/name=control-panel

# Check logs
kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel --previous
```

#### Database Connection Issues
```bash
# Test database connectivity
kubectl exec -n control-panel deployment/control-panel -- nc -zv postgres-service 5432

# Check database logs
kubectl logs -n control-panel deployment/postgres
```

#### SSL Certificate Issues
```bash
# Check certificate status
kubectl describe certificate control-panel-tls -n control-panel

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

### Performance Issues

#### High Memory Usage
```bash
# Check memory usage
kubectl top pods -n control-panel

# Increase memory limits
kubectl patch deployment control-panel -n control-panel -p '{"spec":{"template":{"spec":{"containers":[{"name":"control-panel","resources":{"limits":{"memory":"2Gi"}}}]}}}}'
```

#### Slow Response Times
```bash
# Check application metrics
curl https://control.gmac.io/api/metrics

# Check database performance
kubectl exec -n control-panel deployment/postgres -- psql -U control_panel_user -d control_panel -c "SELECT * FROM pg_stat_activity;"
```

## Maintenance

### Updates and Upgrades

```bash
# Update application
kubectl set image deployment/control-panel control-panel=registry.gmac.io/gmac/control-panel:v1.1.0 -n control-panel

# Check rollout status
kubectl rollout status deployment/control-panel -n control-panel

# Rollback if needed
kubectl rollout undo deployment/control-panel -n control-panel
```

### Database Maintenance

```bash
# Create database backup before maintenance
./scripts/backup.sh database-only

# Perform maintenance tasks
kubectl exec -n control-panel deployment/postgres -- psql -U control_panel_user -d control_panel -c "VACUUM ANALYZE;"
```

## Support and Monitoring

### Key Metrics to Monitor
- Application response time
- Error rate
- Database connection pool usage
- Pod resource utilization
- Certificate expiration dates

### Alerting Channels
- Slack notifications for critical alerts
- Email notifications for maintenance windows
- PagerDuty integration for on-call escalation

### Log Aggregation
- Centralized logging with Loki/Grafana
- Application logs in structured JSON format
- Audit logs for security compliance

## Disaster Recovery Plan

### RTO/RPO Objectives
- **Recovery Time Objective (RTO)**: 30 minutes
- **Recovery Point Objective (RPO)**: 1 hour

### Recovery Procedures
1. Assess the extent of the incident
2. Restore from latest backup
3. Verify data integrity
4. Test critical functionality
5. Update DNS if necessary
6. Notify stakeholders

For detailed disaster recovery procedures, see `scripts/restore.sh` and backup documentation.

---

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [cert-manager Documentation](https://cert-manager.io/docs/)

For questions or issues, contact the infrastructure team or create an issue in the repository.