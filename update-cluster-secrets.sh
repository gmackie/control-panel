#!/bin/bash

# Script to update cluster management secrets from .env.local

echo "📋 Updating control panel secrets for production deployment..."

# Load environment variables from .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✅ Loaded environment variables from .env.local"
else
    echo "❌ Error: .env.local file not found"
    exit 1
fi

# Check required variables (GitHub OR Azure AD must be set for auth)
required_vars=("NEXTAUTH_SECRET")
optional_auth_vars=("GITHUB_ID" "AZURE_AD_CLIENT_ID")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Error: The following required environment variables are missing:"
    printf ' - %s\n' "${missing_vars[@]}"
    exit 1
fi

echo "🔧 Creating Kubernetes secrets patch..."
cat > /tmp/secret-patch.yaml << EOF
stringData:
  NEXTAUTH_URL: "${NEXTAUTH_URL:-https://control.gmac.io}"
  NEXTAUTH_SECRET: "$NEXTAUTH_SECRET"
  GITHUB_CLIENT_ID: "${GITHUB_ID:-}"
  GITHUB_CLIENT_SECRET: "${GITHUB_SECRET:-}"
  AZURE_AD_CLIENT_ID: "${AZURE_AD_CLIENT_ID:-}"
  AZURE_AD_CLIENT_SECRET: "${AZURE_AD_CLIENT_SECRET:-}"
  AZURE_AD_TENANT_ID: "${AZURE_AD_TENANT_ID:-}"
  NEON_DATABASE_URL: "${NEON_DATABASE_URL:-}"
  TURSO_DATABASE_URL: "${TURSO_DATABASE_URL:-}"
  TURSO_AUTH_TOKEN: "${TURSO_AUTH_TOKEN:-}"
  GITEA_TOKEN: "${GITEA_TOKEN:-}"
  K3S_SA_TOKEN: "${K3S_SA_TOKEN:-}"
  HETZNER_API_TOKEN: "${HETZNER_API_TOKEN:-}"
  K8S_API_URL: "https://5.78.125.172:6443"
EOF

echo "📤 Copying patch file to k3s cluster..."
scp /tmp/secret-patch.yaml root@5.78.125.172:/tmp/

echo "🔄 Patching secrets on k3s cluster..."
ssh root@5.78.125.172 "/usr/local/bin/k3s kubectl patch secret control-panel-secrets -n control-panel --patch-file=/tmp/secret-patch.yaml"

echo "🧹 Cleaning up temporary files..."
rm -f /tmp/secret-patch.yaml
ssh root@5.78.125.172 "rm -f /tmp/secret-patch.yaml"

echo "🔄 Restarting deployment to apply new secrets..."
ssh root@5.78.125.172 "/usr/local/bin/k3s kubectl rollout restart deployment/control-panel -n control-panel"

echo "✅ Secrets updated and deployment restarted!"
echo ""
echo "📋 Configured authentication providers:"
[ -n "$GITHUB_ID" ] && echo "   ✓ GitHub OAuth"
[ -n "$AZURE_AD_CLIENT_ID" ] && echo "   ✓ Microsoft Entra ID (gmacko.com SSO)"
echo ""
echo "🔍 Check deployment status with:"
echo "   ssh root@5.78.125.172 '/usr/local/bin/k3s kubectl get pods -n control-panel'"