# Disaster Recovery Procedures - GMAC.IO Control Panel

## Overview

This document outlines comprehensive disaster recovery procedures for the GMAC.IO Control Panel. It provides step-by-step instructions for recovering from various disaster scenarios while meeting our Recovery Time Objective (RTO) of 30 minutes and Recovery Point Objective (RPO) of 1 hour.

---

## Disaster Recovery Objectives

### RTO/RPO Targets
- **Recovery Time Objective (RTO)**: 30 minutes
- **Recovery Point Objective (RPO)**: 1 hour
- **Availability Target**: 99.9% uptime
- **Data Loss Tolerance**: Maximum 1 hour of data

### Service Level Agreements
- **Critical Services**: Restore within 15 minutes
- **Important Services**: Restore within 30 minutes  
- **Supporting Services**: Restore within 60 minutes

---

## Disaster Scenarios

### Scenario 1: Complete Kubernetes Cluster Failure (P0)

#### Definition
- Entire Kubernetes cluster is unrecoverable
- All nodes are down or corrupted
- Control plane is not accessible

#### Detection
- All monitoring alerts firing
- kubectl commands fail to connect
- Application completely inaccessible
- Health checks failing across all endpoints

#### Recovery Procedure

**Phase 1: Assessment (0-5 minutes)**
```bash
# Verify cluster state
kubectl cluster-info
kubectl get nodes

# Check cloud provider status
curl -s https://status.hetzner.com/

# Verify DNS resolution
nslookup control.gmac.io
```

**Phase 2: Emergency Response (5-10 minutes)**
```bash
# Activate incident response
curl -X POST https://api.statuspage.io/v1/pages/PAGE_ID/incidents \
  -H "Authorization: OAuth ACCESS_TOKEN" \
  -d '{"incident":{"name":"Complete Service Outage","status":"investigating","impact_override":"critical"}}'

# Notify stakeholders
slack-notify "#incidents" "🚨 DISASTER: Complete cluster failure detected. DR procedures activated."

# Initiate new cluster provisioning
terraform init
terraform plan -var="environment=disaster-recovery"
terraform apply -auto-approve
```

**Phase 3: Cluster Recreation (10-20 minutes)**
```bash
# Create new Kubernetes cluster
cd infrastructure/terraform
terraform apply -var="cluster_name=gmac-dr" -var="node_count=3"

# Configure kubectl for new cluster
kubectl config set-cluster gmac-dr --server=https://NEW_CLUSTER_ENDPOINT
kubectl config set-context gmac-dr --cluster=gmac-dr
kubectl config use-context gmac-dr

# Install essential components
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace

helm repo add cert-manager https://charts.jetstack.io
helm install cert-manager cert-manager/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true
```

**Phase 4: Data Restoration (15-25 minutes)**
```bash
# Restore from latest backup
LATEST_BACKUP=$(aws s3 ls s3://gmac-control-panel-backups/control-panel/ | sort | tail -n 1 | awk '{print $4}')
aws s3 cp "s3://gmac-control-panel-backups/control-panel/${LATEST_BACKUP}" /tmp/

# Extract and restore
cd /tmp
tar -xzf "${LATEST_BACKUP}"
./scripts/restore.sh restore "/tmp/$(basename ${LATEST_BACKUP} .tar.gz)"
```

**Phase 5: Application Deployment (20-30 minutes)**
```bash
# Deploy application stack
cd control-panel
./production/deploy-production.sh --env disaster-recovery --no-backup

# Update DNS to point to new cluster
aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID --change-batch '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "control.gmac.io",
      "Type": "A",
      "TTL": 60,
      "ResourceRecords": [{"Value": "NEW_LOADBALANCER_IP"}]
    }
  }]
}'
```

**Phase 6: Verification (25-30 minutes)**
```bash
# Test application functionality
curl -f https://control.gmac.io/api/health
curl -f https://control.gmac.io/api/monitoring/metrics -H "Authorization: Bearer $TEST_TOKEN"

# Verify database connectivity
kubectl exec -n control-panel deployment/control-panel -- npm run db:status

# Run smoke tests
npx playwright test tests/e2e/smoke.spec.ts
```

### Scenario 2: Database Corruption/Loss (P0)

#### Definition
- PostgreSQL database is corrupted or lost
- Data integrity compromised
- Application cannot connect to database

#### Recovery Procedure

**Phase 1: Assessment (0-2 minutes)**
```bash
# Check database status
kubectl get pods -n control-panel -l app.kubernetes.io/name=postgresql
kubectl logs -n control-panel -l app.kubernetes.io/name=postgresql --tail=50

# Test database connectivity
kubectl exec -n control-panel deployment/control-panel -- nc -zv postgres-service 5432
```

**Phase 2: Stop Application (2-5 minutes)**
```bash
# Scale down application to prevent further writes
kubectl scale deployment control-panel --replicas=0 -n control-panel

# Wait for pods to terminate
kubectl wait --for=delete pod -l app.kubernetes.io/name=control-panel -n control-panel --timeout=300s
```

**Phase 3: Database Recovery (5-20 minutes)**
```bash
# Identify latest database backup
LATEST_DB_BACKUP=$(aws s3 ls s3://gmac-control-panel-backups/database/ | sort | tail -n 1 | awk '{print $4}')

# Download backup
aws s3 cp "s3://gmac-control-panel-backups/database/${LATEST_DB_BACKUP}" /tmp/

# Stop existing database
kubectl scale deployment postgres --replicas=0 -n control-panel

# Delete existing PVC (WARNING: This destroys existing data)
kubectl delete pvc postgres-storage -n control-panel

# Recreate database deployment
kubectl apply -f k8s/03-postgres.yaml

# Wait for new database to be ready
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=postgresql -n control-panel --timeout=300s

# Restore from backup
gunzip -c /tmp/${LATEST_DB_BACKUP} | kubectl exec -i -n control-panel deployment/postgres -- \
  psql -U control_panel_user -d control_panel
```

**Phase 4: Application Recovery (20-25 minutes)**
```bash
# Scale application back up
kubectl scale deployment control-panel --replicas=3 -n control-panel

# Wait for application to be ready
kubectl wait --for=condition=Available deployment/control-panel -n control-panel --timeout=300s

# Verify database connectivity
kubectl exec -n control-panel deployment/control-panel -- npm run db:status
```

### Scenario 3: Data Center/Region Failure (P0)

#### Definition
- Entire data center or cloud region is unavailable
- All infrastructure in primary region is inaccessible
- Need to failover to secondary region

#### Recovery Procedure

**Phase 1: Activate Secondary Region (0-5 minutes)**
```bash
# Switch to secondary region configuration
export AWS_DEFAULT_REGION=eu-west-1  # Secondary region
kubectl config use-context gmac-secondary

# Verify secondary infrastructure
kubectl get nodes
aws ec2 describe-instances --filters "Name=tag:Environment,Values=production-secondary"
```

**Phase 2: DNS Failover (5-10 minutes)**
```bash
# Update DNS to point to secondary region
aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID --change-batch '{
  "Changes": [{
    "Action": "UPSERT", 
    "ResourceRecordSet": {
      "Name": "control.gmac.io",
      "Type": "A",
      "TTL": 60,
      "ResourceRecords": [{"Value": "SECONDARY_LOADBALANCER_IP"}]
    }
  }]
}'

# Verify DNS propagation
dig control.gmac.io @8.8.8.8
```

**Phase 3: Data Synchronization (10-20 minutes)**
```bash
# Check data replication status
kubectl exec -n control-panel deployment/postgres-replica -- \
  psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# Promote replica to primary if needed
kubectl exec -n control-panel deployment/postgres-replica -- \
  pg_promote

# Update application configuration to use new primary
kubectl patch deployment control-panel -n control-panel -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "control-panel",
          "env": [{"name": "DATABASE_URL", "value": "postgres://user:pass@postgres-replica:5432/control_panel"}]
        }]
      }
    }
  }
}'
```

### Scenario 4: Application Code/Configuration Corruption (P1)

#### Definition
- Application deployment is corrupted
- Bad configuration deployed
- Application running but with severe issues

#### Recovery Procedure

**Phase 1: Immediate Rollback (0-5 minutes)**
```bash
# Check deployment history
kubectl rollout history deployment/control-panel -n control-panel

# Rollback to previous version
kubectl rollout undo deployment/control-panel -n control-panel

# Monitor rollback status
kubectl rollout status deployment/control-panel -n control-panel --timeout=300s
```

**Phase 2: Configuration Recovery (5-15 minutes)**
```bash
# Restore configuration from backup
LATEST_CONFIG_BACKUP=$(aws s3 ls s3://gmac-control-panel-backups/config/ | sort | tail -n 1 | awk '{print $4}')
aws s3 cp "s3://gmac-control-panel-backups/config/${LATEST_CONFIG_BACKUP}" /tmp/

# Apply backed up configuration
kubectl apply -f /tmp/config-backup/

# Restart application to pick up configuration
kubectl rollout restart deployment/control-panel -n control-panel
```

### Scenario 5: Security Breach/Compromise (P0)

#### Definition
- Security breach detected
- System potentially compromised
- Need to isolate and recover securely

#### Recovery Procedure

**Phase 1: Immediate Isolation (0-2 minutes)**
```bash
# Block all external traffic
kubectl patch service control-panel-service -n control-panel -p '{
  "spec": {
    "type": "ClusterIP"
  }
}'

# Update status page
curl -X POST https://api.statuspage.io/v1/pages/PAGE_ID/incidents \
  -H "Authorization: OAuth ACCESS_TOKEN" \
  -d '{"incident":{"name":"Security Maintenance","status":"investigating","impact_override":"major"}}'
```

**Phase 2: Assessment and Forensics (2-10 minutes)**
```bash
# Capture current state for forensics
kubectl get all -n control-panel -o yaml > /tmp/breach-forensics-$(date +%s).yaml

# Check for indicators of compromise
kubectl logs -n control-panel --previous -l app.kubernetes.io/name=control-panel | grep -E "(failed|error|unauthorized|admin)"

# Export pod filesystem for analysis
kubectl cp control-panel/$(kubectl get pods -n control-panel -l app.kubernetes.io/name=control-panel -o name | head -1 | cut -d'/' -f2):/app /tmp/app-forensics
```

**Phase 3: Clean Recovery (10-30 minutes)**
```bash
# Deploy to isolated environment for testing
kubectl create namespace control-panel-secure
kubectl apply -f k8s/ -n control-panel-secure

# Update all secrets and credentials
kubectl delete secret control-panel-secrets -n control-panel-secure
kubectl create secret generic control-panel-secrets -n control-panel-secure \
  --from-literal=database-password="$(openssl rand -base64 32)" \
  --from-literal=nextauth-secret="$(openssl rand -base64 32)"

# Deploy with new credentials
kubectl rollout restart deployment/control-panel -n control-panel-secure

# Security verification
./security/security-scan.sh -u https://control-secure.gmac.io

# Switch traffic to secure instance
kubectl patch service control-panel-service -n control-panel-secure -p '{
  "spec": {
    "type": "LoadBalancer"
  }
}'
```

---

## Automated Recovery Scripts

### Master Recovery Script
```bash
#!/bin/bash
# dr-master.sh - Master disaster recovery script

DISASTER_TYPE="$1"
SEVERITY="$2"

case "$DISASTER_TYPE" in
  "cluster-failure")
    ./dr-scripts/cluster-recovery.sh "$SEVERITY"
    ;;
  "database-loss")
    ./dr-scripts/database-recovery.sh "$SEVERITY"
    ;;
  "region-failure")
    ./dr-scripts/region-failover.sh "$SEVERITY"
    ;;
  "security-breach")
    ./dr-scripts/security-recovery.sh "$SEVERITY"
    ;;
  *)
    echo "Unknown disaster type: $DISASTER_TYPE"
    echo "Available types: cluster-failure, database-loss, region-failure, security-breach"
    exit 1
    ;;
esac
```

### Health Check Validation
```bash
#!/bin/bash
# dr-validate.sh - Post-recovery validation

echo "🔍 Starting post-recovery validation..."

# Test basic connectivity
if curl -f https://control.gmac.io/api/health > /dev/null 2>&1; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  exit 1
fi

# Test authentication
if curl -f https://control.gmac.io/api/auth/verify -H "Authorization: Bearer $TEST_TOKEN" > /dev/null 2>&1; then
  echo "✅ Authentication working"
else
  echo "❌ Authentication failed"
  exit 1
fi

# Test database connectivity
if kubectl exec -n control-panel deployment/control-panel -- npm run db:status > /dev/null 2>&1; then
  echo "✅ Database connectivity confirmed"
else
  echo "❌ Database connectivity failed"
  exit 1
fi

# Test integrations
for service in gitea drone harbor argocd; do
  if curl -f "https://control.gmac.io/api/health/integrations" -H "Authorization: Bearer $TEST_TOKEN" | jq -e ".${service}.status == \"healthy\"" > /dev/null 2>&1; then
    echo "✅ $service integration healthy"
  else
    echo "⚠️ $service integration unhealthy"
  fi
done

echo "✅ Recovery validation completed"
```

---

## Recovery Testing

### Scheduled DR Tests

**Monthly Full DR Test**
```bash
# First Saturday of each month at 2 AM
0 2 1-7 * 6 [ $(date +\%u) -eq 6 ] && /opt/control-panel/dr-scripts/full-dr-test.sh

# Quarterly Regional Failover Test  
0 3 1 1,4,7,10 * /opt/control-panel/dr-scripts/regional-failover-test.sh

# Weekly Database Recovery Test
0 4 * * 0 /opt/control-panel/dr-scripts/database-recovery-test.sh
```

**DR Test Procedures**
1. **Notification**: Notify team 48 hours before DR test
2. **Backup**: Create full backup before test
3. **Execution**: Run DR procedures in isolated environment
4. **Validation**: Verify all components work correctly
5. **Documentation**: Update procedures based on findings
6. **Rollback**: Return to normal operations

### Test Metrics
- **RTO Achievement**: Measure actual recovery time vs target
- **RPO Achievement**: Measure data loss vs target
- **Success Rate**: Percentage of successful recoveries
- **Component Recovery**: Individual component recovery times

---

## Communication Plans

### Internal Communication

**Incident Commander Checklist**
- [ ] Assess severity and activate appropriate response level
- [ ] Notify stakeholders via established channels
- [ ] Coordinate technical response teams
- [ ] Provide regular status updates
- [ ] Manage external communications
- [ ] Conduct post-incident review

**Communication Channels**
- **Immediate**: Slack #incidents
- **Status**: status.gmac.io
- **Email**: platform-team@gmac.io
- **Executive**: Slack #leadership (P0 only)

### External Communication

**Customer Notification Templates**

**Initial Notification**
```
Subject: Service Disruption - GMAC.IO Control Panel

We are currently experiencing a service disruption with the GMAC.IO Control Panel. 
Our engineering team is actively working to resolve the issue.

Estimated Resolution: [TIME]
Next Update: [TIME]

We apologize for any inconvenience and will provide updates as we learn more.

Status Page: https://status.gmac.io
```

**Resolution Notification**
```
Subject: Service Restored - GMAC.IO Control Panel

The service disruption with GMAC.IO Control Panel has been resolved. 
All systems are now operating normally.

Incident Duration: [DURATION]
Root Cause: [BRIEF DESCRIPTION]

A detailed post-mortem will be published within 48 hours.

Thank you for your patience.
```

---

## Post-Recovery Actions

### Immediate (0-4 hours)
- [ ] Validate all systems are operational
- [ ] Monitor error rates and performance
- [ ] Update status page with resolution
- [ ] Notify stakeholders of recovery
- [ ] Begin incident documentation

### Short-term (4-24 hours)  
- [ ] Conduct hot wash meeting
- [ ] Document timeline of events
- [ ] Identify immediate improvements
- [ ] Update monitoring and alerting
- [ ] Schedule formal post-mortem

### Long-term (1-7 days)
- [ ] Conduct post-mortem meeting
- [ ] Create action items for improvements
- [ ] Update DR procedures based on learnings
- [ ] Test fixes and improvements
- [ ] Share learnings with broader organization

### Continuous Improvement
- [ ] Regular DR procedure reviews
- [ ] Update based on architecture changes
- [ ] Incorporate new tools and techniques
- [ ] Train new team members
- [ ] Benchmark against industry standards

---

## Contact Information

### Emergency Contacts
- **Primary On-Call**: Check PagerDuty rotation
- **Secondary On-Call**: Check PagerDuty rotation  
- **Incident Commander**: Platform Team Lead
- **Executive Escalation**: VP Engineering

### External Vendors
- **Cloud Provider**: Hetzner Cloud Support (+49 911 14000500)
- **DNS Provider**: Cloudflare Support
- **Monitoring**: Datadog Support
- **Security**: CrowdStrike Support

### Key Resources
- **Status Page**: https://status.gmac.io
- **Monitoring**: https://grafana.gmac.io
- **Documentation**: /docs directory
- **Runbooks**: /runbooks directory

---

## Appendices

### Appendix A: Emergency Access Credentials
*Stored in secure password manager - see incident commander*

### Appendix B: Network Diagrams
*Current architecture diagrams - see /docs/architecture/*

### Appendix C: Vendor Escalation Procedures
*Detailed vendor contact procedures - see /docs/vendor-escalation/*

### Appendix D: Compliance Requirements
*Regulatory and compliance considerations - see /docs/compliance/*

---

*This document should be reviewed monthly and updated after each major incident or infrastructure change.*