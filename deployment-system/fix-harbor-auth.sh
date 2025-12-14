#!/bin/bash
set -euo pipefail

# Fix Harbor Authentication - Remove OAuth Proxy for CLI Access

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
KUBECONFIG="${KUBECONFIG:-/Users/mackieg/.kube/config-hetzner}"
HARBOR_NAMESPACE="${HARBOR_NAMESPACE:-registry}"
HARBOR_URL="registry.gmac.io"

print_info "🔧 Fixing Harbor Authentication"
print_info "  Removing OAuth proxy to enable CLI access"
print_info "  Namespace: $HARBOR_NAMESPACE"
echo

# Check current Harbor ingress
print_info "Checking current Harbor ingress configuration..."
kubectl get ingress -n "$HARBOR_NAMESPACE" -o yaml > /tmp/harbor-ingress-current.yaml

# Backup current configuration
cp /tmp/harbor-ingress-current.yaml /tmp/harbor-ingress-backup-$(date +%Y%m%d-%H%M%S).yaml
print_info "Backed up current configuration"

# Create new ingress without OAuth proxy
print_info "Creating new Harbor ingress without OAuth proxy..."
cat > /tmp/harbor-ingress-fixed.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-ingress
  namespace: $HARBOR_NAMESPACE
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "0"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    # Remove OAuth proxy annotations
    # nginx.ingress.kubernetes.io/auth-url: "https://oauth.gmac.io/oauth2/auth"
    # nginx.ingress.kubernetes.io/auth-signin: "https://oauth.gmac.io/oauth2/start?rd=\$scheme://\$best_http_host\$request_uri"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - $HARBOR_URL
    secretName: harbor-tls
  rules:
  - host: $HARBOR_URL
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: harbor
            port:
              number: 80
      - path: /api/
        pathType: Prefix
        backend:
          service:
            name: harbor
            port:
              number: 80
      - path: /service/
        pathType: Prefix
        backend:
          service:
            name: harbor
            port:
              number: 80
      - path: /v2/
        pathType: Prefix
        backend:
          service:
            name: harbor
            port:
              number: 80
      - path: /chartrepo/
        pathType: Prefix
        backend:
          service:
            name: harbor
            port:
              number: 80
      - path: /c/
        pathType: Prefix
        backend:
          service:
            name: harbor
            port:
              number: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-notary-ingress
  namespace: $HARBOR_NAMESPACE
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    # No OAuth proxy for notary
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - notary.$HARBOR_URL
    secretName: harbor-notary-tls
  rules:
  - host: notary.$HARBOR_URL
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: harbor-notary-server
            port:
              number: 4443
EOF

# Apply the new ingress
print_info "Applying new ingress configuration..."
kubectl apply -f /tmp/harbor-ingress-fixed.yaml

# Wait for ingress to be ready
print_info "Waiting for ingress to be ready..."
sleep 5

# Verify ingress
kubectl get ingress -n "$HARBOR_NAMESPACE"

# Create a separate ingress for web UI with OAuth (optional)
print_info "Creating separate OAuth-protected ingress for web UI (optional)..."
cat > /tmp/harbor-ui-ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-ui-ingress
  namespace: $HARBOR_NAMESPACE
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "0"
    nginx.ingress.kubernetes.io/auth-url: "https://oauth.gmac.io/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://oauth.gmac.io/oauth2/start?rd=\$scheme://\$best_http_host\$request_uri"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - harbor-ui.$HARBOR_URL
    secretName: harbor-ui-tls
  rules:
  - host: harbor-ui.$HARBOR_URL
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: harbor-portal
            port:
              number: 80
EOF

# Ask if user wants OAuth-protected UI
read -p "Do you want to create a separate OAuth-protected UI at harbor-ui.$HARBOR_URL? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f /tmp/harbor-ui-ingress.yaml
    print_success "Created OAuth-protected UI at https://harbor-ui.$HARBOR_URL"
fi

# Test Harbor API access
print_info "Testing Harbor API access..."
if curl -s -u admin:Harbor12345 "https://$HARBOR_URL/api/v2.0/systeminfo" | grep -q harbor_version; then
    print_success "Harbor API is accessible!"
else
    print_error "Failed to access Harbor API"
fi

# Test Docker login
print_info "Testing Docker login..."
if echo "Harbor12345" | docker login "$HARBOR_URL" -u admin --password-stdin; then
    print_success "Docker login successful!"
else
    print_error "Docker login failed"
fi

# Update credentials.env with notes
if [ -f "$SCRIPT_DIR/credentials.env" ]; then
    print_info "Updating credentials.env with access notes..."
    cat >> "$SCRIPT_DIR/credentials.env" << 'EOF'

# Harbor Access (Updated - No OAuth Proxy)
# CLI/API Access: https://registry.gmac.io
# OAuth-protected UI (optional): https://harbor-ui.registry.gmac.io
# Direct access with Harbor credentials: admin/Harbor12345
EOF
fi

print_success "✅ Harbor authentication fixed!"
echo
print_info "📋 Access Methods:"
echo "  CLI/Docker: https://$HARBOR_URL (Harbor auth)"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  Web UI (OAuth): https://harbor-ui.$HARBOR_URL"
fi
echo "  Web UI (Direct): https://$HARBOR_URL (Harbor auth)"
echo
print_info "🔐 Authentication:"
echo "  Username: admin"
echo "  Password: Harbor12345"
echo
print_info "🚀 Usage Examples:"
echo "  docker login $HARBOR_URL"
echo "  npm login --registry https://$HARBOR_URL/npm/"
echo "  helm repo add harbor https://$HARBOR_URL/chartrepo/library"
echo
print_warning "⚠️  Security Notes:"
echo "  - Harbor's built-in auth is now active for all access"
echo "  - Consider changing the default admin password"
echo "  - Use robot accounts for CI/CD systems"
echo "  - Enable 2FA for admin users in Harbor settings"