#!/bin/bash

# Setup script for Control Panel integrations with Gitea, Harbor, ArgoCD, and K3s clusters
# This script configures all necessary secrets and configurations for the control panel

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Control Panel Integration Setup${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

# Function to prompt for input with default
prompt_with_default() {
    local prompt=$1
    local default=$2
    local var_name=$3
    
    echo -ne "${YELLOW}$prompt [$default]: ${NC}"
    read input
    if [ -z "$input" ]; then
        eval "$var_name='$default'"
    else
        eval "$var_name='$input'"
    fi
}

# Function to prompt for secret input
prompt_secret() {
    local prompt=$1
    local var_name=$2
    
    echo -ne "${YELLOW}$prompt: ${NC}"
    read -s input
    echo ""
    eval "$var_name='$input'"
}

echo -e "${GREEN}Step 1: Gitea Configuration${NC}"
echo "Configure your self-hosted Gitea instance"
prompt_with_default "Gitea URL" "https://git.gmac.io" GITEA_URL
prompt_with_default "Gitea Organization" "gmackie" GITEA_ORG
prompt_secret "Gitea API Token" GITEA_TOKEN

echo ""
echo -e "${GREEN}Step 2: Harbor Registry Configuration${NC}"
echo "Configure your Harbor container registry"
prompt_with_default "Harbor URL" "https://harbor.gmac.io" HARBOR_URL
prompt_with_default "Harbor Project" "gmac" HARBOR_PROJECT
prompt_with_default "Harbor Username" "admin" HARBOR_USERNAME
prompt_secret "Harbor Password" HARBOR_PASSWORD

echo ""
echo -e "${GREEN}Step 3: ArgoCD Configuration${NC}"
echo "Configure your ArgoCD GitOps platform"
prompt_with_default "ArgoCD Server" "https://argocd.gmac.io" ARGOCD_SERVER
prompt_secret "ArgoCD API Token" ARGOCD_TOKEN

echo ""
echo -e "${GREEN}Step 4: Staging K3s Cluster${NC}"
echo "Configure your staging K3s cluster"
prompt_with_default "Staging Cluster API Server" "https://staging.k3s.gmac.io:6443" STAGING_K8S_API_SERVER
prompt_secret "Staging Service Account Token" STAGING_K3S_SA_TOKEN

echo ""
echo -e "${GREEN}Step 5: Production K3s Cluster${NC}"
echo "Configure your production K3s cluster"
prompt_with_default "Production Cluster API Server" "https://prod.k3s.gmac.io:6443" PROD_K8S_API_SERVER
prompt_secret "Production Service Account Token" PROD_K3S_SA_TOKEN

echo ""
echo -e "${GREEN}Step 6: Additional Integrations (Optional)${NC}"
echo "Configure optional monitoring and observability tools"
prompt_with_default "Prometheus URL" "https://prometheus.gmac.io" PROMETHEUS_URL
prompt_with_default "Grafana URL" "https://grafana.gmac.io" GRAFANA_URL
prompt_secret "Grafana API Key (or press Enter to skip)" GRAFANA_API_KEY

echo ""
echo -e "${GREEN}Step 7: Webhook Configuration${NC}"
echo "Configure webhook secrets for CI/CD integrations"
WEBHOOK_SECRET=$(openssl rand -base64 32)
echo -e "Generated webhook secret: ${YELLOW}$WEBHOOK_SECRET${NC}"

# Create local .env file
echo ""
echo -e "${YELLOW}Creating .env.local file...${NC}"
cat > .env.local <<EOF
# Gitea Configuration
GITEA_URL=$GITEA_URL
GITEA_ORG=$GITEA_ORG
GITEA_TOKEN=$GITEA_TOKEN

# Harbor Registry
HARBOR_URL=$HARBOR_URL
HARBOR_PROJECT=$HARBOR_PROJECT
HARBOR_USERNAME=$HARBOR_USERNAME
HARBOR_PASSWORD=$HARBOR_PASSWORD

# ArgoCD
ARGOCD_SERVER=$ARGOCD_SERVER
ARGOCD_TOKEN=$ARGOCD_TOKEN

# Staging K3s Cluster
STAGING_K8S_API_SERVER=$STAGING_K8S_API_SERVER
STAGING_K3S_SA_TOKEN=$STAGING_K3S_SA_TOKEN

# Production K3s Cluster
PROD_K8S_API_SERVER=$PROD_K8S_API_SERVER
PROD_K3S_SA_TOKEN=$PROD_K3S_SA_TOKEN

# Monitoring
PROMETHEUS_URL=$PROMETHEUS_URL
GRAFANA_URL=$GRAFANA_URL
GRAFANA_API_KEY=$GRAFANA_API_KEY

# Webhooks
WEBHOOK_SECRET=$WEBHOOK_SECRET

# Existing configurations (preserve)
$(grep -E "^(TURSO_|GITHUB_|NEXTAUTH_|HETZNER_|STRIPE_|CLERK_)" .env.local 2>/dev/null || true)
EOF

echo -e "${GREEN}✓ Created .env.local${NC}"

# Update Kubernetes secrets if connected to cluster
echo ""
echo -e "${YELLOW}Updating Kubernetes secrets...${NC}"

# Check if kubectl is configured
if kubectl cluster-info --insecure-skip-tls-verify >/dev/null 2>&1; then
    # Create updated secrets
    cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: Secret
metadata:
  name: control-panel-integrations
  namespace: control-panel
type: Opaque
stringData:
  # Gitea
  GITEA_URL: "$GITEA_URL"
  GITEA_ORG: "$GITEA_ORG"
  GITEA_TOKEN: "$GITEA_TOKEN"
  
  # Harbor
  HARBOR_URL: "$HARBOR_URL"
  HARBOR_PROJECT: "$HARBOR_PROJECT"
  HARBOR_USERNAME: "$HARBOR_USERNAME"
  HARBOR_PASSWORD: "$HARBOR_PASSWORD"
  
  # ArgoCD
  ARGOCD_SERVER: "$ARGOCD_SERVER"
  ARGOCD_TOKEN: "$ARGOCD_TOKEN"
  
  # K3s Clusters
  STAGING_K8S_API_SERVER: "$STAGING_K8S_API_SERVER"
  STAGING_K3S_SA_TOKEN: "$STAGING_K3S_SA_TOKEN"
  PROD_K8S_API_SERVER: "$PROD_K8S_API_SERVER"
  PROD_K3S_SA_TOKEN: "$PROD_K3S_SA_TOKEN"
  
  # Monitoring
  PROMETHEUS_URL: "$PROMETHEUS_URL"
  GRAFANA_URL: "$GRAFANA_URL"
  GRAFANA_API_KEY: "$GRAFANA_API_KEY"
  
  # Webhooks
  WEBHOOK_SECRET: "$WEBHOOK_SECRET"
EOF
    
    echo -e "${GREEN}✓ Updated Kubernetes secrets${NC}"
    
    # Update ConfigMaps
    cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: ConfigMap
metadata:
  name: control-panel-integrations
  namespace: control-panel
data:
  GITEA_URL: "$GITEA_URL"
  GITEA_ORG: "$GITEA_ORG"
  HARBOR_URL: "$HARBOR_URL"
  HARBOR_PROJECT: "$HARBOR_PROJECT"
  ARGOCD_SERVER: "$ARGOCD_SERVER"
  STAGING_K8S_API_SERVER: "$STAGING_K8S_API_SERVER"
  PROD_K8S_API_SERVER: "$PROD_K8S_API_SERVER"
  PROMETHEUS_URL: "$PROMETHEUS_URL"
  GRAFANA_URL: "$GRAFANA_URL"
EOF
    
    echo -e "${GREEN}✓ Updated ConfigMaps${NC}"
    
    # Restart deployment to pick up new configuration
    echo -e "${YELLOW}Restarting control panel deployment...${NC}"
    kubectl rollout restart deployment/control-panel -n control-panel --insecure-skip-tls-verify
    
else
    echo -e "${YELLOW}⚠ Kubernetes cluster not accessible. Skipping cluster updates.${NC}"
    echo "Run this script again when connected to update the cluster."
fi

# Create webhook endpoints configuration
echo ""
echo -e "${YELLOW}Creating webhook configuration file...${NC}"
cat > webhook-endpoints.yaml <<EOF
# Webhook Endpoints for Control Panel Integrations
apiVersion: v1
kind: ConfigMap
metadata:
  name: webhook-endpoints
  namespace: control-panel
data:
  gitea: |
    endpoint: /api/webhooks/gitea
    secret: $WEBHOOK_SECRET
    events:
      - push
      - pull_request
      - repository
      - release
  
  harbor: |
    endpoint: /api/webhooks/harbor
    secret: $WEBHOOK_SECRET
    events:
      - push_artifact
      - pull_artifact
      - delete_artifact
      - scanning_completed
  
  argocd: |
    endpoint: /api/webhooks/argocd
    secret: $WEBHOOK_SECRET
    events:
      - app_created
      - app_updated
      - app_deleted
      - app_health_degraded
      - app_sync_running
      - app_sync_succeeded
      - app_sync_failed
  
  prometheus: |
    endpoint: /api/webhooks/prometheus/alerts
    secret: $WEBHOOK_SECRET
EOF

echo -e "${GREEN}✓ Created webhook-endpoints.yaml${NC}"

# Create multi-cluster configuration
echo ""
echo -e "${YELLOW}Creating multi-cluster configuration...${NC}"
cat > multi-cluster-config.yaml <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: multi-cluster-config
  namespace: control-panel
data:
  clusters.yaml: |
    clusters:
      - name: staging
        type: k3s
        apiServer: $STAGING_K8S_API_SERVER
        context: staging-k3s
        environment: staging
        region: us-west-2
        provider: hetzner
        features:
          - gitops
          - monitoring
          - ingress
      
      - name: production
        type: k3s
        apiServer: $PROD_K8S_API_SERVER
        context: prod-k3s
        environment: production
        region: us-east-1
        provider: hetzner
        features:
          - gitops
          - monitoring
          - ingress
          - backup
          - high-availability
    
    registries:
      - name: harbor
        url: $HARBOR_URL
        type: harbor
        project: $HARBOR_PROJECT
      
      - name: ghcr
        url: ghcr.io
        type: github
        namespace: gmackie
    
    gitops:
      provider: argocd
      server: $ARGOCD_SERVER
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
EOF

if kubectl cluster-info --insecure-skip-tls-verify >/dev/null 2>&1; then
    kubectl apply -f multi-cluster-config.yaml --insecure-skip-tls-verify
    echo -e "${GREEN}✓ Applied multi-cluster configuration${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Integration Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Configured Integrations:${NC}"
echo "  • Gitea:     $GITEA_URL"
echo "  • Harbor:    $HARBOR_URL"
echo "  • ArgoCD:    $ARGOCD_SERVER"
echo "  • Staging:   $STAGING_K8S_API_SERVER"
echo "  • Production: $PROD_K8S_API_SERVER"
echo ""
echo -e "${YELLOW}Webhook Endpoints:${NC}"
echo "  • Gitea:     https://control.gmac.io/api/webhooks/gitea"
echo "  • Harbor:    https://control.gmac.io/api/webhooks/harbor"
echo "  • ArgoCD:    https://control.gmac.io/api/webhooks/argocd"
echo "  • Prometheus: https://control.gmac.io/api/webhooks/prometheus/alerts"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Configure webhooks in each service pointing to the endpoints above"
echo "2. Use the webhook secret: $WEBHOOK_SECRET"
echo "3. Deploy the control panel: ./deploy-gmac-cluster.sh"
echo "4. Access at: https://control.gmac.io"
echo ""
echo -e "${GREEN}Files created:${NC}"
echo "  • .env.local"
echo "  • webhook-endpoints.yaml"
echo "  • multi-cluster-config.yaml"