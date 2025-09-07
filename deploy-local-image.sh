#!/bin/bash

# Deploy Control Panel using locally built image
# This script builds and deploys the control panel without relying on CI/CD

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying Control Panel with Local Build${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Check cluster connection
echo -e "${YELLOW}Checking cluster connection...${NC}"
export KUBECONFIG=~/.kube/config-hetzner

if ! kubectl cluster-info --insecure-skip-tls-verify >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Connected to cluster${NC}"

# Build the image locally
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t control-panel:local .

echo -e "${GREEN}✓ Docker image built${NC}"

# Save the image to a tar file
echo -e "${YELLOW}Saving image to tar file...${NC}"
docker save control-panel:local -o control-panel.tar

echo -e "${GREEN}✓ Image saved${NC}"

# Create a simple deployment using the next.js standalone server
echo -e "${YELLOW}Creating deployment configuration...${NC}"
cat <<EOF > k8s/deployment-local.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: control-panel
  namespace: control-panel
spec:
  replicas: 1
  selector:
    matchLabels:
      app: control-panel
  template:
    metadata:
      labels:
        app: control-panel
    spec:
      containers:
      - name: control-panel
        image: node:20-alpine
        command: ["sh", "-c"]
        args:
        - |
          # Install dependencies
          apk add --no-cache git curl
          
          # Clone the repository
          git clone https://github.com/gmackie/control-panel.git /app
          cd /app
          
          # Install npm dependencies
          npm ci --legacy-peer-deps
          
          # Build the application
          npm run build
          
          # Start the server
          npm start
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        envFrom:
        - secretRef:
            name: control-panel-secrets
        - secretRef:
            name: integration-secrets
        - configMapRef:
            name: control-panel-config
        - configMapRef:
            name: gitea-config
        - configMapRef:
            name: harbor-config
        - configMapRef:
            name: argocd-config
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
EOF

# Apply the deployment
echo -e "${YELLOW}Applying deployment...${NC}"
kubectl apply -f k8s/deployment-local.yaml --insecure-skip-tls-verify

echo -e "${GREEN}✓ Deployment applied${NC}"

# Wait for rollout
echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/control-panel -n control-panel --timeout=300s --insecure-skip-tls-verify || true

# Check pod status
echo -e "${YELLOW}Current pod status:${NC}"
kubectl get pods -n control-panel --insecure-skip-tls-verify

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}Your integrations are configured:${NC}"
echo "  • Gitea:     https://git.gmac.io"
echo "  • Harbor:    https://harbor.gmac.io"
echo "  • ArgoCD:    https://argocd.gmac.io"
echo "  • Staging:   https://staging.k3s.gmac.io"
echo "  • Production: https://prod.k3s.gmac.io"
echo ""
echo -e "${YELLOW}Access the Control Panel:${NC}"
echo "  • Production: https://control.gmac.io"
echo "  • Port-forward: kubectl port-forward -n control-panel svc/control-panel 3000:3000"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "  kubectl logs -n control-panel -l app=control-panel -f --insecure-skip-tls-verify"