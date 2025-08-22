# GMAC.IO Control Panel - Support Guide

## Overview

This document provides comprehensive support information for the GMAC.IO Control Panel, including troubleshooting procedures, common issues, escalation paths, and maintenance procedures.

---

## Support Structure

### Tier 1 Support (First-line Support)
**Responsibilities:**
- Initial user inquiries and basic troubleshooting
- Account-related issues (login, password resets)
- Basic functionality questions
- Collect information for escalation

**Response Times:**
- Email: 4 hours during business hours
- Chat: Immediate during business hours
- Phone: Not available (redirect to email/chat)

### Tier 2 Support (Technical Support)
**Responsibilities:**
- Technical issues requiring system knowledge
- Integration problems
- Performance issues
- Configuration assistance
- Bug verification and initial diagnosis

**Response Times:**
- P1 Issues: 1 hour
- P2 Issues: 4 hours
- P3 Issues: 24 hours

### Tier 3 Support (Engineering Escalation)
**Responsibilities:**
- Complex technical issues
- System bugs requiring code changes
- Architecture-related problems
- Security incidents

**Response Times:**
- P0 Issues: Immediate
- P1 Issues: 2 hours
- P2 Issues: 8 hours

---

## Common Issues and Solutions

### Authentication Issues

#### Issue: Users Cannot Log In
**Symptoms:**
- Login page shows "Invalid credentials" error
- Users report being unable to access the system
- Authentication endpoint returning 401 errors

**Troubleshooting Steps:**
1. **Check Authentication Service Status**
   ```bash
   kubectl get pods -n control-panel -l app.kubernetes.io/name=control-panel
   kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel | grep -i auth
   ```

2. **Verify OAuth Provider Status**
   ```bash
   curl -I https://github.com/login/oauth/authorize
   ```

3. **Check Authentication Metrics**
   ```bash
   curl 'http://prometheus:9090/api/v1/query?query=control_panel_auth_attempts_total'
   ```

**Resolution:**
- If OAuth provider is down: Update status page and wait for provider recovery
- If authentication service is down: Restart the application
- If database connectivity issues: Check database status and connections

#### Issue: Session Expiration Problems
**Symptoms:**
- Users getting logged out unexpectedly
- Session timeout errors
- Intermittent authentication failures

**Resolution:**
1. Check session configuration in application settings
2. Verify JWT token expiration settings
3. Review load balancer session affinity settings

### Performance Issues

#### Issue: Slow Page Load Times
**Symptoms:**
- Pages taking >5 seconds to load
- Users complaining about slow response times
- High response time metrics in monitoring

**Troubleshooting Steps:**
1. **Check System Resources**
   ```bash
   kubectl top pods -n control-panel
   kubectl top nodes
   ```

2. **Check Database Performance**
   ```bash
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel -c \
     "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   ```

3. **Check Network Latency**
   ```bash
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -w "@curl-format.txt" -o /dev/null -s https://control.gmac.io/api/health
   ```

**Resolution:**
- Scale up application replicas if CPU/memory usage is high
- Optimize slow database queries
- Enable response caching for static content
- Review and optimize application code

#### Issue: High Memory Usage
**Symptoms:**
- Pods being OOMKilled
- Application crashes
- Memory usage alerts firing

**Resolution:**
1. **Immediate Fix:**
   ```bash
   kubectl patch deployment control-panel -n control-panel -p \
     '{"spec":{"template":{"spec":{"containers":[{"name":"control-panel","resources":{"limits":{"memory":"4Gi"}}}]}}}}'
   ```

2. **Long-term Fix:**
   - Profile application for memory leaks
   - Optimize data structures and caching
   - Review garbage collection settings

### Integration Issues

#### Issue: Gitea Integration Not Working
**Symptoms:**
- Cannot fetch repository information
- Git operations failing
- Gitea integration showing as unhealthy

**Troubleshooting Steps:**
1. **Test Gitea Connectivity**
   ```bash
   kubectl exec -n control-panel deployment/control-panel -- \
     curl -H "Authorization: token $GITEA_TOKEN" https://git.gmac.io/api/v1/version
   ```

2. **Check Gitea Service Status**
   ```bash
   curl -I https://git.gmac.io
   ```

3. **Verify Network Policies**
   ```bash
   kubectl get networkpolicies -n control-panel
   ```

**Resolution:**
- If Gitea is down: Escalate to infrastructure team
- If network connectivity issues: Review network policies and firewall rules
- If authentication issues: Rotate Gitea API tokens

#### Issue: Docker Registry (Harbor) Problems
**Symptoms:**
- Cannot pull/push container images
- Registry operations timing out
- Harbor integration unhealthy

**Resolution:**
1. Check Harbor service status
2. Verify registry credentials
3. Test network connectivity to registry
4. Check storage quota and disk space

### Database Issues

#### Issue: Database Connection Errors
**Symptoms:**
- Application unable to connect to database
- Connection pool exhausted
- Database-related error messages

**Troubleshooting Steps:**
1. **Check Database Pod Status**
   ```bash
   kubectl get pods -n control-panel -l app.kubernetes.io/name=postgresql
   kubectl describe pod -n control-panel -l app.kubernetes.io/name=postgresql
   ```

2. **Check Connection Pool**
   ```bash
   kubectl exec -n control-panel deployment/postgres -- \
     psql -U control_panel_user -d control_panel -c \
     "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
   ```

3. **Test Connectivity**
   ```bash
   kubectl exec -n control-panel deployment/control-panel -- \
     nc -zv postgres-service 5432
   ```

**Resolution:**
- Restart database pod if unresponsive
- Scale connection pool settings
- Kill long-running queries if blocking connections

---

## Escalation Procedures

### When to Escalate

#### From Tier 1 to Tier 2:
- Technical questions beyond basic functionality
- Integration setup or configuration issues  
- Performance complaints
- Error messages requiring system knowledge

#### From Tier 2 to Tier 3:
- Suspected bugs requiring code changes
- System-wide outages or critical issues
- Security-related incidents
- Architecture or design questions

#### From Tier 3 to Leadership:
- P0 incidents affecting all users
- Security breaches or data incidents
- Issues requiring business decisions
- Regulatory or compliance concerns

### Escalation Process

1. **Gather Information**
   - User details and contact information
   - Detailed description of the issue
   - Steps to reproduce the problem
   - Screenshots or error messages
   - Impact assessment (how many users affected)

2. **Document in Ticket System**
   - Create or update support ticket with all relevant information
   - Tag with appropriate severity level
   - Assign to correct team/individual

3. **Communicate Escalation**
   - Notify receiving team via appropriate channel (Slack, email, PagerDuty)
   - Provide context and urgency level
   - Ensure handoff is acknowledged

4. **Follow Up**
   - Monitor progress on escalated issues
   - Provide updates to original requester
   - Document resolution for knowledge base

---

## Support Tools and Resources

### Monitoring and Diagnostics
- **Grafana Dashboard**: https://grafana.gmac.io
- **Application Logs**: 
  ```bash
  kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel --tail=100
  ```
- **System Metrics**: 
  ```bash
  kubectl top pods -n control-panel
  ```

### Communication Channels
- **Internal Support Channel**: #support-team
- **Engineering Channel**: #platform-team  
- **Incident Channel**: #incidents
- **External Status**: https://status.gmac.io

### Documentation Resources
- **API Documentation**: https://docs.gmac.io/api
- **User Guide**: https://docs.gmac.io/user-guide
- **Admin Guide**: https://docs.gmac.io/admin-guide
- **Troubleshooting**: https://docs.gmac.io/troubleshooting

### Support Ticket System
- **Primary**: Zendesk (https://gmac.zendesk.com)
- **Internal**: GitHub Issues for bugs and feature requests
- **Emergency**: PagerDuty for P0/P1 incidents

---

## Customer Communication

### Response Time Expectations

| Priority | First Response | Resolution Target |
|----------|---------------|-------------------|
| P0 - Critical | 15 minutes | 2 hours |
| P1 - High | 1 hour | 8 hours |
| P2 - Medium | 4 hours | 24 hours |
| P3 - Low | 24 hours | 72 hours |

### Communication Templates

#### Initial Response
```
Subject: Re: [Ticket #12345] - Issue with Control Panel

Hello [Customer Name],

Thank you for contacting GMAC.IO support. We have received your request regarding [brief description of issue] and have assigned ticket #12345 for tracking.

We are currently investigating this issue and will provide an update within [timeframe based on priority]. In the meantime, if you have any additional information that might help us resolve this more quickly, please reply to this email.

Priority: [P0/P1/P2/P3]
Assigned to: [Support Agent]
Estimated Resolution: [Timeframe]

Best regards,
GMAC.IO Support Team
```

#### Status Update
```
Subject: [Ticket #12345] Update - [Brief Status]

Hello [Customer Name],

We wanted to provide you with an update on your support ticket #12345.

Current Status: [What we've discovered/attempted]
Next Steps: [What we're doing next]
Expected Timeline: [When you can expect next update or resolution]

If you have any questions or concerns, please don't hesitate to reach out.

Best regards,
[Support Agent Name]
GMAC.IO Support Team
```

#### Resolution
```
Subject: [Ticket #12345] Resolved - [Brief Description]

Hello [Customer Name],

We're happy to inform you that we have resolved the issue described in ticket #12345.

Resolution Summary:
[Brief explanation of what was wrong and how it was fixed]

To prevent similar issues in the future, we recommend:
[Any preventive measures if applicable]

We'll monitor the system to ensure the fix is working properly. If you experience any further issues, please don't hesitate to open a new support ticket.

Thank you for your patience while we worked to resolve this issue.

Best regards,
[Support Agent Name]
GMAC.IO Support Team
```

---

## Self-Service Resources

### Knowledge Base Articles

#### Getting Started
- Account setup and initial configuration
- First-time login and authentication setup
- Basic navigation and features overview
- Integration setup guides

#### Common Tasks
- Adding new applications to the control panel
- Setting up monitoring and alerts
- Configuring CI/CD pipelines
- Managing user access and permissions

#### Troubleshooting
- Login and authentication issues
- Performance optimization tips
- Integration connectivity problems
- Common error messages and solutions

### Video Tutorials
- Control panel overview and navigation (5 minutes)
- Setting up your first application (10 minutes)
- Configuring monitoring and alerts (8 minutes)
- Troubleshooting common issues (12 minutes)

### FAQ Section

#### Q: How do I reset my password?
**A:** Click the "Forgot Password" link on the login page. You'll receive an email with instructions to reset your password. If you don't receive the email within 5 minutes, check your spam folder or contact support.

#### Q: Why am I getting logged out frequently?
**A:** This could be due to session timeout settings or browser cookie issues. Try clearing your browser cache and cookies. If the issue persists, contact support.

#### Q: How do I add a new team member?
**A:** Go to Settings > Users > Add User. Enter their email address and select appropriate permissions. They'll receive an invitation email to join.

#### Q: Can I integrate with my existing CI/CD tools?
**A:** Yes, we support integration with most popular CI/CD tools including Drone CI, GitHub Actions, and Jenkins. Check our integrations documentation for specific setup instructions.

---

## Maintenance and Updates

### Scheduled Maintenance
- **Frequency**: Monthly, typically first Sunday of the month
- **Duration**: 2-4 hours, usually 2:00-6:00 AM UTC
- **Notification**: 7 days advance notice via email and status page
- **Communication**: Updates posted to status page every 30 minutes during maintenance

### Emergency Maintenance
- **Notification**: Minimum 2 hours advance notice when possible
- **Communication**: Immediate notification via status page, email, and in-app notifications
- **Duration**: Variable, with updates every 15 minutes

### Update Process
1. **Pre-maintenance**: 
   - Deploy to staging environment
   - Run automated tests
   - Verify all systems operational
   
2. **During maintenance**:
   - Deploy updates in rolling fashion when possible
   - Monitor system health continuously
   - Keep communication channels updated

3. **Post-maintenance**:
   - Verify all systems operational
   - Run post-deployment tests
   - Monitor for any issues for 2 hours
   - Update status page with completion notice

---

## Performance Guidelines

### Response Time Targets
- **Dashboard Loading**: < 2 seconds
- **API Responses**: < 200ms (95th percentile)
- **Integration Syncing**: < 30 seconds
- **Report Generation**: < 5 seconds for standard reports

### Capacity Limits
- **Max Applications per User**: 100
- **Max Team Members**: 50 per organization
- **API Rate Limits**: 1000 requests per minute per user
- **File Upload Limits**: 100MB per file

### Usage Recommendations
- Optimize dashboard widgets to show only necessary information
- Use API pagination for large datasets
- Schedule automated reports during off-peak hours
- Regular cleanup of old logs and artifacts

---

## Security Guidelines

### Access Control
- Enable two-factor authentication (2FA) for all admin accounts
- Regularly review user permissions and access levels
- Use principle of least privilege for service accounts
- Audit user access quarterly

### Data Protection
- All data encrypted in transit and at rest
- Regular security scans and vulnerability assessments
- Incident response plan for security breaches
- GDPR compliance for user data handling

### Reporting Security Issues
- **Email**: security@gmac.io (GPG key available)
- **Response Time**: 2 hours acknowledgment
- **Process**: Confidential handling until resolution
- **Disclosure**: Coordinated disclosure after fix deployment

---

## Contact Information

### Support Channels
- **Email**: support@gmac.io
- **Live Chat**: Available on control panel (business hours)
- **Status Page**: https://status.gmac.io
- **Documentation**: https://docs.gmac.io

### Emergency Contacts
- **Critical Issues**: +1-800-GMAC-911
- **Security Issues**: security@gmac.io
- **Business Hours**: Monday-Friday, 9 AM - 6 PM UTC

### Business Information
- **Company**: GMAC Technologies Inc.
- **Support Hours**: 24/7 for P0/P1 issues, business hours for P2/P3
- **Time Zone**: Primary support in UTC, follow-the-sun coverage
- **SLA**: 99.9% uptime guarantee with credits for downtime

---

*This support guide is updated monthly. Last updated: March 2024*
*For the most current information, visit: https://docs.gmac.io/support*