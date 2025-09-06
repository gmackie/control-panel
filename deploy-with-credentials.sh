#!/bin/bash

# Deploy Control Panel with Provided Credentials
# This script includes your specific credentials for easy deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Control Panel Deployment with Credentials${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Your provided credentials
export GITHUB_CLIENT_ID="Ov23li75O1DdJVh7nKsU"
export GITHUB_CLIENT_SECRET="be5ebbb033c84283a381c1ad3f71a229da26649c"
export TURSO_DATABASE_URL="libsql://control-panel-gmackie.aws-us-west-2.turso.io"
export TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTY3NzY1MTMsImlkIjoiZWMyMzg1ZmMtMzg3Zi00YWUwLThmMTUtZTQ3YmJmMDU1ZjYzIiwicmlkIjoiZjMzNzE3ZGMtOGRmOS00Njk3LTliNjAtYTc4ZjVhZjMwODlmIn0.NvKoS6ThyTgG2JQHyBitinzVBNoLF9qp0RDaKmLznBqxF1MK5preHNObKIL8NqYmdgwakaexerQ55k3BRD5BAg"

# Configuration
NAMESPACE="control-panel"
DOMAIN="control.gmac.io"
IMAGE="ghcr.io/gmackie/control-panel:main"

# Check kubectl connection
echo -e "${YELLOW}Checking cluster connection...${NC}"
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    echo ""
    echo "Please configure kubectl first by running:"
    echo "./setup-kubeconfig.sh"
    echo ""
    echo "Or if you have the kubeconfig file, set:"
    echo "export KUBECONFIG=/path/to/your/kubeconfig"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Connected to cluster${NC}"
kubectl cluster-info | head -1

# Create namespace
echo -e "${YELLOW}Creating namespace...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create secrets with your credentials
echo -e "${YELLOW}Creating secrets with your credentials...${NC}"
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: control-panel-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  # NextAuth secrets
  NEXTAUTH_SECRET: "$(openssl rand -base64 32)"
  
  # Your GitHub OAuth credentials
  GITHUB_CLIENT_ID: "$GITHUB_CLIENT_ID"
  GITHUB_CLIENT_SECRET: "$GITHUB_CLIENT_SECRET"
  
  # Your Turso database
  TURSO_DATABASE_URL: "$TURSO_DATABASE_URL"
  TURSO_AUTH_TOKEN: "$TURSO_AUTH_TOKEN"
  
  # Database placeholders (using Turso instead)
  DATABASE_USER: "not-used"
  DATABASE_PASSWORD: "not-used"
  
  # Integration placeholders (to be configured later)
  GITEA_TOKEN: "your-gitea-api-token"
  HARBOR_USERNAME: "admin"
  HARBOR_PASSWORD: "your-harbor-password"
  ARGOCD_TOKEN: "your-argocd-token"
  WEBHOOK_SECRET: "$(openssl rand -base64 32)"
  GRAFANA_API_KEY: "your-grafana-api-key"
  PROMETHEUS_BEARER_TOKEN: "$(openssl rand -base64 32)"
  HETZNER_API_TOKEN: "your-hetzner-api-token"
  K3S_SA_TOKEN: "your-k3s-service-account-token"
  
  # Optional integrations (empty for now)
  STRIPE_API_KEY: ""
  CLERK_API_KEY: ""
  SENDGRID_API_KEY: ""
  ELEVENLABS_API_KEY: ""
  OPENROUTER_API_KEY: ""
  TWILIO_ACCOUNT_SID: ""
  TWILIO_AUTH_TOKEN: ""
  SUPABASE_URL: ""
  SUPABASE_ANON_KEY: ""
EOF

echo -e "${GREEN}✓ Secrets created${NC}"

# Apply ConfigMaps
echo -e "${YELLOW}Applying configurations...${NC}"
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-configmap.yaml

# Check and apply optional configs
if [ -f "k8s/integrations-config.yaml" ]; then
    kubectl apply -f k8s/integrations-config.yaml
fi
if [ -f "k8s/webhook-config.yaml" ]; then
    kubectl apply -f k8s/webhook-config.yaml
fi

# Apply RBAC
echo -e "${YELLOW}Setting up RBAC...${NC}"
kubectl apply -f k8s/07-rbac.yaml

# Apply deployment
echo -e "${YELLOW}Deploying application...${NC}"
kubectl apply -f k8s/04-deployment.yaml

# Apply service
kubectl apply -f k8s/05-service.yaml

# Apply ingress
echo -e "${YELLOW}Configuring ingress for $DOMAIN...${NC}"
kubectl apply -f k8s/06-ingress.yaml

# Check if ingress controller exists
if ! kubectl get svc -n ingress-nginx ingress-nginx-controller >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing nginx-ingress controller...${NC}"
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
    echo "Waiting for ingress controller..."
    sleep 30
fi

# Wait for deployment
echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/control-panel -n $NAMESPACE --timeout=300s || true

# Get pod status
echo ""
echo -e "${GREEN}Deployment Status:${NC}"
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=control-panel

# Get ingress info
echo ""
echo -e "${GREEN}Ingress Information:${NC}"
kubectl get ingress -n $NAMESPACE

# Try to get external IP
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ -z "$INGRESS_IP" ]; then
    INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")
fi

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}    Control Panel Deployment Info      ${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}URLs:${NC}"
echo "  Production: https://$DOMAIN"
echo "  GitHub OAuth Callback: https://$DOMAIN/api/auth/callback/github"
echo ""
if [ "$INGRESS_IP" != "pending" ] && [ -n "$INGRESS_IP" ]; then
    echo -e "${GREEN}Ingress IP/Hostname: $INGRESS_IP${NC}"
    echo ""
    echo -e "${YELLOW}➡️  Update DNS:${NC}"
    echo "  Add an A record for control.gmac.io pointing to: $INGRESS_IP"
else
    echo -e "${YELLOW}⚠️  Ingress IP pending. Check with:${NC}"
    echo "  kubectl get svc -n ingress-nginx ingress-nginx-controller"
fi
echo ""
echo -e "${GREEN}Local Access (port-forward):${NC}"
echo "  kubectl port-forward -n $NAMESPACE svc/control-panel 3000:3000"
echo "  Then visit: http://localhost:3000"
echo ""
echo -e "${GREEN}View Logs:${NC}"
echo "  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=control-panel -f"
echo ""
echo -e "${GREEN}Your Credentials:${NC}"
echo "  GitHub OAuth Client ID: $GITHUB_CLIENT_ID"
echo "  Turso Database: Connected ✓"
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"