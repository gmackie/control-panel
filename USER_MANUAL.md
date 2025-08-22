# GMAC.IO Control Panel - User Manual

## Table of Contents

1. [Getting Started](#getting-started)
2. [Navigation](#navigation)
3. [Dashboard Overview](#dashboard-overview)
4. [Applications Management](#applications-management)
5. [Cluster Monitoring](#cluster-monitoring)
6. [Infrastructure Overview](#infrastructure-overview)
7. [Integrations](#integrations)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Registry Management](#registry-management)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#frequently-asked-questions)

---

## Getting Started

### Accessing the Control Panel

1. **URL**: Navigate to `https://control.gmac.io` (or your configured URL)
2. **Sign In**: Click "Continue with GitHub" to authenticate using your GitHub account
3. **First Time Setup**: After signing in, you'll be redirected to the dashboard

### System Requirements

**Supported Browsers**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Recommended Resolution**: 1920x1080 or higher for optimal experience

---

## Navigation

### Main Navigation Menu

The left sidebar contains the main navigation:

- **🏠 Dashboard**: Overview of all systems and metrics
- **📱 Applications**: Manage deployed applications
- **🔧 Cluster**: Kubernetes cluster management
- **📊 Monitoring**: System metrics and alerts
- **🔗 Integrations**: External service connections
- **📦 Registry**: Container image management
- **⚙️ Settings**: User preferences and configuration

### Mobile Navigation

On mobile devices:
1. Tap the hamburger menu (☰) in the top-left corner
2. Select your desired section from the slide-out menu
3. Tap anywhere outside the menu to close it

### User Menu

Located in the top-right corner:
- **Profile**: View your user information
- **Settings**: Configure preferences
- **Sign Out**: Log out of the application

---

## Dashboard Overview

The dashboard provides a comprehensive view of your infrastructure:

### Infrastructure Status
- **Cluster Health**: Overall Kubernetes cluster status
- **Node Count**: Number of active worker nodes
- **Pod Status**: Running, pending, and failed pods
- **Service Count**: Active Kubernetes services

### Resource Utilization
- **CPU Usage**: Current CPU utilization across all nodes
- **Memory Usage**: RAM consumption and availability
- **Storage Usage**: Disk space utilization
- **Network Traffic**: Incoming and outgoing data rates

### Application Health
Quick status overview of all integrated services:
- **🟢 Healthy**: Service is operating normally
- **🟡 Warning**: Service has minor issues
- **🔴 Critical**: Service requires immediate attention
- **⚪ Unknown**: Service status cannot be determined

### Cost Tracking
- **Current Costs**: Month-to-date infrastructure expenses
- **Projected Costs**: Estimated monthly costs
- **Cost Breakdown**: Spending by category (compute, storage, network)

### Recent Activity
- Recent deployments
- System alerts
- User actions
- Integration events

---

## Applications Management

### Viewing Applications

1. Navigate to **Applications** in the main menu
2. View the list of all deployed applications
3. Use filters to find specific applications:
   - **Status**: deployed, pending, failed, stopped
   - **Environment**: development, staging, production
   - **Search**: Find apps by name

### Application Details

Click on any application to view:
- **Basic Information**: Name, repository, image, status
- **Deployment Status**: Current state and history
- **Resource Usage**: CPU, memory, and storage consumption
- **Health Metrics**: Response time, error rate, uptime
- **Integration Status**: Gitea, Drone, Harbor, ArgoCD connections

### Creating New Applications

1. Click **"+ New Application"**
2. Fill in the application details:
   - **Name**: Unique application identifier
   - **Git Repository**: Source code repository URL
   - **Docker Image**: Container image location
   - **Environment**: deployment target (dev/staging/prod)
   - **Resources**: CPU and memory limits
3. Select integrations to enable
4. Configure environment variables and secrets
5. Click **"Create Application"**

### Managing Applications

**Start/Stop Applications**:
- Click the application name
- Use the **Actions** dropdown
- Select "Start" or "Stop"

**Scaling Applications**:
- Navigate to application details
- Click **"Scale"**
- Adjust replica count
- Click **"Update"**

**Viewing Logs**:
- Go to application details
- Click **"Logs"** tab
- Select time range and log level
- Use search to filter log entries

---

## Cluster Monitoring

### Node Management

1. Go to **Cluster** → **Nodes**
2. View all cluster nodes with their status:
   - **Name**: Node identifier
   - **Status**: Ready, NotReady, SchedulingDisabled
   - **Roles**: master, worker
   - **Resources**: CPU, memory, pods capacity and usage
   - **Age**: Time since node joined cluster

### Node Operations

**Cordon Node** (prevent new pods):
1. Click on a node
2. Select **Actions** → **Cordon**
3. Confirm the action

**Drain Node** (remove all pods):
1. Click on a node
2. Select **Actions** → **Drain**
3. Choose force options if needed
4. Confirm the action

**Uncordon Node** (allow scheduling):
1. Click on a cordoned node
2. Select **Actions** → **Uncordon**
3. Confirm the action

### Pod Management

View and manage pods across the cluster:
- **Running Pods**: Currently active pods
- **Pending Pods**: Pods waiting to be scheduled
- **Failed Pods**: Pods with errors
- **Completed Pods**: Successfully finished jobs

### Service Discovery

Monitor Kubernetes services:
- **ClusterIP**: Internal cluster services
- **NodePort**: Services exposed on nodes
- **LoadBalancer**: External load-balanced services
- **Ingress**: HTTP/HTTPS routing rules

---

## Infrastructure Overview

### Cloud Providers

Monitor resources across providers:
- **Hetzner**: VPS instances and costs
- **AWS**: S3 storage, RDS databases
- **Other**: Additional cloud services

### Cost Management

**Viewing Costs**:
1. Navigate to **Infrastructure** → **Costs**
2. Select time period (daily, weekly, monthly)
3. Filter by service or provider
4. Export cost reports if needed

**Cost Optimization**:
- Review resource utilization
- Identify underused instances
- Set up cost alerts
- Schedule non-production workloads

### Capacity Planning

Monitor resource trends to plan capacity:
- **Historical Usage**: CPU, memory, storage over time
- **Growth Trends**: Resource consumption patterns
- **Forecasting**: Predicted future requirements
- **Recommendations**: Suggested optimizations

---

## Integrations

### Available Integrations

**Gitea** (Git Repository):
- Repository management
- Webhook processing
- Commit tracking
- Branch monitoring

**Drone CI** (Continuous Integration):
- Build pipeline status
- Test results
- Deployment tracking
- Build history

**Harbor** (Container Registry):
- Image management
- Vulnerability scanning
- Image signing
- Registry statistics

**ArgoCD** (GitOps):
- Application sync status
- Deployment health
- Configuration drift
- Rollback capabilities

### Configuring Integrations

1. Go to **Integrations**
2. Click on the service you want to configure
3. Enter connection details:
   - **URL**: Service endpoint
   - **Token**: Authentication token
   - **Settings**: Service-specific options
4. Click **"Test Connection"**
5. Save configuration

### Integration Status

Monitor integration health:
- **🟢 Connected**: Integration is working properly
- **🟡 Warning**: Minor connectivity issues
- **🔴 Error**: Integration is not functioning
- **⚪ Not Configured**: Integration not set up

### Troubleshooting Integrations

**Connection Issues**:
1. Verify service URL is correct
2. Check authentication tokens
3. Confirm network connectivity
4. Review service logs

**Webhook Issues**:
1. Verify webhook URL configuration
2. Check webhook secret/token
3. Review payload format
4. Monitor webhook delivery logs

---

## Monitoring & Alerts

### System Metrics

**CPU Metrics**:
- Usage percentage across all nodes
- Load average (1m, 5m, 15m)
- Per-core utilization
- Historical trends

**Memory Metrics**:
- Used vs. available memory
- Cache and buffer usage
- Swap utilization
- Memory pressure indicators

**Disk Metrics**:
- Storage usage by volume
- I/O operations per second
- Read/write throughput
- Disk health status

**Network Metrics**:
- Ingress/egress traffic
- Connection counts
- Bandwidth utilization
- Packet loss rates

### Application Metrics

**Performance Metrics**:
- Response times (avg, p95, p99)
- Request rates (requests per second)
- Error rates and status codes
- Throughput metrics

**Availability Metrics**:
- Uptime percentage
- Service availability
- Health check status
- Dependency status

### Alert Management

**Viewing Alerts**:
1. Navigate to **Monitoring** → **Alerts**
2. Filter alerts by:
   - **Status**: firing, pending, resolved
   - **Severity**: critical, high, medium, low
   - **Service**: specific application or system
3. Click on alerts for detailed information

**Alert Actions**:
- **Acknowledge**: Mark alert as seen
- **Resolve**: Mark issue as fixed
- **Snooze**: Temporarily suppress notifications
- **Escalate**: Forward to on-call team

**Creating Custom Alerts**:
1. Go to **Monitoring** → **Alert Rules**
2. Click **"+ New Rule"**
3. Define the alert:
   - **Name**: Descriptive alert name
   - **Query**: Metric query (PromQL)
   - **Condition**: Threshold and duration
   - **Severity**: Alert importance level
4. Configure notifications
5. Save the rule

### Notification Channels

Configure where alerts are sent:
- **Email**: Send to email addresses
- **Slack**: Post to Slack channels
- **Webhook**: HTTP POST to external systems
- **PagerDuty**: Integrate with on-call system

---

## Registry Management

### Viewing Repositories

1. Navigate to **Registry**
2. Browse all container repositories
3. Search for specific images
4. Filter by:
   - **Project**: Repository namespace
   - **Vulnerability Level**: Security scan results
   - **Last Updated**: Recent activity

### Repository Details

Click on any repository to view:
- **Tags**: Available image versions
- **Size**: Repository storage usage
- **Pull Count**: Download statistics
- **Vulnerability Report**: Security scan results
- **Build History**: Image creation timeline

### Managing Images

**Pulling Images**:
```bash
docker pull registry.gmac.io/project/image:tag
```

**Pushing Images**:
```bash
docker tag local-image registry.gmac.io/project/image:tag
docker push registry.gmac.io/project/image:tag
```

**Deleting Images**:
1. Navigate to repository details
2. Select image tags to delete
3. Click **"Delete Selected"**
4. Confirm the action

### Security Scanning

**Vulnerability Reports**:
- **Critical**: Immediate security risks
- **High**: Important security issues
- **Medium**: Moderate security concerns
- **Low**: Minor security notes
- **None**: No known vulnerabilities

**Remediation**:
1. Review vulnerability details
2. Update base images or dependencies
3. Rebuild and push updated images
4. Verify scan results improve

---

## Troubleshooting

### Common Issues

**Authentication Problems**:
- Clear browser cookies and cache
- Try signing in with an incognito/private window
- Verify GitHub account permissions
- Contact administrator for access

**Slow Performance**:
- Check internet connection speed
- Disable browser extensions temporarily
- Try a different browser
- Clear browser cache

**Missing Data**:
- Refresh the page
- Check if services are running
- Verify integration configurations
- Review service logs

**Connection Errors**:
- Verify service URLs and endpoints
- Check authentication tokens
- Confirm network connectivity
- Review firewall settings

### Getting Help

**Self-Service Options**:
1. Check this user manual
2. Review API documentation
3. Search FAQ section
4. Check service status page

**Support Channels**:
- **Documentation**: Comprehensive guides and API docs
- **GitHub Issues**: Report bugs and feature requests
- **Team Chat**: Direct communication with development team
- **Email Support**: For sensitive issues

### Log Collection

**Browser Console Logs**:
1. Press F12 to open developer tools
2. Go to Console tab
3. Reproduce the issue
4. Copy error messages
5. Include in support request

**Application Logs**:
1. Navigate to affected application
2. Go to **Logs** tab
3. Select relevant time range
4. Download or copy log entries
5. Share with support team

---

## Frequently Asked Questions

### General Questions

**Q: How do I get access to the control panel?**
A: Contact your system administrator to add your GitHub account to the authorized users list.

**Q: Can I use this on mobile devices?**
A: Yes, the control panel is fully responsive and works on tablets and smartphones.

**Q: How often is data updated?**
A: Most metrics are updated every 30 seconds. Real-time data uses server-sent events for instant updates.

### Applications

**Q: How do I deploy a new application?**
A: Use the Applications section to create new deployments. You'll need the Git repository URL and container image location.

**Q: Can I rollback a deployment?**
A: Yes, go to the application details and use the deployment history to rollback to a previous version.

**Q: Why is my application showing as unhealthy?**
A: Check the application logs and health check configuration. Ensure the health endpoint is responding correctly.

### Monitoring

**Q: How do I create custom alerts?**
A: Navigate to Monitoring → Alert Rules and create new rules using PromQL queries.

**Q: Why am I not receiving alert notifications?**
A: Verify your notification channels are configured correctly and test the connections.

**Q: Can I export metrics data?**
A: Yes, use the export functionality in the monitoring dashboard or access the API directly.

### Cluster Management

**Q: Is it safe to drain a node?**
A: Yes, draining gracefully moves pods to other nodes. However, ensure you have sufficient capacity on other nodes.

**Q: How do I add new nodes to the cluster?**
A: New nodes are added through the infrastructure provisioning process. Contact your administrator.

**Q: What happens if a master node fails?**
A: In a high-availability setup, other master nodes will maintain cluster operations. Single-master clusters require immediate attention.

### Integrations

**Q: How do I connect to a private Git repository?**
A: Configure SSH keys or access tokens in the integration settings. Ensure the service account has repository access.

**Q: Why are webhooks not working?**
A: Check the webhook URL, authentication, and payload format. Review webhook delivery logs in your Git service.

**Q: Can I use different container registries?**
A: Yes, configure multiple registry integrations in the settings. Each application can use different registries.

### Troubleshooting

**Q: The dashboard is loading slowly. What should I do?**
A: Check your internet connection, clear browser cache, and verify that backend services are running normally.

**Q: I'm getting permission errors. How do I fix this?**
A: Contact your administrator to verify your user permissions and role assignments.

**Q: How do I report a bug?**
A: Create an issue in the GitHub repository with detailed steps to reproduce the problem.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open command palette | `Ctrl/Cmd + K` |
| Navigate to dashboard | `G + D` |
| Navigate to applications | `G + A` |
| Navigate to cluster | `G + C` |
| Navigate to monitoring | `G + M` |
| Refresh current page | `R` |
| Open help | `?` |
| Close modal/dialog | `Escape` |

## Glossary

**ArgoCD**: GitOps continuous delivery tool for Kubernetes
**Container**: Lightweight, standalone package of software
**Drone CI**: Continuous integration platform
**GitOps**: Deployment methodology using Git as source of truth
**Harbor**: Enterprise container registry with security scanning
**K3s/K8s**: Lightweight Kubernetes distributions
**Node**: Physical or virtual machine in Kubernetes cluster
**Pod**: Smallest deployable unit in Kubernetes
**Prometheus**: Monitoring and alerting toolkit
**Registry**: Storage for container images

---

For additional support or questions not covered in this manual, please contact the development team or create an issue in the project repository.