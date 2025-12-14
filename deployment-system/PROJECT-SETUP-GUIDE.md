# Project Setup Guide

Complete guide for setting up projects for deployment to the gmac.io Kubernetes cluster.

## 🚀 Quick Start

```bash
# Basic setup
./setup-project.sh --name my-app --path ./my-app --domain my-app.gmac.io

# Full setup with database and staging
./setup-project.sh --name my-app --path ./my-app --domain my-app.gmac.io --staging --turso-db

# Setup existing repository
./setup-project.sh --name my-app --path ./my-app --gitea-repo gmackie/my-app --domain my-app.gmac.io
```

## 📋 Setup Script Options

### Required Arguments
- `--name <name>` - Project name (used for Kubernetes resources)
- `--path <path>` - Path to project directory

### Optional Arguments
- `--domain <domain>` - Primary domain (default: `<name>.gmac.io`)
- `--staging` - Create staging environment at `beta.<domain>`
- `--turso-db` - Create Turso database with credentials
- `--port <port>` - Application port (default: 3000)
- `--type <type>` - Project type: node|python|go|static|auto (default: auto)
- `--namespace <ns>` - Kubernetes namespace (default: project name)
- `--gitea-repo <repo>` - Use existing Gitea repository
- `--skip-git` - Skip all Git operations
- `--no-secrets` - Skip secret creation

## 🔧 What the Script Does

### 1. Project Detection
- Auto-detects project type from files:
  - `package.json` → Node.js
  - `requirements.txt` → Python
  - `go.mod` → Go
  - `index.html` → Static
  - Otherwise → Generic

### 2. Database Setup (if --turso-db)
- Creates Turso database named `<project>-db`
- Generates auth token
- Stores credentials in Kubernetes secrets

### 3. Kubernetes Resources
- Creates namespace
- Creates Docker registry secret
- Creates application secrets with:
  - Turso credentials (if database created)
  - Environment variables
  - Application configuration

### 4. Git Repository
- Creates Gitea repository (unless --skip-git)
- Configures remote

### 5. Project Files Created

#### CI/CD Workflow (`.github/workflows/deploy.yml`)
- Builds Docker image on push
- Tags with branch, SHA, and version
- Pushes to Harbor registry
- Supports caching

#### Dockerfile
- Optimized for project type
- Multi-stage builds for smaller images
- Security best practices

#### Kubernetes Manifests (`k8s/`)
- `base-deployment.yaml` - Main application deployment
- `production-ingress.yaml` - Production ingress with SSL
- `staging-deployment.yaml` - Staging environment (if --staging)
- `argocd-app.yaml` - ArgoCD application for GitOps

#### Deployment Script (`deploy.sh`)
- Quick deployment command
- Applies all manifests
- Shows next steps

#### Documentation (`DEPLOYMENT.md`)
- Project configuration summary
- Deployment instructions
- Secret information
- Monitoring links

## 📝 Examples

### Node.js Application with Database
```bash
./setup-project.sh \
  --name my-api \
  --path ~/projects/my-api \
  --domain api.mycompany.com \
  --turso-db \
  --port 3000
```

### Python App with Staging
```bash
./setup-project.sh \
  --name ml-service \
  --path ./ml-service \
  --domain ml.gmac.io \
  --staging \
  --type python \
  --port 8000
```

### Static Website
```bash
./setup-project.sh \
  --name docs-site \
  --path ./documentation \
  --domain docs.gmac.io \
  --type static
```

### Existing Repository
```bash
./setup-project.sh \
  --name existing-app \
  --path ./existing-app \
  --gitea-repo gmackie/existing-app \
  --domain app.gmac.io
```

## 🔐 Secret Management

Use the companion script to manage secrets:

```bash
# List secrets
./manage-secrets.sh --namespace my-app --secret my-app-secrets list

# Set a secret
./manage-secrets.sh --namespace my-app --secret my-app-secrets set API_KEY "secret-value"

# Get a secret
./manage-secrets.sh --namespace my-app --secret my-app-secrets get DATABASE_URL

# Update from .env file
./manage-secrets.sh --namespace my-app --secret my-app-secrets update-from-env --from-file .env.production
```

## 🌐 Environment Variables

### Automatically Set
- `NODE_ENV=production`
- `APP_NAME=<project-name>`
- `APP_DOMAIN=<domain>`
- `PORT=<port>`

### With Turso Database
- `TURSO_DATABASE_URL` - Database connection URL
- `TURSO_AUTH_TOKEN` - Authentication token

### Custom Variables
Add using manage-secrets.sh or directly in manifests.

## 🚦 Deployment Workflow

1. **Setup Project**
   ```bash
   ./setup-project.sh --name my-app --path ./my-app --domain my-app.gmac.io
   ```

2. **Customize Files**
   - Review generated Dockerfile
   - Adjust Kubernetes manifests if needed
   - Add health check endpoints

3. **Push to Git**
   ```bash
   cd ./my-app
   git push -u origin main
   ```

4. **Monitor Deployment**
   ```bash
   # Watch pods
   kubectl get pods -n my-app -w
   
   # Check ArgoCD
   open https://cd.gmac.io/applications/my-app
   
   # View logs
   kubectl logs -n my-app -l app=my-app -f
   ```

5. **Access Application**
   - Production: `https://<domain>`
   - Staging: `https://beta.<domain>` (if enabled)

## 🔍 Troubleshooting

### Common Issues

1. **Secret Creation Failed**
   ```bash
   # Check existing secrets
   kubectl get secrets -n <namespace>
   
   # Delete and recreate
   kubectl delete secret <secret-name> -n <namespace>
   ```

2. **Turso Database Issues**
   ```bash
   # Check Turso CLI
   turso auth whoami
   
   # List databases
   turso db list
   ```

3. **Git Push Failed**
   ```bash
   # Check remote
   git remote -v
   
   # Set credentials
   git config credential.helper store
   ```

4. **Deployment Not Starting**
   ```bash
   # Check ArgoCD sync
   argocd app sync <app-name>
   
   # Check events
   kubectl events -n <namespace>
   ```

## 📊 Best Practices

1. **Always use --staging for production apps**
2. **Test deployments in staging first**
3. **Use semantic versioning for tags**
4. **Monitor resource usage and adjust limits**
5. **Implement proper health checks**
6. **Use secrets for sensitive data**
7. **Regular backups for databases**

## 🔗 Related Documentation

- [Complete Deployment Guide](COMPLETE-DEPLOYMENT-GUIDE.md)
- [Quick Start Guide](QUICK-START.md)
- [Web UI Integration](README-WEBAPP.md)