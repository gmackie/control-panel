# Incident Response Runbook - GMAC.IO Control Panel

## Overview

This runbook provides step-by-step procedures for responding to incidents affecting the GMAC.IO Control Panel. It is designed to be used by on-call engineers and support staff during production incidents.

---

## Incident Classification

### P0 - Critical (Service Down)
- **Definition**: Complete service outage, no users can access the application
- **Response Time**: Immediate (< 5 minutes)
- **Escalation**: Automatic to SRE team lead

**Examples**:
- Application completely down (returns 5xx errors)
- Database completely unavailable
- Authentication system failure
- Critical security breach

### P1 - High (Major Degradation)
- **Definition**: Significant functionality impacted, affecting majority of users
- **Response Time**: 15 minutes
- **Escalation**: Within 30 minutes to engineering team

**Examples**:
- High error rate (>5%)
- Severe performance degradation (>2s response times)
- Major feature unavailable
- Authentication issues affecting some users

### P2 - Medium (Partial Impact)
- **Definition**: Limited functionality impacted, affecting some users
- **Response Time**: 1 hour
- **Escalation**: Within 2 hours if not resolved

**Examples**:
- Intermittent errors (1-5% error rate)
- Performance degradation (500ms-2s response times)
- Non-critical feature unavailable
- Integration issues

### P3 - Low (Minor Issues)
- **Definition**: Minor issues, minimal user impact
- **Response Time**: 4 hours
- **Escalation**: Next business day

**Examples**:
- Low error rate (<1%)
- Minor performance issues
- Non-critical alerts
- Documentation issues

---

## Immediate Response Actions

### 1. Acknowledge the Alert (< 5 minutes)

```bash
# Acknowledge in PagerDuty/Slack
# Update status page if P0/P1
curl -X POST https://api.statuspage.io/v1/pages/PAGE_ID/incidents \
  -H "Authorization: OAuth ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "incident": {
      "name": "Control Panel Issue - Investigating",
      "status": "investigating",
      "impact_override": "major"
    }
  }'
```

### 2. Initial Triage (< 10 minutes)

#### Check Application Health
```bash
# Quick health check
curl -I https://control.gmac.io/api/health

# Check if specific endpoints are working
curl -I https://control.gmac.io/api/monitoring/metrics
curl -I https://control.gmac.io/api/cluster/health
```

#### Check Infrastructure
```bash
# Check Kubernetes cluster
kubectl get nodes
kubectl get pods -n control-panel

# Check pod status and recent events
kubectl describe pod -n control-panel -l app.kubernetes.io/name=control-panel
kubectl get events -n control-panel --sort-by=.metadata.creationTimestamp
```

#### Check Monitoring
```bash
# Check Prometheus metrics
curl 'http://prometheus.gmac.io/api/v1/query?query=up{job="control-panel"}'

# Check recent alerts
curl http://alertmanager.gmac.io/api/v1/alerts
```

### 3. Gather Initial Information
- **What**: Brief description of the issue
- **When**: When did the issue start?
- **Who**: Who is affected (all users, specific users, internal only)?
- **Where**: Which components are affected?
- **Impact**: What functionality is impacted?

---

## Common Incident Scenarios

### Scenario 1: Application Down (P0)

#### Symptoms
- Health check endpoint returns 5xx or times out
- Users cannot access the application
- All monitoring metrics show service as down

#### Investigation Steps

1. **Check pod status**
   ```bash
   kubectl get pods -n control-panel
   kubectl describe pod -n control-panel -l app.kubernetes.io/name=control-panel
   ```

2. **Check recent deployments**
   ```bash
   kubectl rollout history deployment/control-panel -n control-panel
   ```

3. **Check application logs**
   ```bash
   kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel --tail=100
   ```

4. **Check resource usage**
   ```bash
   kubectl top pods -n control-panel
   kubectl describe nodes
   ```

#### Resolution Steps

1. **If recent deployment caused issue:**
   ```bash
   kubectl rollout undo deployment/control-panel -n control-panel
   kubectl rollout status deployment/control-panel -n control-panel
   ```

2. **If pods are OOMKilled:**
   ```bash
   # Increase memory limits temporarily
   kubectl patch deployment control-panel -n control-panel -p '{"spec":{"template":{"spec":{"containers":[{"name":"control-panel","resources":{"limits":{"memory":"4Gi"}}}]}}}}'
   ```

3. **If database connection issues:**
   ```bash
   # Check database pod
   kubectl get pods -n control-panel -l app.kubernetes.io/name=postgresql
   kubectl logs -n control-panel -l app.kubernetes.io/name=postgresql --tail=50
   
   # Restart database if needed
   kubectl rollout restart deployment/postgres -n control-panel
   ```

### Scenario 2: High Error Rate (P1)

#### Symptoms
- Error rate >5% in monitoring
- Users reporting intermittent failures
- Some requests succeeding, others failing

#### Investigation Steps

1. **Check error distribution**
   ```bash
   # Query Prometheus for error breakdown
   curl 'http://prometheus.gmac.io/api/v1/query?query=sum(rate(http_requests_total{job="control-panel",status=~"5.."}[5m])) by (status, endpoint)'
   ```

2. **Check application logs for errors**
   ```bash
   kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel | grep ERROR | tail -20
   ```

3. **Check database performance**
   ```bash
   # Check for slow queries
   kubectl exec -n control-panel deployment/postgres -- psql -U control_panel_user -d control_panel -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   ```

#### Resolution Steps

1. **If database slowness:**
   ```bash
   # Kill long-running queries
   kubectl exec -n control-panel deployment/postgres -- psql -U control_panel_user -d control_panel -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"
   ```

2. **If integration issues:**
   ```bash
   # Check integration health
   curl -H "Authorization: Bearer $TOKEN" https://control.gmac.io/api/health/integrations
   
   # Restart application if needed
   kubectl rollout restart deployment/control-panel -n control-panel
   ```

### Scenario 3: Performance Degradation (P2)

#### Symptoms
- Response times >500ms but <2s
- No errors but slow responses
- Users reporting sluggish performance

#### Investigation Steps

1. **Check response time metrics**
   ```bash
   curl 'http://prometheus.gmac.io/api/v1/query?query=histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le))'
   ```

2. **Check system resources**
   ```bash
   kubectl top pods -n control-panel
   kubectl top nodes
   ```

3. **Check database performance**
   ```bash
   # Check connection count
   kubectl exec -n control-panel deployment/postgres -- psql -U control_panel_user -d control_panel -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
   ```

#### Resolution Steps

1. **If high CPU usage:**
   ```bash
   # Scale up replicas
   kubectl scale deployment control-panel --replicas=6 -n control-panel
   ```

2. **If database connection pool exhausted:**
   ```bash
   # Restart application to reset connections
   kubectl rollout restart deployment/control-panel -n control-panel
   ```

### Scenario 4: Integration Failures (P2)

#### Symptoms
- Specific integrations showing as unhealthy
- Features dependent on integrations not working
- Integration-specific errors in logs

#### Investigation Steps

1. **Check integration health**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" https://control.gmac.io/api/health/integrations
   ```

2. **Test external services directly**
   ```bash
   # Test Gitea
   curl -H "Authorization: token $GITEA_TOKEN" https://git.gmac.io/api/v1/version
   
   # Test Drone
   curl -H "Authorization: Bearer $DRONE_TOKEN" https://ci.gmac.io/api/user
   
   # Test Harbor
   curl -u "$HARBOR_USER:$HARBOR_PASS" https://registry.gmac.io/api/v2.0/health
   
   # Test ArgoCD
   curl -H "Authorization: Bearer $ARGOCD_TOKEN" https://argocd.gmac.io/api/v1/version
   ```

3. **Check network connectivity**
   ```bash
   kubectl exec -n control-panel deployment/control-panel -- nslookup git.gmac.io
   kubectl exec -n control-panel deployment/control-panel -- curl -I https://git.gmac.io
   ```

#### Resolution Steps

1. **If network issues:**
   ```bash
   # Check network policies
   kubectl get networkpolicies -n control-panel
   
   # Temporarily disable network policies if needed
   kubectl delete networkpolicy control-panel-netpol -n control-panel
   ```

2. **If authentication issues:**
   ```bash
   # Check and rotate secrets if needed
   kubectl get secrets -n control-panel
   kubectl describe secret control-panel-secrets -n control-panel
   ```

---

## Escalation Procedures

### Level 1: On-Call Engineer
- Initial response and basic troubleshooting
- Follow runbooks for common issues
- Escalate if issue not resolved in:
  - P0: 15 minutes
  - P1: 30 minutes
  - P2: 60 minutes

### Level 2: Senior Engineer/Team Lead
- Advanced troubleshooting
- Coordinate with other teams if needed
- Make decisions about temporary workarounds
- Escalate to Level 3 if needed

### Level 3: Engineering Manager/Architect
- Strategic decisions about service architecture
- Coordinate major incident response
- Interface with business stakeholders
- Post-incident review coordination

### Communication Channels

1. **Immediate**: Slack #incidents channel
2. **Status Updates**: Status page (status.gmac.io)
3. **Internal**: Slack #platform-team
4. **External**: Email to affected users (if needed)
5. **Executive**: Slack #leadership (P0 only)

---

## Communication Templates

### Incident Start
```
🚨 INCIDENT ALERT - P[0/1/2] 🚨

Summary: Brief description of the issue
Impact: Who/what is affected
Status: Investigating/Identified/Monitoring
ETA: Expected resolution time (if known)
Lead: @engineer-name

Updates will be posted every 15 minutes.
```

### Status Update
```
📊 INCIDENT UPDATE - P[0/1/2] 📊

Summary: What we know so far
Actions Taken: What we've tried
Current Status: Investigating/Identified/Monitoring/Resolved
Next Steps: What we're doing next
ETA: Updated expected resolution time

Next update in 15 minutes or when status changes.
```

### Resolution
```
✅ INCIDENT RESOLVED - P[0/1/2] ✅

Summary: Final description of what happened
Root Cause: Brief explanation of the cause
Resolution: How it was fixed
Duration: Total incident duration
Impact: Final assessment of user impact

Post-mortem will be scheduled within 24 hours.
```

---

## Post-Incident Actions

### Immediate (Within 1 hour)
- [ ] Update status page with resolution
- [ ] Send final communication to stakeholders
- [ ] Document timeline of events
- [ ] Schedule post-mortem meeting

### Within 24 hours
- [ ] Conduct post-mortem meeting
- [ ] Document lessons learned
- [ ] Create action items for improvements
- [ ] Update runbooks based on learnings

### Within 1 week
- [ ] Implement immediate fixes
- [ ] Update monitoring/alerting if needed
- [ ] Share learnings with broader team
- [ ] Update incident response procedures

---

## Tools and Resources

### Monitoring and Observability
- **Grafana**: https://grafana.gmac.io
- **Prometheus**: https://prometheus.gmac.io
- **AlertManager**: https://alertmanager.gmac.io
- **Logs**: `kubectl logs -n control-panel`

### Application Management
- **Control Panel**: https://control.gmac.io
- **Kubernetes Dashboard**: https://dashboard.gmac.io
- **ArgoCD**: https://argocd.gmac.io

### Communication
- **Status Page**: https://status.gmac.io
- **Slack**: #incidents, #platform-team
- **PagerDuty**: https://gmac.pagerduty.com

### Documentation
- **Runbooks**: /runbooks directory
- **API Docs**: https://docs.gmac.io/api
- **Architecture**: /docs/architecture.md

---

## Contact Information

### On-Call Rotation
- **Primary**: Check PagerDuty schedule
- **Secondary**: Check PagerDuty schedule
- **Escalation**: Engineering Manager

### Key Personnel
- **SRE Lead**: @sre-lead
- **Platform Team Lead**: @platform-lead
- **Engineering Manager**: @eng-manager
- **Security Team**: @security-team

### External Contacts
- **Cloud Provider Support**: Available in emergency runbook
- **DNS Provider**: Available in emergency runbook
- **Certificate Authority**: Available in emergency runbook

---

## Quick Reference Commands

```bash
# Check overall health
kubectl get pods -n control-panel
curl https://control.gmac.io/api/health

# Check recent deployments
kubectl rollout history deployment/control-panel -n control-panel

# Check logs
kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel --tail=100

# Rollback deployment
kubectl rollout undo deployment/control-panel -n control-panel

# Scale application
kubectl scale deployment control-panel --replicas=6 -n control-panel

# Restart application
kubectl rollout restart deployment/control-panel -n control-panel

# Check database
kubectl exec -n control-panel deployment/postgres -- psql -U control_panel_user -d control_panel -c "SELECT version();"

# Check integrations
curl -H "Authorization: Bearer $TOKEN" https://control.gmac.io/api/health/integrations
```

---

*This runbook should be reviewed and updated regularly based on incident learnings and system changes.*