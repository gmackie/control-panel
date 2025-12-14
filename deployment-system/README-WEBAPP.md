# Deployment System - Web Integration

The deployment system has been integrated into the Control Panel web application.

## Features

### 1. Web UI Integration
- **Deploy Page**: `/deployments` - Full deployment interface
- **API Endpoints**:
  - `POST /api/deployment/deploy` - Deploy new application
  - `GET /api/deployment/status?app={name}` - Check deployment status
  - `GET /api/deployment/list` - List all deployments

### 2. Deployment Options

#### Full Deploy (Gitea)
- Creates Git repository
- Adds CI/CD workflow
- Builds Docker image
- Deploys to Kubernetes
- Configures SSL

#### Quick Deploy
- For existing Gitea repositories
- Skips repository creation
- Creates ArgoCD application

#### Direct Deploy
- No Git integration
- Deploys containers directly
- Good for testing

### 3. Usage in Control Panel

1. Navigate to `/deployments` in the Control Panel
2. Choose deployment type
3. Fill in application details
4. Click "Deploy Application"
5. Monitor deployment progress

### 4. Environment Variables

The deployment scripts use these credentials:
```bash
KUBECONFIG=/Users/mackieg/.kube/config-hetzner
GITEA_URL=https://git.gmac.io
GITEA_USER=gmackie
HARBOR_URL=registry.gmac.io
HARBOR_USER=admin
HARBOR_PASSWORD=Harbor12345
ARGOCD_URL=https://cd.gmac.io
TURSO_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

### 5. API Examples

#### Deploy Application
```typescript
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
```

#### Check Status
```typescript
const response = await fetch('/api/deployment/status?app=my-app');
const status = await response.json();
```

#### List Deployments
```typescript
const response = await fetch('/api/deployment/list');
const { deployments } = await response.json();
```

### 6. Component Usage

```tsx
import { DeploymentManager } from '@/components/deployment/DeploymentManager';
import { DeploymentList } from '@/components/deployment/DeploymentList';

// In your page
<DeploymentManager />
<DeploymentList />
```

### 7. Security Notes

- Scripts run with server credentials
- Ensure proper authentication on API routes
- Validate all user inputs
- Log deployment activities

### 8. Troubleshooting

If deployments fail:
1. Check server logs: `npm run dev` output
2. Verify credentials in deployment-system/credentials.env
3. Ensure kubectl is accessible from Node.js process
4. Check Kubernetes cluster connectivity