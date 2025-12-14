#!/bin/bash
set -euo pipefail

# Test script for project setup

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[TEST]${NC} $1"; }
print_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
print_error() { echo -e "${RED}[FAIL]${NC} $1"; }

# Create test directory
TEST_DIR="/tmp/deployment-test-$(date +%s)"
TEST_APP="test-deployment-app"

print_info "Creating test project at $TEST_DIR"
mkdir -p "$TEST_DIR"

# Create a simple Node.js app
cat > "$TEST_DIR/package.json" << EOF
{
  "name": "$TEST_APP",
  "version": "1.0.0",
  "description": "Test deployment app",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

cat > "$TEST_DIR/server.js" << 'EOF'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    message: 'Test deployment app running!',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
EOF

# Run setup script
print_info "Running setup script..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if "$SCRIPT_DIR/setup-project.sh" \
    --name "$TEST_APP" \
    --path "$TEST_DIR" \
    --domain "$TEST_APP.gmac.io" \
    --staging \
    --turso-db; then
    print_success "Setup script completed successfully"
else
    print_error "Setup script failed"
    exit 1
fi

# Verify created files
print_info "Verifying created files..."

FILES_TO_CHECK=(
    ".github/workflows/deploy.yml"
    "Dockerfile"
    "k8s/base-deployment.yaml"
    "k8s/production-ingress.yaml"
    "k8s/staging-deployment.yaml"
    "k8s/argocd-app.yaml"
    "deploy.sh"
    "DEPLOYMENT.md"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$TEST_DIR/$file" ]; then
        print_success "Found $file"
    else
        print_error "Missing $file"
    fi
done

# Verify Kubernetes resources
print_info "Verifying Kubernetes resources..."

# Check namespace
if kubectl get namespace "$TEST_APP" &>/dev/null; then
    print_success "Namespace created"
else
    print_error "Namespace not found"
fi

# Check secrets
if kubectl get secret harbor-registry -n "$TEST_APP" &>/dev/null; then
    print_success "Harbor registry secret created"
else
    print_error "Harbor registry secret not found"
fi

if kubectl get secret "${TEST_APP}-secrets" -n "$TEST_APP" &>/dev/null; then
    print_success "Application secrets created"
    
    # Check for Turso credentials
    if kubectl get secret "${TEST_APP}-secrets" -n "$TEST_APP" -o json | jq -r '.data.TURSO_DATABASE_URL' | base64 -d | grep -q "libsql://"; then
        print_success "Turso database URL found in secrets"
    else
        print_error "Turso database URL not found in secrets"
    fi
else
    print_error "Application secrets not found"
fi

# Check ArgoCD application
if kubectl get application "$TEST_APP" -n argocd &>/dev/null; then
    print_success "ArgoCD application created"
else
    print_error "ArgoCD application not found"
fi

# Test secret management
print_info "Testing secret management..."
"$SCRIPT_DIR/manage-secrets.sh" \
    --namespace "$TEST_APP" \
    --secret "${TEST_APP}-secrets" \
    set TEST_KEY "test-value"

TEST_VALUE=$("$SCRIPT_DIR/manage-secrets.sh" \
    --namespace "$TEST_APP" \
    --secret "${TEST_APP}-secrets" \
    get TEST_KEY)

if [ "$TEST_VALUE" = "test-value" ]; then
    print_success "Secret management working"
else
    print_error "Secret management failed"
fi

# Cleanup
print_info "Cleaning up test resources..."

# Delete Kubernetes resources
kubectl delete namespace "$TEST_APP" --wait=false &>/dev/null || true
kubectl delete application "$TEST_APP" -n argocd --wait=false &>/dev/null || true

# Delete Turso database
turso db destroy "${TEST_APP}-db" --yes &>/dev/null || true

# Remove test directory
rm -rf "$TEST_DIR"

print_success "Test completed successfully!"
print_info "The setup script is working correctly."