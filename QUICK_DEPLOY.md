# Quick Deployment Guide for control.gmac.io

## Prerequisites

- Access to your Kubernetes/K3s cluster
- kubectl installed locally
- Your cluster's kubeconfig file

## Step 1: Configure kubectl

Run the setup script to configure kubectl to connect to your cluster:

```bash
./setup-kubeconfig.sh
```

This will guide you through:
- Connecting to a K3s cluster via SSH
- Or configuring access to GKE/EKS/AKS
- Or using a local cluster

## Step 2: Set Environment Variables (Optional)

Export your actual API keys and tokens:

```bash
# Required for authentication
export GITHUB_CLIENT_ID="your-github-oauth-client-id"
export GITHUB_CLIENT_SECRET="your-github-oauth-client-secret"

# Required for database
export TURSO_DATABASE_URL="libsql://your-database.turso.io"
export TURSO_AUTH_TOKEN="your-turso-auth-token"

# For infrastructure management
export HETZNER_API_TOKEN="your-hetzner-api-token"
export GITEA_TOKEN="your-gitea-api-token"
export HARBOR_PASSWORD="your-harbor-password"
export ARGOCD_TOKEN="your-argocd-token"

# Optional integrations
export STRIPE_API_KEY="your-stripe-api-key"
export CLERK_API_KEY="your-clerk-api-key"
```

## Step 3: Deploy to Cluster

Run the deployment script:

```bash
./deploy-to-cluster.sh
```

This will:
1. Create the `control-panel` namespace
2. Generate and apply secrets
3. Deploy the application
4. Configure ingress for control.gmac.io
5. Wait for the deployment to be ready

## Step 4: Configure DNS

Point your domain `control.gmac.io` to your cluster's ingress IP:

```bash
# Get the ingress IP
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

Add an A record in your DNS provider:
- Name: `control`
- Type: `A`
- Value: `<your-ingress-ip>`

## Step 5: Configure GitHub OAuth

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App:
   - Application name: `Control Panel`
   - Homepage URL: `https://control.gmac.io`
   - Authorization callback URL: `https://control.gmac.io/api/auth/callback/github`
3. Copy the Client ID and Client Secret
4. Update the secrets:

```bash
kubectl edit secret control-panel-secrets -n control-panel
# Update GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (base64 encoded)
```

## Step 6: Access the Application

Once DNS propagates (usually within minutes):

```bash
# Open in browser
open https://control.gmac.io
```

Or access locally via port-forward:

```bash
kubectl port-forward -n control-panel svc/control-panel 3000:3000
open http://localhost:3000
```

## Monitoring

View logs:
```bash
kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel -f
```

Check pod status:
```bash
kubectl get pods -n control-panel
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod -n control-panel <pod-name>
kubectl logs -n control-panel <pod-name>
```

### Ingress not working
```bash
# Check ingress status
kubectl get ingress -n control-panel

# Check ingress controller
kubectl get pods -n ingress-nginx
```

### SSL Certificate issues
```bash
# Check cert-manager
kubectl get certificates -n control-panel
kubectl describe certificate control-panel-tls -n control-panel
```

## Full Stack Deployment (Optional)

To deploy with ArgoCD, Prometheus, and Grafana:

```bash
./deploy-full-stack.sh
```

This will set up:
- ArgoCD for GitOps
- Prometheus for metrics
- Grafana for dashboards
- AlertManager for notifications

## Support

For issues or questions:
- Check logs: `kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel`
- View events: `kubectl get events -n control-panel --sort-by='.lastTimestamp'`
- GitHub Issues: https://github.com/gmackie/control-panel/issues