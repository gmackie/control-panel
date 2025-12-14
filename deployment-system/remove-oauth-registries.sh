#!/bin/bash
set -euo pipefail

# Remove OAuth Proxy from Harbor and NPM registries to enable CLI access

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Configuration
export KUBECONFIG="${KUBECONFIG:-/Users/mackieg/.kube/config-hetzner}"

print_info "🔧 Removing OAuth Proxy from Registry Services"
print_info "  This will enable CLI access for:"
print_info "  - Harbor (registry.gmac.io)"
print_info "  - NPM Registry (npm.gmac.io)"
echo

# Function to remove OAuth annotations from ingress
remove_oauth_from_ingress() {
    local namespace=$1
    local ingress_name=$2
    local host=$3
    
    print_info "Processing $ingress_name in namespace $namespace..."
    
    # Backup current configuration
    kubectl get ingress "$ingress_name" -n "$namespace" -o yaml > "/tmp/${ingress_name}-backup-$(date +%Y%m%d-%H%M%S).yaml"
    
    # Remove OAuth annotations
    kubectl annotate ingress "$ingress_name" -n "$namespace" \
        nginx.ingress.kubernetes.io/auth-url- \
        nginx.ingress.kubernetes.io/auth-signin- \
        nginx.ingress.kubernetes.io/auth-response-headers- \
        --overwrite 2>/dev/null || true
    
    print_success "Removed OAuth proxy from $host"
}

# 1. Fix Harbor Registry
print_info "=== Fixing Harbor Registry ==="
remove_oauth_from_ingress "registry" "harbor-ingress" "registry.gmac.io"

# Test Harbor access
print_info "Testing Harbor API access..."
if curl -s -u admin:Harbor12345 "https://registry.gmac.io/api/v2.0/systeminfo" | grep -q harbor_version 2>/dev/null; then
    print_success "Harbor API is accessible!"
else
    print_warning "Could not verify Harbor API access (may need a moment to update)"
fi

# 2. Fix NPM Registry (Verdaccio)
print_info ""
print_info "=== Fixing NPM Registry ==="
remove_oauth_from_ingress "npm-registry" "verdaccio" "npm.gmac.io"

# Test Verdaccio access
print_info "Testing Verdaccio access..."
if curl -s "https://npm.gmac.io" | grep -q "verdaccio" 2>/dev/null; then
    print_success "Verdaccio is accessible!"
else
    print_warning "Could not verify Verdaccio access (may need a moment to update)"
fi

# 3. Optional: Create OAuth-protected UI endpoints
print_info ""
print_info "=== Optional: OAuth-Protected UIs ==="
echo "You can create separate OAuth-protected URLs for web UI access:"
echo "  - harbor-ui.gmac.io (for Harbor web interface)"
echo "  - npm-ui.gmac.io (for Verdaccio web interface)"
echo ""
read -p "Do you want to create OAuth-protected UI endpoints? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Create Harbor UI ingress with OAuth
    cat > /tmp/harbor-ui-ingress.yaml << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-ui-ingress
  namespace: registry
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "0"
    nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.auth-system.svc.cluster.local:4180/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://gmac.io/oauth2/start?rd=$scheme://$host$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User,X-Auth-Request-Email,X-Auth-Request-Access-Token"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - harbor-ui.gmac.io
    secretName: harbor-ui-tls
  rules:
  - host: harbor-ui.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: harbor
            port:
              number: 80
EOF

    # Create NPM UI ingress with OAuth
    cat > /tmp/npm-ui-ingress.yaml << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: verdaccio-ui-ingress
  namespace: npm-registry
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.auth-system.svc.cluster.local:4180/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://gmac.io/oauth2/start?rd=$scheme://$host$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User,X-Auth-Request-Email,X-Auth-Request-Access-Token"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - npm-ui.gmac.io
    secretName: npm-ui-tls
  rules:
  - host: npm-ui.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: verdaccio
            port:
              number: 4873
EOF

    kubectl apply -f /tmp/harbor-ui-ingress.yaml
    kubectl apply -f /tmp/npm-ui-ingress.yaml
    
    print_success "Created OAuth-protected UI endpoints"
    print_info "  Harbor UI: https://harbor-ui.gmac.io (GitHub OAuth)"
    print_info "  NPM UI: https://npm-ui.gmac.io (GitHub OAuth)"
fi

print_success "✅ Registry authentication update complete!"
echo
print_info "📋 Access Methods:"
echo
echo "🐳 Harbor (Docker Registry):"
echo "  CLI/API: https://registry.gmac.io"
echo "  Login: docker login registry.gmac.io"
echo "  Username: admin"
echo "  Password: Harbor12345"
echo
echo "📦 NPM Registry (Verdaccio):"
echo "  CLI/API: https://npm.gmac.io"
echo "  Login: npm login --registry https://npm.gmac.io"
echo "  Users: admin, ci-build (passwords in documentation)"
echo
echo "🔧 Testing Commands:"
echo "  # Test Harbor"
echo "  docker login registry.gmac.io"
echo "  docker pull nginx:alpine"
echo "  docker tag nginx:alpine registry.gmac.io/library/test:latest"
echo "  docker push registry.gmac.io/library/test:latest"
echo ""
echo "  # Test NPM"
echo "  npm login --registry https://npm.gmac.io"
echo "  npm publish --registry https://npm.gmac.io"
echo
print_warning "⚠️  Security Notes:"
echo "  - Both registries now use their built-in authentication"
echo "  - Harbor: Consider changing default admin password"
echo "  - NPM: Set up proper user accounts"
echo "  - Use robot accounts/tokens for CI/CD"
echo "  - The OAuth-protected UI endpoints provide additional security for web access"

# Update credentials.env if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/credentials.env" ]; then
    # Check if already has the note
    if ! grep -q "Registry Access (No OAuth)" "$SCRIPT_DIR/credentials.env"; then
        cat >> "$SCRIPT_DIR/credentials.env" << 'EOF'

# Registry Access (No OAuth Proxy)
# Harbor CLI/API: https://registry.gmac.io (admin/Harbor12345)
# NPM CLI/API: https://npm.gmac.io (admin or ci-build user)
# OAuth UIs (optional): https://harbor-ui.gmac.io, https://npm-ui.gmac.io
EOF
        print_info "Updated credentials.env with access notes"
    fi
fi