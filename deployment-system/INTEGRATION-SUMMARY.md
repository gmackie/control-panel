# Deployment System Integration Summary

## What Was Added

### 1. Deployment System Files
- **Location**: `/Volumes/dev/control-panel/deployment-system/`
- Contains all deployment scripts, credentials, and documentation
- Includes one-click deployment, quick deploy, and direct deploy options

### 2. API Routes
- `src/app/api/deployment/deploy/route.ts` - Deploy new applications
- `src/app/api/deployment/status/route.ts` - Check deployment status  
- `src/app/api/deployment/list/route.ts` - List all deployments

### 3. React Components
- `src/components/deployment/DeploymentManager.tsx` - Deploy new apps UI
- `src/components/deployment/DeploymentList.tsx` - List deployed apps

### 4. Pages
- `src/app/deployments/page.tsx` - Main deployment interface
- Navigation already configured (link exists in Navigation.tsx)

### 5. Key Files

#### Credentials
- `deployment-system/credentials.env` - All cluster credentials
- `deployment-system/COMPLETE-DEPLOYMENT-GUIDE.md` - Full documentation

#### Scripts
- `deployment-system/one-click-deploy.sh` - Full deployment with Git
- `deployment-system/quick-deploy.sh` - Deploy existing repos
- `deployment-system/direct-deploy.sh` - Direct container deployment

## How to Use

### From Web UI
1. Navigate to `/deployments` in Control Panel
2. Choose deployment type:
   - **Full Deploy**: Creates repo, CI/CD, and deploys
   - **Quick Deploy**: For existing Gitea repos
   - **Direct Deploy**: Deploy containers without Git
3. Fill in app details and click Deploy

### From Command Line
```bash
cd /Volumes/dev/control-panel/deployment-system
./one-click-deploy.sh /path/to/app my-app my-app.gmac.io 3000
```

### API Usage
```javascript
// Deploy an app
const response = await fetch('/api/deployment/deploy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appName: 'my-app',
    domain: 'my-app.gmac.io',
    port: 3000,
    gitRepo: '/path/to/app',
    deploymentType: 'gitea'
  })
});

// Check status
const status = await fetch('/api/deployment/status?app=my-app');

// List all apps
const list = await fetch('/api/deployment/list');
```

## Credentials Summary

- **Kubernetes**: Configured via KUBECONFIG
- **Gitea**: git.gmac.io (user: gmackie)
- **Harbor**: registry.gmac.io (admin/Harbor12345)
- **ArgoCD**: cd.gmac.io (admin user)
- **Turso**: Token included for database creation

## Important Notes

1. The deployment system runs with server-side credentials
2. All scripts are executable and tested
3. Ingress controller now runs on master node for proper routing
4. SSL certificates are automatically configured via cert-manager

## Next Steps

To deploy the Control Panel itself with the deployment system:
```bash
cd /Volumes/dev/control-panel
npm run build
./deployment-system/one-click-deploy.sh . control-panel control-panel.gmac.io 3000
```