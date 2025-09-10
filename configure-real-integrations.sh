#!/bin/bash

# Configure Real Integration Credentials for Control Panel
# This script helps set up actual credentials for production integrations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Control Panel Real Integration Configuration${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Function to update a secret
update_secret() {
    local key=$1
    local value=$2
    local namespace="control-panel"
    
    if [ -z "$value" ]; then
        echo -e "${YELLOW}  ⚠ Skipping $key (no value provided)${NC}"
        return
    fi
    
    # Get current secret
    kubectl get secret control-panel-secrets -n $namespace --insecure-skip-tls-verify -o json > /tmp/secret.json
    
    # Update the specific key
    echo -n "$value" | base64 | xargs -I {} jq ".data.\"$key\" = \"{}\"" /tmp/secret.json > /tmp/secret-updated.json
    
    # Apply the updated secret
    kubectl apply -f /tmp/secret-updated.json --insecure-skip-tls-verify > /dev/null 2>&1
    
    echo -e "${GREEN}  ✓ Updated $key${NC}"
}

# Function to test an integration
test_integration() {
    local name=$1
    local endpoint=$2
    local expected_status=$3
    
    echo -e "${YELLOW}Testing $name...${NC}"
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}  ✓ $name is accessible (HTTP $status)${NC}"
        return 0
    else
        echo -e "${RED}  ✗ $name returned HTTP $status (expected $expected_status)${NC}"
        return 1
    fi
}

# Check cluster connection
echo -e "${YELLOW}Checking cluster connectivity...${NC}"
export KUBECONFIG=/Users/mackieg/.kube/config-hetzner

if ! kubectl cluster-info --insecure-skip-tls-verify >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected to cluster${NC}"
echo ""

# 1. Gitea Integration
echo -e "${BLUE}1. Gitea Integration${NC}"
echo -e "${BLUE}-------------------${NC}"

GITEA_URL=${GITEA_URL:-"https://git.gmac.io"}
echo "Gitea URL: $GITEA_URL"

if test_integration "Gitea" "$GITEA_URL/api/v1/version" "200"; then
    echo -e "${GREEN}  ✓ Gitea is reachable${NC}"
    
    # Check if we need to set up a token
    read -p "Do you have a Gitea API token? (y/n): " has_token
    if [ "$has_token" = "y" ]; then
        read -p "Enter Gitea API token: " gitea_token
        update_secret "GITEA_TOKEN" "$gitea_token"
        
        # Test the token
        if curl -s -H "Authorization: token $gitea_token" "$GITEA_URL/api/v1/user" | grep -q "username"; then
            echo -e "${GREEN}  ✓ Gitea token is valid${NC}"
        else
            echo -e "${RED}  ✗ Gitea token validation failed${NC}"
        fi
    fi
fi
echo ""

# 2. Harbor Integration
echo -e "${BLUE}2. Harbor Registry Integration${NC}"
echo -e "${BLUE}-----------------------------${NC}"

HARBOR_URL=${HARBOR_URL:-"https://registry.gmac.io"}
echo "Harbor URL: $HARBOR_URL"

if test_integration "Harbor" "$HARBOR_URL/api/v2.0/systeminfo" "200"; then
    echo -e "${GREEN}  ✓ Harbor is reachable${NC}"
    
    read -p "Do you have Harbor credentials? (y/n): " has_harbor
    if [ "$has_harbor" = "y" ]; then
        read -p "Enter Harbor username: " harbor_user
        read -sp "Enter Harbor password: " harbor_pass
        echo ""
        
        update_secret "HARBOR_USERNAME" "$harbor_user"
        update_secret "HARBOR_PASSWORD" "$harbor_pass"
        
        # Test Harbor login
        if curl -s -u "$harbor_user:$harbor_pass" "$HARBOR_URL/api/v2.0/users/current" | grep -q "username"; then
            echo -e "${GREEN}  ✓ Harbor credentials are valid${NC}"
        else
            echo -e "${RED}  ✗ Harbor credential validation failed${NC}"
        fi
    fi
fi
echo ""

# 3. ArgoCD Integration
echo -e "${BLUE}3. ArgoCD Integration${NC}"
echo -e "${BLUE}--------------------${NC}"

ARGOCD_URL=${ARGOCD_URL:-"https://argocd.gmac.io"}
echo "ArgoCD URL: $ARGOCD_URL"

if test_integration "ArgoCD" "$ARGOCD_URL/api/v1/session" "200"; then
    echo -e "${GREEN}  ✓ ArgoCD is reachable${NC}"
    
    read -p "Do you have an ArgoCD token? (y/n): " has_argo
    if [ "$has_argo" = "y" ]; then
        read -p "Enter ArgoCD token: " argo_token
        update_secret "ARGOCD_TOKEN" "$argo_token"
        
        # Test ArgoCD token
        if curl -s -H "Authorization: Bearer $argo_token" "$ARGOCD_URL/api/v1/applications" | grep -q "items"; then
            echo -e "${GREEN}  ✓ ArgoCD token is valid${NC}"
        else
            echo -e "${RED}  ✗ ArgoCD token validation failed${NC}"
        fi
    fi
fi
echo ""

# 4. Grafana Integration  
echo -e "${BLUE}4. Grafana Integration${NC}"
echo -e "${BLUE}---------------------${NC}"

GRAFANA_URL=${GRAFANA_URL:-"https://grafana.gmac.io"}
echo "Grafana URL: $GRAFANA_URL"

if test_integration "Grafana" "$GRAFANA_URL/api/health" "200"; then
    echo -e "${GREEN}  ✓ Grafana is reachable${NC}"
    
    read -p "Do you have a Grafana API key? (y/n): " has_grafana
    if [ "$has_grafana" = "y" ]; then
        read -p "Enter Grafana API key: " grafana_key
        update_secret "GRAFANA_API_KEY" "$grafana_key"
        
        # Test Grafana API key
        if curl -s -H "Authorization: Bearer $grafana_key" "$GRAFANA_URL/api/org" | grep -q "name"; then
            echo -e "${GREEN}  ✓ Grafana API key is valid${NC}"
        else
            echo -e "${RED}  ✗ Grafana API key validation failed${NC}"
        fi
    fi
fi
echo ""

# 5. Configure Webhooks
echo -e "${BLUE}5. Webhook Configuration${NC}"
echo -e "${BLUE}-----------------------${NC}"

WEBHOOK_ENDPOINT="https://control.gmac.io/api/webhooks"
echo "Webhook endpoint: $WEBHOOK_ENDPOINT"

# Generate webhook secret if not exists
WEBHOOK_SECRET=$(kubectl get secret control-panel-secrets -n control-panel --insecure-skip-tls-verify -o jsonpath='{.data.WEBHOOK_SECRET}' | base64 -d)
if [ -z "$WEBHOOK_SECRET" ] || [ "$WEBHOOK_SECRET" = "your-webhook-secret" ]; then
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    update_secret "WEBHOOK_SECRET" "$WEBHOOK_SECRET"
    echo -e "${GREEN}  ✓ Generated new webhook secret${NC}"
else
    echo -e "${GREEN}  ✓ Using existing webhook secret${NC}"
fi

echo ""
echo -e "${YELLOW}Webhook URLs for each service:${NC}"
echo "  • Gitea:      $WEBHOOK_ENDPOINT/gitea"
echo "  • Harbor:     $WEBHOOK_ENDPOINT/harbor"
echo "  • ArgoCD:     $WEBHOOK_ENDPOINT/argocd"
echo "  • Prometheus: $WEBHOOK_ENDPOINT/prometheus/alerts"
echo ""

# 6. Update ConfigMaps with actual URLs
echo -e "${BLUE}6. Updating Integration ConfigMaps${NC}"
echo -e "${BLUE}---------------------------------${NC}"

# Update control-panel-config with actual URLs
kubectl patch configmap control-panel-config -n control-panel --insecure-skip-tls-verify --type merge -p "{
  \"data\": {
    \"GITEA_URL\": \"$GITEA_URL\",
    \"HARBOR_URL\": \"$HARBOR_URL\",
    \"ARGOCD_SERVER\": \"$ARGOCD_URL\",
    \"PROMETHEUS_URL\": \"${PROMETHEUS_URL:-https://prometheus.gmac.io}\",
    \"GRAFANA_URL\": \"$GRAFANA_URL\"
  }
}" > /dev/null 2>&1

echo -e "${GREEN}  ✓ Updated integration URLs${NC}"

# 7. Restart deployment to apply changes
echo ""
echo -e "${YELLOW}Restarting control panel to apply changes...${NC}"
kubectl rollout restart deployment control-panel -n control-panel --insecure-skip-tls-verify > /dev/null 2>&1
echo -e "${GREEN}  ✓ Deployment restart initiated${NC}"

# Wait for rollout
echo -e "${YELLOW}Waiting for rollout to complete...${NC}"
kubectl rollout status deployment control-panel -n control-panel --insecure-skip-tls-verify --timeout=120s > /dev/null 2>&1 || true

# Summary
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}✅ Integration Configuration Complete!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check final pod status
echo -e "${YELLOW}Control Panel Pod Status:${NC}"
kubectl get pods -n control-panel -l app.kubernetes.io/name=control-panel --insecure-skip-tls-verify

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Configure webhooks in each service using the URLs above"
echo "2. Set up Prometheus scraping for your applications"
echo "3. Configure Loki log shipping from your applications"
echo "4. Create Grafana dashboards for each application"
echo "5. Test the monitoring dashboard at https://control.gmac.io/monitoring"
echo ""
echo -e "${GREEN}The control panel is now integrated with your infrastructure!${NC}"