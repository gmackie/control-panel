# Deployment System for gmac.io Kubernetes Cluster

Complete deployment system for setting up, configuring, and deploying applications to the gmac.io Kubernetes cluster.

## 🚀 Features

- **Complete Project Setup** - Initialize projects with all required configurations
- **Turso Database Integration** - Automatic database creation and credential management
- **Multi-Environment Support** - Production and staging environments
- **Secret Management** - Secure handling of credentials and environment variables
- **GitOps Ready** - ArgoCD integration for continuous deployment
- **CI/CD Workflows** - GitHub Actions for automated builds
- **SSL Certificates** - Automatic HTTPS with cert-manager
- **Web UI Integration** - Deploy from Control Panel web interface
- **NPM Private Registry** - Harbor-based NPM registry for private packages

## 📋 Quick Start

### 1. Basic Project Setup
```bash
./setup-project.sh --name my-app --path ./my-app --domain my-app.gmac.io
```

### 2. Full Setup with Database and Staging
```bash
./setup-project.sh \
  --name my-app \
  --path ./my-app \
  --domain my-app.gmac.io \
  --staging \
  --turso-db \
  --port 3000
```

### 3. Complete Setup and Deploy
```bash
./complete-deploy.sh ./my-app \
  --name my-app \
  --domain my-app.gmac.io \
  --turso-db \
  --auto-deploy
```

## 🔧 Available Scripts

### `setup-project.sh`
Complete project setup with all configurations needed for deployment.

**Options:**
- `--name` (required) - Project name
- `--path` (required) - Project directory path
- `--domain` - Primary domain (default: `<name>.gmac.io`)
- `--staging` - Create staging environment at `beta.<domain>`
- `--turso-db` - Create Turso database with credentials
- `--port` - Application port (default: 3000)
- `--type` - Project type: node|python|go|static|auto
- `--namespace` - Kubernetes namespace (default: project name)
- `--gitea-repo` - Use existing Gitea repository
- `--skip-git` - Skip Git operations
- `--no-secrets` - Skip secret creation

### NPM Registry Scripts

#### `harbor-npm-setup.sh`
Initial setup of Harbor NPM repository (run once):
```bash
./harbor-npm-setup.sh
```

#### `setup-npm-registry.sh`
Configure NPM to use private registry:
```bash
# Global setup
./setup-npm-registry.sh --global

# Project setup
./setup-npm-registry.sh --project /path/to/project
```

### `manage-secrets.sh`
Manage Kubernetes secrets for your applications.

**Commands:**
```bash
# List all secrets
./manage-secrets.sh --namespace my-app --secret my-app-secrets list

# Set a secret
./manage-secrets.sh --namespace my-app --secret my-app-secrets set API_KEY "value"

# Get a secret value
./manage-secrets.sh --namespace my-app --secret my-app-secrets get API_KEY

# Update from .env file
./manage-secrets.sh --namespace my-app --secret my-app-secrets update-from-env --from-file .env
```

### `complete-deploy.sh`
Combines project setup and initial deployment.

```bash
./complete-deploy.sh ./my-app --name my-app --domain my-app.gmac.io --auto-deploy
```

### Legacy Scripts
- `one-click-deploy.sh` - Legacy deployment script
- `deploy-app.sh` - Original deployment script
- `easy-deploy.sh` - Interactive deployment wizard
- `quick-deploy.sh` - Quick ArgoCD setup
- `direct-deploy.sh` - Deploy containers without Git

## 📁 What Gets Created

### Project Structure
```
your-app/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD workflow
├── k8s/
│   ├── base-deployment.yaml    # Main deployment
│   ├── production-ingress.yaml # Production ingress
│   ├── staging-deployment.yaml # Staging (if enabled)
│   └── argocd-app.yaml        # ArgoCD application
├── Dockerfile                  # Optimized for your project type
├── deploy.sh                   # Quick deployment script
└── DEPLOYMENT.md              # Project-specific docs
```

### Kubernetes Resources
- Namespace
- Deployment with health checks
- Service
- Ingress with SSL
- Secrets for credentials
- ArgoCD Application

## 🔐 Credentials

All credentials are stored in `credentials.env`:

```bash
source credentials.env

# Available variables:
# - KUBECONFIG
# - GITEA_URL, GITEA_USER
# - HARBOR_URL, HARBOR_USER, HARBOR_PASSWORD
# - ARGOCD_URL
# - TURSO_TOKEN
```

## 🌐 Environment Variables

### Automatically Configured
- `NODE_ENV` - Set to production/staging
- `APP_NAME` - Your application name
- `APP_DOMAIN` - Application domain
- `PORT` - Application port

### With Turso Database
- `TURSO_DATABASE_URL` - Database connection URL
- `TURSO_AUTH_TOKEN` - Authentication token

## 📊 Deployment Workflow

1. **Setup Project**
   ```bash
   ./setup-project.sh --name my-app --path ./my-app
   ```

2. **Push to Git**
   ```bash
   cd ./my-app
   git push -u origin main
   ```

3. **Monitor Deployment**
   - ArgoCD: https://cd.gmac.io/applications/my-app
   - Pods: `kubectl get pods -n my-app -w`
   - Logs: `kubectl logs -n my-app -l app=my-app -f`

4. **Access Application**
   - Production: `https://my-app.gmac.io`
   - Staging: `https://beta.my-app.gmac.io`

## 🔍 Testing

Run the test suite to verify everything is working:

```bash
./test-setup.sh
```

This will:
- Create a test project
- Run full setup including database
- Verify all resources are created
- Clean up afterwards

## 🚦 Web UI Integration

The deployment system is integrated into the Control Panel web interface:

1. Navigate to `/deployments` in Control Panel
2. Choose deployment type
3. Fill in application details
4. Click "Deploy Application"

API endpoints are available at:
- `POST /api/deployment/deploy` - Deploy new application
- `GET /api/deployment/status?app={name}` - Check status
- `GET /api/deployment/list` - List all deployments

## 📦 NPM Private Registry

### Setup (First Time)
```bash
# Setup Harbor NPM repository
./harbor-npm-setup.sh

# Configure NPM locally
./setup-npm-registry.sh --global
```

### Publishing Packages
```bash
# All packages must use @gmac scope
npm init --scope=@gmac
npm publish
```

### Installing Private Packages
```bash
npm install @gmac/package-name
```

See [NPM Registry Guide](NPM-REGISTRY-GUIDE.md) for complete documentation.

## 📚 Documentation

- [Project Setup Guide](PROJECT-SETUP-GUIDE.md) - Detailed setup instructions
- [Complete Deployment Guide](COMPLETE-DEPLOYMENT-GUIDE.md) - Full deployment documentation
- [Quick Start](QUICK-START.md) - 60-second quick start
- [NPM Registry Guide](NPM-REGISTRY-GUIDE.md) - Private NPM registry setup and usage
- [Web Integration](README-WEBAPP.md) - Web UI integration details
- [Legacy Documentation](DEPLOYMENT-SYSTEM.md) - Original deployment system docs

## ⚠️ Important Notes

1. **Ingress Controller** - Must be running on master node for proper routing
2. **DNS Configuration** - Point domains to cluster IP: 5.78.106.236
3. **SSL Certificates** - Allow 2-3 minutes for cert-manager to provision
4. **Turso Database** - Requires Turso CLI installed and authenticated
5. **Git Push** - Triggers automatic deployment via GitHub Actions

## 🛟 Troubleshooting

### Common Issues

1. **Deployment not starting**
   ```bash
   # Check ArgoCD sync
   argocd app sync <app-name>
   
   # Check events
   kubectl events -n <namespace>
   ```

2. **Can't access application**
   ```bash
   # Check ingress
   kubectl get ingress -n <namespace>
   
   # Check certificate
   kubectl get certificate -n <namespace>
   ```

3. **Secret issues**
   ```bash
   # List secrets
   ./manage-secrets.sh --namespace <ns> --secret <name> list
   
   # Recreate secrets
   kubectl delete secret <name> -n <namespace>
   ./setup-project.sh --name <app> --path . --no-git
   ```

## 🤝 Contributing

To add new features:
1. Update `setup-project.sh` for new options
2. Update documentation
3. Add tests to `test-setup.sh`
4. Test with real projects

## 📞 Support

- Cluster Status: `kubectl get nodes`
- All Applications: `kubectl get ingress -A`
- ArgoCD Dashboard: https://cd.gmac.io
- Grafana Monitoring: https://grafana.gmac.io