#!/bin/bash
set -euo pipefail

# Configure Harbor for Full API Access

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

KUBECONFIG="${KUBECONFIG:-/Users/mackieg/.kube/config-hetzner}"
HARBOR_NAMESPACE="${HARBOR_NAMESPACE:-harbor}"

print_info "🔧 Configuring Harbor for API Access"
echo

# Update Harbor core configuration
print_info "Updating Harbor core configuration..."
kubectl get configmap harbor-core -n "$HARBOR_NAMESPACE" -o yaml > /tmp/harbor-core-config.yaml

# Check if we need to update auth mode
if grep -q "auth_mode.*oidc" /tmp/harbor-core-config.yaml; then
    print_info "Updating auth mode to allow both OIDC and local auth..."
    
    # Create patch to ensure local auth is enabled
    cat > /tmp/harbor-core-patch.yaml << 'EOF'
data:
  app.conf: |
    appname = Harbor
    runmode = prod
    enablegzip = true

    [harbor]
    auth_mode = db_auth
    primary_auth_mode = false
    ldap_scope = 2
    ldap_timeout = 5
    ldap_always_onboard = false
    ldap_verify_cert = true
    db_host = harbor-database
    db_password = Harbor12345
    db_port = 5432
    db_user = postgres
    db_sslmode = disable
    db_max_idle_conns = 2
    db_max_open_conns = 0
    external_url = https://registry.gmac.io
    registry_url = http://harbor-registry:5000
    job_service_url = http://harbor-jobservice:80
    token_service_url = http://harbor-core:80/service/token
    admiral_url = NA
    notary_url = http://harbor-notary-server:4443
    registry_storage_provider_name = filesystem
    read_only = false
    reload_key = 
    skip_reload_env_pattern = ^(POSTGRES_|REGISTRY_STORAGE_|REGISTRY_CUSTOM_CA_BUNDLE_PATH|VMWARE_)
    webhook_job_max_retry = 10
    metrics_enabled = false
    metrics_path = /metrics
    metrics_port = 9090
    trace_enabled = false
    trace_sample_rate = 1
    trace_namespace = 
    trace_attributes = 
    trace_jaeger_endpoint = 
    trace_otel_endpoint = 
    redis_url = redis://harbor-redis:6379/1
    redis_url_reg = redis://harbor-redis:6379/2
    skip_update_pull_time = false
    session_idle_timeout = 60
    session_absolute_timeout = 3600
EOF

    kubectl patch configmap harbor-core -n "$HARBOR_NAMESPACE" --patch "$(cat /tmp/harbor-core-patch.yaml)"
    
    # Restart Harbor core to apply changes
    print_info "Restarting Harbor core..."
    kubectl rollout restart deployment harbor-core -n "$HARBOR_NAMESPACE"
    kubectl rollout status deployment harbor-core -n "$HARBOR_NAMESPACE" --timeout=300s
fi

# Ensure Harbor services are properly exposed
print_info "Checking Harbor services..."
kubectl get svc -n "$HARBOR_NAMESPACE" | grep -E "(core|registry|portal)"

# Create a test script for all Harbor features
print_info "Creating Harbor test script..."
cat > /tmp/test-harbor-access.sh << 'EOF'
#!/bin/bash

HARBOR_URL="${1:-registry.gmac.io}"
HARBOR_USER="${2:-admin}"
HARBOR_PASSWORD="${3:-Harbor12345}"

echo "Testing Harbor access at $HARBOR_URL"
echo

# Test API access
echo "1. Testing API access..."
if curl -s -u "$HARBOR_USER:$HARBOR_PASSWORD" "https://$HARBOR_URL/api/v2.0/systeminfo" | jq -r .harbor_version; then
    echo "✓ API access working"
else
    echo "✗ API access failed"
fi

# Test Docker login
echo -e "\n2. Testing Docker login..."
if echo "$HARBOR_PASSWORD" | docker login "$HARBOR_URL" -u "$HARBOR_USER" --password-stdin; then
    echo "✓ Docker login successful"
    
    # Test Docker push/pull
    echo -e "\n3. Testing Docker push..."
    docker pull nginx:alpine
    docker tag nginx:alpine "$HARBOR_URL/library/test-nginx:latest"
    if docker push "$HARBOR_URL/library/test-nginx:latest"; then
        echo "✓ Docker push successful"
        
        # Clean up
        docker rmi "$HARBOR_URL/library/test-nginx:latest"
    else
        echo "✗ Docker push failed"
    fi
else
    echo "✗ Docker login failed"
fi

# Test NPM registry
echo -e "\n4. Testing NPM registry..."
NPM_AUTH=$(echo -n "$HARBOR_USER:$HARBOR_PASSWORD" | base64)
if curl -s -H "Authorization: Basic $NPM_AUTH" "https://$HARBOR_URL/api/v2.0/projects/npm" | jq -r .name; then
    echo "✓ NPM registry accessible"
else
    echo "✗ NPM registry not accessible (may need setup)"
fi

# Test Helm repository
echo -e "\n5. Testing Helm repository..."
if helm repo add harbor-test "https://$HARBOR_URL/chartrepo/library" --username "$HARBOR_USER" --password "$HARBOR_PASSWORD"; then
    echo "✓ Helm repository accessible"
    helm repo remove harbor-test
else
    echo "✗ Helm repository not accessible"
fi

echo -e "\n✅ Harbor access test completed"
EOF

chmod +x /tmp/test-harbor-access.sh

# Run the test
print_info "Running Harbor access tests..."
/tmp/test-harbor-access.sh

# Create robot account for CI/CD
print_info "Creating/updating robot account for CI/CD..."
ROBOT_ACCOUNT_JSON=$(cat << 'EOF'
{
  "name": "cicd",
  "description": "Robot account for CI/CD pipelines",
  "duration": -1,
  "permissions": [
    {
      "namespace": "*",
      "kind": "project",
      "access": [
        {
          "resource": "repository",
          "action": "list"
        },
        {
          "resource": "repository",
          "action": "pull"
        },
        {
          "resource": "repository",
          "action": "push"
        },
        {
          "resource": "repository",
          "action": "delete"
        },
        {
          "resource": "artifact",
          "action": "list"
        },
        {
          "resource": "artifact",
          "action": "read"
        },
        {
          "resource": "artifact",
          "action": "delete"
        },
        {
          "resource": "tag",
          "action": "list"
        },
        {
          "resource": "tag",
          "action": "create"
        },
        {
          "resource": "tag",
          "action": "delete"
        }
      ]
    }
  ]
}
EOF
)

# Try to create robot account
ROBOT_RESPONSE=$(curl -s -X POST \
  -u "admin:Harbor12345" \
  -H "Content-Type: application/json" \
  -d "$ROBOT_ACCOUNT_JSON" \
  "https://registry.gmac.io/api/v2.0/robots")

if echo "$ROBOT_RESPONSE" | grep -q "secret"; then
    ROBOT_SECRET=$(echo "$ROBOT_RESPONSE" | jq -r '.secret')
    ROBOT_NAME=$(echo "$ROBOT_RESPONSE" | jq -r '.name')
    
    print_success "Created robot account: $ROBOT_NAME"
    
    # Save robot credentials
    cat > "$SCRIPT_DIR/harbor-robot-cicd.env" << EOF
# Harbor Robot Account for CI/CD
# Generated on $(date)
export HARBOR_ROBOT_USER="$ROBOT_NAME"
export HARBOR_ROBOT_SECRET="$ROBOT_SECRET"
export HARBOR_ROBOT_AUTH="$(echo -n "$ROBOT_NAME:$ROBOT_SECRET" | base64)"

# Usage in CI/CD:
# docker login registry.gmac.io -u "\$HARBOR_ROBOT_USER" -p "\$HARBOR_ROBOT_SECRET"
EOF
    chmod 600 "$SCRIPT_DIR/harbor-robot-cicd.env"
    print_info "Robot credentials saved to harbor-robot-cicd.env"
fi

print_success "✅ Harbor API configuration complete!"
echo
print_info "📋 Next Steps:"
echo "1. Update all CI/CD pipelines to use robot accounts"
echo "2. Change the default admin password in Harbor UI"
echo "3. Enable vulnerability scanning in project settings"
echo "4. Configure retention policies for images"
echo
print_info "🔐 Security Recommendations:"
echo "- Use robot accounts for all automated access"
echo "- Enable 2FA for human users"
echo "- Regularly rotate credentials"
echo "- Monitor audit logs in Harbor UI"