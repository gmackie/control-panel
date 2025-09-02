#!/bin/bash

# Deploy Control Panel to GMAC.IO Cluster
# This script includes your specific credentials and deploys to control.gmac.io

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying Control Panel to control.gmac.io${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check cluster connection
echo -e "${YELLOW}Testing cluster connection...${NC}"

# Try both kubeconfig files
KUBECONFIG_FILES=(
    "$HOME/.kube/config-hetzner"
    "$HOME/.kube/k3s-gmac.yaml"
    "$HOME/.kube/gmac-k3s.yaml"
)

WORKING_CONFIG=""
for config in "${KUBECONFIG_FILES[@]}"; do
    if [ -f "$config" ]; then
        echo "Testing $config..."
        export KUBECONFIG="$config"
        if kubectl cluster-info --insecure-skip-tls-verify --request-timeout=5s >/dev/null 2>&1; then
            WORKING_CONFIG="$config"
            echo -e "${GREEN}✓ Connected using $config${NC}"
            break
        else
            echo -e "${RED}✗ Cannot connect with $config${NC}"
        fi
    fi
done

if [ -z "$WORKING_CONFIG" ]; then
    echo -e "${RED}❌ Cannot connect to any Kubernetes cluster${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check if your cluster is running"
    echo "2. Verify network connectivity"
    echo "3. Check if cluster IP has changed"
    echo "4. Ensure firewall allows access"
    echo ""
    echo "You can also run this later when the cluster is accessible."
    exit 1
fi

export KUBECONFIG="$WORKING_CONFIG"
echo -e "${GREEN}Using kubeconfig: $WORKING_CONFIG${NC}"

# Configuration
NAMESPACE="control-panel"
DOMAIN="control.gmac.io"

# Your credentials
GITHUB_CLIENT_ID="Ov23li75O1DdJVh7nKsU"
GITHUB_CLIENT_SECRET="be5ebbb033c84283a381c1ad3f71a229da26649c"
TURSO_DATABASE_URL="libsql://control-panel-gmackie.aws-us-west-2.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTY3NzY1MTMsImlkIjoiZWMyMzg1ZmMtMzg3Zi00YWUwLThmMTUtZTQ3YmJmMDU1ZjYzIiwicmlkIjoiZjMzNzE3ZGMtOGRmOS00Njk3LTliNjAtYTc4ZjVhZjMwODlmIn0.NvKoS6ThyTgG2JQHyBitinzVBNoLF9qp0RDaKmLznBqxF1MK5preHNObKIL8NqYmdgwakaexerQ55k3BRD5BAg"

echo -e "${YELLOW}Step 1: Creating namespace...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - --insecure-skip-tls-verify

echo -e "${YELLOW}Step 2: Creating secrets...${NC}"
cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: Secret
metadata:
  name: control-panel-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  # NextAuth
  NEXTAUTH_SECRET: "$(openssl rand -base64 32)"
  
  # Your GitHub OAuth
  GITHUB_CLIENT_ID: "$GITHUB_CLIENT_ID"
  GITHUB_CLIENT_SECRET: "$GITHUB_CLIENT_SECRET"
  
  # Your Turso Database
  TURSO_DATABASE_URL: "$TURSO_DATABASE_URL"
  TURSO_AUTH_TOKEN: "$TURSO_AUTH_TOKEN"
  
  # Required placeholders
  DATABASE_USER: "not-used-with-turso"
  DATABASE_PASSWORD: "not-used-with-turso"
  DRONE_TOKEN: "placeholder"
  GITEA_TOKEN: "placeholder"
  HARBOR_USERNAME: "admin"
  HARBOR_PASSWORD: "placeholder"
  ARGOCD_TOKEN: "placeholder"
  WEBHOOK_SECRET: "$(openssl rand -base64 32)"
  GRAFANA_API_KEY: "placeholder"
  PROMETHEUS_BEARER_TOKEN: "$(openssl rand -base64 32)"
  HETZNER_API_TOKEN: "placeholder"
  K3S_SA_TOKEN: "placeholder"
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

echo -e "${YELLOW}Step 3: Applying configurations...${NC}"
kubectl apply -f k8s/01-namespace.yaml --insecure-skip-tls-verify
kubectl apply -f k8s/02-configmap.yaml --insecure-skip-tls-verify
kubectl apply -f k8s/integrations-config.yaml --insecure-skip-tls-verify 2>/dev/null || true
kubectl apply -f k8s/webhook-config.yaml --insecure-skip-tls-verify 2>/dev/null || true

echo -e "${YELLOW}Step 4: Setting up RBAC...${NC}"
kubectl apply -f k8s/07-rbac.yaml --insecure-skip-tls-verify

echo -e "${YELLOW}Step 5: Deploying application...${NC}"
# Delete existing deployment if it exists
kubectl delete deployment control-panel -n $NAMESPACE --insecure-skip-tls-verify --ignore-not-found=true
sleep 5

# Deploy fresh
kubectl apply -f k8s/04-deployment.yaml --insecure-skip-tls-verify
kubectl apply -f k8s/05-service.yaml --insecure-skip-tls-verify

echo -e "${YELLOW}Step 6: Configuring ingress...${NC}"
# Create a simplified ingress without SSL for now
cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: control-panel
  namespace: control-panel
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  rules:
  - host: control.gmac.io
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

echo -e "${YELLOW}Step 7: Waiting for deployment...${NC}"
kubectl rollout status deployment/control-panel -n $NAMESPACE --timeout=300s --insecure-skip-tls-verify || true

echo ""
echo -e "${GREEN}Checking deployment status...${NC}"
kubectl get pods -n $NAMESPACE --insecure-skip-tls-verify

echo ""
echo -e "${GREEN}Checking ingress status...${NC}"
kubectl get ingress -n $NAMESPACE --insecure-skip-tls-verify

echo ""
echo -e "${GREEN}✅ Deployment script completed!${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  Production: http://control.gmac.io (once DNS is configured)"
echo "  Local: kubectl port-forward -n control-panel svc/control-panel 3000:3000"
echo ""
echo -e "${YELLOW}To check logs:${NC}"
echo "  kubectl logs -n control-panel -l app.kubernetes.io/name=control-panel -f --insecure-skip-tls-verify"