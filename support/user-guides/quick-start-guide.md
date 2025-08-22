# GMAC.IO Control Panel - Quick Start Guide

## Welcome to GMAC.IO Control Panel! 🚀

This quick start guide will help you get up and running with the GMAC.IO Control Panel in just a few minutes. Follow these simple steps to start managing your applications, monitoring your infrastructure, and streamlining your development workflow.

---

## Prerequisites

Before you begin, make sure you have:
- A GitHub account (for authentication)
- Access to the GMAC.IO Control Panel (invitation from your organization admin)
- Basic familiarity with web applications and development workflows

---

## Step 1: Login to the Control Panel

1. **Navigate to the Control Panel**
   - Go to https://control.gmac.io
   - Click the "Sign in with GitHub" button

2. **Authorize the Application**
   - You'll be redirected to GitHub for authentication
   - Click "Authorize" to grant access to the Control Panel
   - You'll be redirected back to the dashboard

3. **Complete Your Profile** (First-time users)
   - Fill in your display name and role
   - Set your notification preferences
   - Click "Save Profile" to continue

> **Tip**: If you encounter login issues, make sure you're using the correct GitHub account and that your organization admin has invited you to the platform.

---

## Step 2: Explore the Dashboard

Once logged in, you'll see the main dashboard with several key areas:

### Navigation Menu
- **Dashboard**: Overview of your applications and system health
- **Applications**: Manage your applications and services
- **Integrations**: Configure connections to Git, CI/CD, and registry services
- **Monitoring**: View metrics, logs, and alerts
- **Settings**: User preferences and organization settings

### Dashboard Overview
The dashboard provides a quick snapshot of:
- **System Health**: Overall platform status indicators
- **Recent Activity**: Latest deployments, builds, and system events
- **Quick Actions**: Common tasks like adding applications or viewing logs
- **Resource Usage**: Current CPU, memory, and storage utilization

---

## Step 3: Add Your First Application

Let's add your first application to the Control Panel:

1. **Navigate to Applications**
   - Click "Applications" in the left sidebar
   - Click the "Add Application" button

2. **Configure Basic Information**
   ```
   Application Name: my-web-app
   Description: My awesome web application
   Environment: production
   Team/Owner: your-team-name
   ```

3. **Connect Your Repository**
   - **Git Repository**: https://git.gmac.io/your-username/my-web-app
   - **Branch**: main
   - **Build Path**: ./
   
   > **Note**: If your repository isn't listed, make sure it exists in your Gitea instance and you have access to it.

4. **Configure Build Settings**
   - **Build Command**: `npm run build` (adjust for your technology stack)
   - **Output Directory**: `dist/` or `build/`
   - **Node Version**: 18 (if applicable)

5. **Set Up Container Configuration**
   ```
   Container Registry: registry.gmac.io
   Image Name: your-username/my-web-app
   Port: 3000
   Health Check Path: /health
   ```

6. **Review and Create**
   - Double-check all settings
   - Click "Create Application"
   - Wait for the initial setup to complete

---

## Step 4: Configure Integrations

The Control Panel works best when connected to your development tools:

### Gitea Integration
1. Go to **Integrations** → **Gitea**
2. Click "Configure Integration"
3. Enter your Gitea server details:
   ```
   Server URL: https://git.gmac.io
   API Token: [Your Gitea API token]
   ```
4. Test the connection and save

### Drone CI Integration
1. Go to **Integrations** → **Drone CI**
2. Click "Configure Integration"
3. Enter your Drone CI details:
   ```
   Server URL: https://ci.gmac.io
   API Token: [Your Drone API token]
   ```
4. Enable webhook notifications
5. Test and save the configuration

### Harbor Registry Integration
1. Go to **Integrations** → **Harbor Registry**
2. Click "Configure Integration"
3. Enter your Harbor details:
   ```
   Registry URL: https://registry.gmac.io
   Username: [Your Harbor username]
   Password: [Your Harbor password]
   ```
4. Test the connection and save

---

## Step 5: Set Up Monitoring and Alerts

Stay informed about your application's health:

### Basic Monitoring Setup
1. Navigate to **Monitoring** → **Overview**
2. You'll see default metrics for:
   - Application response times
   - Error rates
   - Resource usage
   - Request throughput

### Configure Alerts
1. Go to **Monitoring** → **Alerts**
2. Click "Create Alert Rule"
3. Set up a basic alert:
   ```
   Alert Name: High Error Rate
   Metric: HTTP Error Rate
   Condition: Greater than 5%
   Duration: 5 minutes
   Notification: Email + Slack
   ```
4. Save the alert rule

### Dashboard Customization
1. Go to **Monitoring** → **Dashboards**
2. Click "Customize Dashboard"
3. Add widgets for metrics you care about:
   - Response time trends
   - Error rate over time
   - Resource usage graphs
   - Recent deployments timeline

---

## Step 6: Your First Deployment

Now let's deploy your application:

### Trigger a Build
1. Go to **Applications** → Select your app
2. Click "Build & Deploy"
3. Select the branch to deploy (usually `main`)
4. Add a deployment message (optional)
5. Click "Start Deployment"

### Monitor the Deployment
1. Watch the real-time build logs
2. Monitor the deployment progress
3. Check the health checks once deployment completes

### Verify Deployment Success
1. Check the application status shows "Running"
2. Test the application URL (if applicable)
3. Review the deployment logs for any issues
4. Verify monitoring shows healthy metrics

---

## Step 7: Explore Advanced Features

### Application Management
- **Scaling**: Adjust CPU/memory resources and replica counts
- **Environment Variables**: Configure app settings and secrets
- **Health Checks**: Set up custom health check endpoints
- **Rollback**: Quickly revert to previous deployments

### Team Collaboration
- **User Management**: Invite team members and set permissions
- **Activity Logs**: Track all changes and deployments
- **Notifications**: Configure team alerts and updates
- **Comments**: Add notes to deployments and incidents

### DevOps Automation
- **Auto-deployment**: Set up automatic deployments on code push
- **Staging Environments**: Create separate environments for testing
- **Blue-Green Deployments**: Zero-downtime deployment strategies
- **Canary Releases**: Gradual rollout of new versions

---

## Common Tasks Quick Reference

### Check Application Status
```
Dashboard → Applications → [Your App] → Overview
```

### View Application Logs
```
Applications → [Your App] → Logs → Select time range
```

### Scale Application
```
Applications → [Your App] → Configuration → Resources → Adjust settings
```

### Roll Back Deployment
```
Applications → [Your App] → Deployments → [Previous Version] → Rollback
```

### Add Team Member
```
Settings → Team → Invite Member → Enter email and permissions
```

### Create Alert
```
Monitoring → Alerts → Create Rule → Configure conditions and notifications
```

---

## Getting Help

### In-App Help
- **Help Icon**: Click the "?" icon in the top-right corner for contextual help
- **Documentation Links**: Each page has links to relevant documentation
- **Tooltips**: Hover over form fields for quick explanations

### Support Resources
- **Knowledge Base**: https://docs.gmac.io/kb
- **Video Tutorials**: https://docs.gmac.io/videos
- **API Documentation**: https://docs.gmac.io/api
- **Community Forum**: https://community.gmac.io

### Contact Support
- **Email**: support@gmac.io
- **Live Chat**: Available in the Control Panel (bottom-right corner)
- **Status Page**: https://status.gmac.io

---

## What's Next?

Now that you have the basics set up, consider exploring these advanced topics:

### Week 1 Goals
- [ ] Set up monitoring alerts for your key applications
- [ ] Configure automated deployments from your main branch  
- [ ] Invite your team members and set appropriate permissions
- [ ] Explore the API documentation for automation opportunities

### Week 2 Goals
- [ ] Set up staging and production environments
- [ ] Configure health checks for better reliability
- [ ] Implement blue-green or canary deployment strategies
- [ ] Create custom monitoring dashboards for your team

### Ongoing Best Practices
- [ ] Regular review of monitoring alerts and thresholds
- [ ] Keep your integrations and tokens up to date
- [ ] Review and clean up old deployments and logs
- [ ] Stay updated with new features and platform updates

---

## Troubleshooting Common Issues

### Can't Log In
- **Check GitHub authorization**: Make sure you've authorized the GMAC.IO app in GitHub
- **Verify organization membership**: Ensure you've been invited to your organization
- **Clear browser cache**: Sometimes cached data can cause login issues

### Application Won't Build
- **Check repository access**: Verify the repository exists and you have read access
- **Review build logs**: Look for specific error messages in the build output
- **Verify build configuration**: Ensure build commands and paths are correct

### Integrations Not Working
- **Test API tokens**: Verify your API tokens haven't expired
- **Check network connectivity**: Ensure the Control Panel can reach your services
- **Review integration logs**: Look for authentication or connectivity errors

### Need More Help?
Don't hesitate to reach out! Our support team is here to help you succeed:
- Email: support@gmac.io
- Live chat in the Control Panel
- Schedule a one-on-one onboarding session

---

**Welcome to GMAC.IO! We're excited to see what you'll build.** 🎉

*This guide covers the essential first steps. For more detailed information, check out our full documentation at https://docs.gmac.io*