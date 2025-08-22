# Troubleshooting Playbook - GMAC.IO Control Panel

## Overview

This playbook provides systematic troubleshooting procedures for common issues with the GMAC.IO Control Panel. It's designed to help support teams quickly diagnose and resolve problems.

---

## General Troubleshooting Approach

### 1. Information Gathering
- **User Information**: Name, email, organization, role
- **Issue Description**: What is the user trying to do? What error are they seeing?
- **Timeline**: When did the issue start? Is it intermittent or constant?
- **Environment**: Browser, device, network environment
- **Reproduction**: Can the issue be reproduced? Steps to reproduce?

### 2. Initial Diagnosis
- Check system status and monitoring dashboards
- Look for related alerts or incidents
- Review recent changes or deployments
- Check for patterns in similar reports

### 3. Systematic Investigation
- Start with the most likely causes
- Use monitoring tools and logs to validate hypotheses
- Test potential solutions in order of risk/impact
- Document findings and actions taken

### 4. Resolution and Follow-up
- Implement the fix and verify it works
- Monitor for recurrence
- Update documentation and knowledge base
- Communicate resolution to user

---

## Issue Categories and Playbooks

## Authentication and Access Issues

### Cannot Login - Invalid Credentials

**Common Causes:**
- User entering incorrect password
- Account locked or suspended
- OAuth provider issues
- Session/cookie problems

**Investigation Steps:**

1. **Check User Account Status**
   ```bash
   # Look for auth failures in logs
   kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel | grep -i "auth.*fail"
   
   # Check recent authentication attempts
   kubectl exec -n control-panel deployment/control-panel -- \
     psql -h postgres-service -U control_panel_user -d control_panel \
     -c "SELECT * FROM auth_logs WHERE user_email = 'user@example.com' ORDER BY created_at DESC LIMIT 10;"
   ```

2. **Verify OAuth Provider**
   ```bash
   # Test GitHub OAuth endpoint
   curl -I https://github.com/login/oauth/authorize
   
   # Check OAuth application settings
   curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/applications/$CLIENT_ID
   ```

3. **Check System Status**
   ```bash
   # Check authentication service health
   curl https://control.gmac.io/api/auth/verify
   
   # Check authentication metrics
   curl 'http://prometheus:9090/api/v1/query?query=control_panel_auth_attempts_total'
   ```

**Resolution Steps:**
- **If OAuth provider issue**: Update status page, wait for provider recovery
- **If user account issue**: Reset user account or unlock as needed
- **If system issue**: Restart authentication service or check database connectivity

### Session Expires Too Quickly

**Common Causes:**
- Short session timeout configuration
- Load balancer session affinity issues
- Browser cookie settings
- System time synchronization issues

**Investigation Steps:**

1. **Check Session Configuration**
   ```bash
   # Check current session timeout settings
   kubectl exec -n control-panel deployment/control-panel -- \
     env | grep -i session
   
   # Check JWT token settings
   kubectl get secret control-panel-secrets -o yaml | base64 -d
   ```

2. **Verify Load Balancer Settings**
   ```bash
   kubectl get service control-panel-service -o yaml
   kubectl describe ingress control-panel-ingress
   ```

**Resolution:**
- Adjust session timeout settings if too short
- Configure session affinity on load balancer
- Advise user to check browser cookie settings

### Permission Denied Errors

**Common Causes:**
- User doesn't have required permissions
- Role assignment issues
- Organization access problems
- API token expired

**Investigation Steps:**

1. **Check User Permissions**
   ```bash
   kubectl exec -n control-panel deployment/control-panel -- \
     psql -h postgres-service -U control_panel_user -d control_panel \
     -c "SELECT u.email, r.name, p.name FROM users u 
         JOIN user_roles ur ON u.id = ur.user_id 
         JOIN roles r ON ur.role_id = r.id 
         JOIN role_permissions rp ON r.id = rp.role_id 
         JOIN permissions p ON rp.permission_id = p.id 
         WHERE u.email = 'user@example.com';"
   ```

2. **Verify Organization Access**
   ```bash
   # Check user organization membership
   kubectl exec -n control-panel deployment/control-panel -- \
     psql -h postgres-service -U control_panel_user -d control_panel \
     -c "SELECT * FROM organization_members WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com');"
   ```

**Resolution:**
- Grant appropriate permissions to user
- Add user to correct organization
- Refresh API tokens if expired

## Performance Issues

### Slow Page Loading

**Common Causes:**
- High server load
- Database performance issues
- Network latency
- Large dataset queries
- Client-side performance issues

**Investigation Steps:**

1. **Check Server Resources**
   ```bash
   # Check pod resource usage
   kubectl top pods -n control-panel
   
   # Check node resources
   kubectl top nodes
   
   # Check for resource constraints
   kubectl describe pod -n control-panel -l app.kubernetes.io/name=control-panel
   ```

2. **Database Performance**
   ```bash
   # Check slow queries
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel \
     -c "SELECT query, mean_time, calls, total_time FROM pg_stat_statements 
         WHERE mean_time > 100 ORDER BY mean_time DESC LIMIT 10;"
   
   # Check database connections
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel \
     -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
   ```

3. **Network Performance**
   ```bash
   # Test network latency
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -w "Total time: %{time_total}s\n" -o /dev/null -s https://control.gmac.io/api/health
   
   # Check DNS resolution
   kubectl exec -n control-panel deployment/control-panel -- \
     nslookup control.gmac.io
   ```

**Resolution Steps:**
- Scale application pods if high resource usage
- Optimize slow database queries
- Enable caching for frequently accessed data
- Implement pagination for large datasets

### API Timeouts

**Common Causes:**
- Long-running database queries
- External API calls timing out
- Resource exhaustion
- Network connectivity issues

**Investigation Steps:**

1. **Check API Performance Metrics**
   ```bash
   # Check API response times
   curl 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le, endpoint))'
   
   # Check error rates
   curl 'http://prometheus:9090/api/v1/query?query=sum(rate(http_requests_total{job="control-panel",status=~"5.."}[5m])) by (endpoint)'
   ```

2. **Identify Slow Endpoints**
   ```bash
   # Check application logs for slow requests
   kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel | \
     grep -E "(slow|timeout|exceeded)" | tail -20
   ```

3. **Check External Dependencies**
   ```bash
   # Test external service connectivity
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -m 10 https://git.gmac.io/api/v1/version
   ```

**Resolution:**
- Increase timeout values if requests are legitimately slow
- Optimize slow queries or operations
- Implement circuit breakers for external dependencies
- Add retry logic with exponential backoff

### High Memory Usage

**Common Causes:**
- Memory leaks in application code
- Large data processing operations
- Insufficient garbage collection
- Resource limit configuration issues

**Investigation Steps:**

1. **Check Memory Metrics**
   ```bash
   # Check current memory usage
   kubectl exec -n control-panel deployment/control-panel -- \
     cat /proc/meminfo
   
   # Check application memory metrics
   curl 'http://prometheus:9090/api/v1/query?query=container_memory_usage_bytes{container="control-panel"}'
   ```

2. **Analyze Memory Patterns**
   ```bash
   # Check for OOMKilled pods
   kubectl get events -n control-panel | grep OOMKilled
   
   # Check pod restart history
   kubectl get pods -n control-panel -l app.kubernetes.io/name=control-panel
   ```

**Resolution:**
- Increase memory limits temporarily
- Profile application for memory leaks
- Optimize data processing to use less memory
- Implement memory cleanup procedures

## Integration Issues

### Gitea Integration Failure

**Common Causes:**
- Gitea service unavailable
- Authentication token expired
- Network connectivity issues
- API rate limiting

**Investigation Steps:**

1. **Test Gitea Connectivity**
   ```bash
   # Test basic connectivity
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -I https://git.gmac.io
   
   # Test API access
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -H "Authorization: token $GITEA_TOKEN" https://git.gmac.io/api/v1/user
   ```

2. **Check Authentication**
   ```bash
   # Verify token validity
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -H "Authorization: token $GITEA_TOKEN" https://git.gmac.io/api/v1/user/tokens
   ```

3. **Review Integration Logs**
   ```bash
   kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel | \
     grep -i gitea | tail -20
   ```

**Resolution:**
- Renew authentication tokens if expired
- Check Gitea service status and escalate if down
- Verify network policies and firewall rules
- Implement retry logic for transient failures

### Drone CI Integration Issues

**Common Causes:**
- Drone service unavailable
- Webhook delivery failures
- Build configuration errors
- Resource limitations in build environment

**Investigation Steps:**

1. **Check Drone Service Status**
   ```bash
   # Test Drone API
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -H "Authorization: Bearer $DRONE_TOKEN" https://ci.gmac.io/api/user
   
   # Check recent builds
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -H "Authorization: Bearer $DRONE_TOKEN" https://ci.gmac.io/api/repos/owner/repo/builds
   ```

2. **Verify Webhook Configuration**
   ```bash
   # Check webhook endpoints
   kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel | \
     grep -i webhook | tail -10
   ```

**Resolution:**
- Verify webhook URLs and secrets
- Check Drone runner capacity and resources
- Review build configuration files
- Test webhook delivery manually

### Harbor Registry Problems

**Common Causes:**
- Registry service unavailable  
- Authentication issues
- Storage quota exceeded
- Network connectivity problems

**Investigation Steps:**

1. **Test Registry Access**
   ```bash
   # Test registry connectivity
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -u "$HARBOR_USER:$HARBOR_PASS" https://registry.gmac.io/api/v2.0/health
   
   # Check available storage
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -u "$HARBOR_USER:$HARBOR_PASS" https://registry.gmac.io/api/v2.0/systeminfo
   ```

2. **Verify Credentials**
   ```bash
   # Test authentication
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -u "$HARBOR_USER:$HARBOR_PASS" https://registry.gmac.io/api/v2.0/users/current
   ```

**Resolution:**
- Check Harbor service status
- Verify and renew authentication credentials
- Clean up old images if storage quota exceeded
- Check network connectivity and policies

## Database Issues

### Connection Pool Exhausted

**Common Causes:**
- High concurrent user activity
- Long-running transactions not being closed
- Application not properly releasing connections
- Connection pool configuration too small

**Investigation Steps:**

1. **Check Connection Status**
   ```bash
   # Check active connections
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel \
     -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
   
   # Check connection pool settings
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel \
     -c "SHOW max_connections;"
   ```

2. **Identify Long-Running Queries**
   ```bash
   # Find long-running transactions
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel \
     -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
         FROM pg_stat_activity 
         WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"
   ```

**Resolution:**
- Kill long-running queries if safe to do so
- Increase connection pool size temporarily
- Review application code for connection leaks
- Implement connection timeout settings

### Slow Query Performance

**Common Causes:**
- Missing database indexes
- Large table scans
- Inefficient query structure
- Database statistics out of date

**Investigation Steps:**

1. **Identify Slow Queries**
   ```bash
   # Check query statistics
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel \
     -c "SELECT query, mean_time, calls, total_time 
         FROM pg_stat_statements 
         WHERE mean_time > 100 
         ORDER BY mean_time DESC LIMIT 10;"
   ```

2. **Analyze Query Plans**
   ```bash
   # Example query analysis
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel \
     -c "EXPLAIN ANALYZE SELECT * FROM applications WHERE user_id = 123;"
   ```

**Resolution:**
- Add appropriate indexes for slow queries
- Update database statistics: `ANALYZE;`
- Rewrite inefficient queries
- Consider query result caching

## System-Wide Issues

### Complete Service Outage

**Common Causes:**
- Kubernetes cluster issues
- Database complete failure
- Network infrastructure problems
- Load balancer failure

**Investigation Steps:**

1. **Check Overall System Status**
   ```bash
   # Check all pods
   kubectl get pods -n control-panel
   
   # Check nodes
   kubectl get nodes
   
   # Check services
   kubectl get services -n control-panel
   ```

2. **Test External Access**
   ```bash
   # Test from external network
   curl -I https://control.gmac.io/api/health
   
   # Check DNS resolution
   nslookup control.gmac.io
   ```

3. **Check Infrastructure**
   ```bash
   # Check ingress controller
   kubectl get pods -n ingress-nginx
   
   # Check load balancer
   kubectl get ingress -n control-panel
   ```

**Resolution:**
- Follow disaster recovery procedures if complete cluster failure
- Restart failed components in order of dependency
- Check cloud provider status for infrastructure issues
- Escalate to infrastructure team immediately

### Partial Service Degradation

**Common Causes:**
- Some pods failing or restarting
- Resource constraints
- Partial network issues
- Database performance degradation

**Investigation Steps:**

1. **Check Pod Health**
   ```bash
   # Check pod status
   kubectl get pods -n control-panel -o wide
   
   # Check recent events
   kubectl get events -n control-panel --sort-by='.lastTimestamp'
   ```

2. **Check Resource Usage**
   ```bash
   # Check resource constraints
   kubectl describe nodes
   kubectl top pods -n control-panel
   ```

**Resolution:**
- Scale up healthy pods while investigating failures
- Address resource constraints
- Restart failing pods if necessary
- Monitor for improvement and full recovery

---

## Escalation Criteria

### Immediate Escalation (Tier 1 → Tier 2)
- Any P0 or P1 issues
- Issues affecting multiple users
- Security-related concerns
- Issues requiring system-level access

### Engineering Escalation (Tier 2 → Tier 3)
- Suspected bugs requiring code changes
- Issues that cannot be resolved with configuration changes
- Performance issues requiring architecture review
- Integration issues requiring vendor coordination

### Leadership Escalation (Tier 3 → Management)
- Issues affecting all users for >1 hour
- Security breaches or data incidents
- Issues requiring external vendor engagement
- Problems requiring business decision

---

## Documentation and Follow-up

### Issue Resolution Documentation
1. **Update support ticket with**:
   - Root cause analysis
   - Steps taken to resolve
   - Any changes made to system
   - Prevention measures implemented

2. **Knowledge base update**:
   - Add new troubleshooting steps
   - Update existing procedures
   - Create new FAQ entries if needed

3. **System improvements**:
   - Identify monitoring gaps
   - Suggest preventive measures
   - Report systemic issues to development team

### Post-Resolution Monitoring
- Monitor affected systems for 24 hours after resolution
- Set up temporary alerts if needed
- Schedule follow-up with customer if appropriate
- Conduct post-incident review for P0/P1 issues

---

*This troubleshooting playbook is updated monthly based on new issues and resolutions. Last updated: March 2024*