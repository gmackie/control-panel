#!/bin/bash

# Deploy Control Panel to Kubernetes Cluster
# This script configures and deploys the control panel to control.gmac.io

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Control Panel Kubernetes Deployment${NC}"
echo -e "${BLUE}=====================================>${NC}"
echo ""

# Configuration
NAMESPACE="control-panel"
DOMAIN="control.gmac.io"
IMAGE="ghcr.io/gmackie/control-panel:main"

# Check if kubeconfig is provided
if [ -z "$KUBECONFIG" ]; then
    echo -e "${YELLOW}⚠️  KUBECONFIG not set. Please provide your kubeconfig:${NC}"
    echo ""
    echo "Options:"
    echo "1. Set KUBECONFIG environment variable:"
    echo "   export KUBECONFIG=/path/to/your/kubeconfig"
    echo ""
    echo "2. Or copy your kubeconfig to ~/.kube/config"
    echo ""
    echo "3. If using K3s on a remote server, you can get it with:"
    echo "   ssh user@your-server 'sudo cat /etc/rancher/k3s/k3s.yaml'"
    echo ""
    exit 1
fi

# Test cluster connection
echo -e "${YELLOW}Testing cluster connection...${NC}"
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    echo "Please ensure your kubeconfig is valid and the cluster is accessible"
    exit 1
fi

echo -e "${GREEN}✓ Connected to cluster${NC}"
kubectl cluster-info | head -1

# Create namespace
echo -e "${YELLOW}Creating namespace...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create secrets from environment or use defaults
echo -e "${YELLOW}Creating secrets...${NC}"
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: control-panel-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  # NextAuth secrets
  NEXTAUTH_SECRET: "${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}"
  
  # GitHub OAuth (required for authentication)
  GITHUB_CLIENT_ID: "${GITHUB_CLIENT_ID:-your-github-client-id}"
  GITHUB_CLIENT_SECRET: "${GITHUB_CLIENT_SECRET:-your-github-client-secret}"
  
  # Database (using Turso)
  TURSO_DATABASE_URL: "${TURSO_DATABASE_URL:-libsql://your-database.turso.io}"
  TURSO_AUTH_TOKEN: "${TURSO_AUTH_TOKEN:-your-turso-auth-token}"
  
  # Gitea Integration
  GITEA_TOKEN: "${GITEA_TOKEN:-your-gitea-api-token}"
  
  # Harbor Integration  
  HARBOR_USERNAME: "${HARBOR_USERNAME:-admin}"
  HARBOR_PASSWORD: "${HARBOR_PASSWORD:-your-harbor-password}"
  
  # ArgoCD Integration
  ARGOCD_TOKEN: "${ARGOCD_TOKEN:-your-argocd-token}"
  
  # Webhook Secret
  WEBHOOK_SECRET: "${WEBHOOK_SECRET:-$(openssl rand -base64 32)}"
  
  # Monitoring
  GRAFANA_API_KEY: "${GRAFANA_API_KEY:-your-grafana-api-key}"
  PROMETHEUS_BEARER_TOKEN: "${PROMETHEUS_BEARER_TOKEN:-$(openssl rand -base64 32)}"
  
  # Hetzner (for cluster management)
  HETZNER_API_TOKEN: "${HETZNER_API_TOKEN:-your-hetzner-api-token}"
  K3S_SA_TOKEN: "${K3S_SA_TOKEN:-your-k3s-service-account-token}"
  
  # Optional integrations
  STRIPE_API_KEY: "${STRIPE_API_KEY:-}"
  CLERK_API_KEY: "${CLERK_API_KEY:-}"
  SENDGRID_API_KEY: "${SENDGRID_API_KEY:-}"
  ELEVENLABS_API_KEY: "${ELEVENLABS_API_KEY:-}"
  OPENROUTER_API_KEY: "${OPENROUTER_API_KEY:-}"
EOF

# Apply ConfigMaps
echo -e "${YELLOW}Applying configurations...${NC}"
kubectl apply -f k8s/02-configmap.yaml
kubectl apply -f k8s/integrations-config.yaml 2>/dev/null || true
kubectl apply -f k8s/webhook-config.yaml 2>/dev/null || true

# Apply RBAC
echo -e "${YELLOW}Setting up RBAC...${NC}"
kubectl apply -f k8s/07-rbac.yaml

# Update and apply deployment
echo -e "${YELLOW}Deploying application...${NC}"
# Update the deployment with the correct image
sed "s|image: ghcr.io/gmackie/control-panel:main|image: $IMAGE|g" k8s/04-deployment.yaml | kubectl apply -f -

# Apply service
kubectl apply -f k8s/05-service.yaml

# Create or update ingress with the correct domain
echo -e "${YELLOW}Configuring ingress for $DOMAIN...${NC}"
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: control-panel
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
spec:
  tls:
  - hosts:
    - $DOMAIN
    secretName: control-panel-tls
  rules:
  - host: $DOMAIN
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: control-panel
            port:
              number: 3000
EOF

# Wait for deployment
echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/control-panel -n $NAMESPACE --timeout=300s

# Get pod status
echo -e "${YELLOW}Checking pod status...${NC}"
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=control-panel

# Check if ingress controller is installed
echo -e "${YELLOW}Checking ingress controller...${NC}"
if kubectl get svc -n ingress-nginx ingress-nginx-controller >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Ingress controller found${NC}"
    INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    if [ "$INGRESS_IP" != "pending" ] && [ -n "$INGRESS_IP" ]; then
        echo -e "${GREEN}Ingress IP: $INGRESS_IP${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No ingress controller found. Installing nginx-ingress...${NC}"
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
    echo "Waiting for ingress controller to be ready..."
    kubectl wait --namespace ingress-nginx \
      --for=condition=ready pod \
      --selector=app.kubernetes.io/component=controller \
      --timeout=300s
fi

# Check if cert-manager is installed
echo -e "${YELLOW}Checking cert-manager...${NC}"
if kubectl get namespace cert-manager >/dev/null 2>&1; then
    echo -e "${GREEN}✓ cert-manager found${NC}"
else
    echo -e "${YELLOW}⚠️  cert-manager not found. To enable automatic SSL:${NC}"
    echo "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml"
fi

# Display deployment information
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}Service Information:${NC}"
echo "================================="
echo -e "Control Panel URL: ${GREEN}https://$DOMAIN${NC}"
echo ""

# Get service details
echo -e "${YELLOW}Service Endpoints:${NC}"
kubectl get ingress -n $NAMESPACE control-panel -o wide

echo ""
echo -e "${YELLOW}Pod Status:${NC}"
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=control-panel -o wide

echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo "kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=control-panel -f"

echo ""
echo -e "${YELLOW}To access locally via port-forward:${NC}"
echo "kubectl port-forward -n $NAMESPACE svc/control-panel 3000:3000"
echo "Then visit: http://localhost:3000"

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update DNS record for $DOMAIN to point to your ingress IP"
echo "2. Configure GitHub OAuth app with callback URL: https://$DOMAIN/api/auth/callback/github"
echo "3. Update environment secrets with actual values"
echo "4. Configure webhooks in external services"

echo ""
echo -e "${BLUE}For monitoring setup, run:${NC}"
echo "./deploy-full-stack.sh"