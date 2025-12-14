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

# Check required variables
required_vars=("TURSO_DATABASE_URL" "TURSO_AUTH_TOKEN" "GITHUB_ID" "GITHUB_SECRET" "NEXTAUTH_SECRET" "GITEA_TOKEN" "K3S_SA_TOKEN")
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

# Create a comprehensive secret patch file
echo "🔧 Creating Kubernetes secrets patch..."
cat > /tmp/secret-patch.yaml << EOF
stringData:
  # NextAuth Configuration
  NEXTAUTH_URL: "${NEXTAUTH_URL:-https://control.gmac.io}"
  NEXTAUTH_SECRET: "$NEXTAUTH_SECRET"
  
  # GitHub OAuth
  GITHUB_CLIENT_ID: "$GITHUB_ID"
  GITHUB_CLIENT_SECRET: "$GITHUB_SECRET"
  
  # Database Configuration
  TURSO_DATABASE_URL: "$TURSO_DATABASE_URL"
  TURSO_AUTH_TOKEN: "$TURSO_AUTH_TOKEN"
  
  # Infrastructure Tokens
  GITEA_TOKEN: "$GITEA_TOKEN"
  K3S_SA_TOKEN: "$K3S_SA_TOKEN"
  HETZNER_API_TOKEN: "${HETZNER_API_TOKEN:-}"
  
  # Kubernetes API
  K8S_API_URL: "https://5.78.106.236:6443"
EOF

echo "📤 Copying patch file to k3s cluster..."
scp /tmp/secret-patch.yaml root@5.78.106.236:/tmp/

echo "🔄 Patching secrets on k3s cluster..."
ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl patch secret control-panel-secrets -n control-panel --patch-file=/tmp/secret-patch.yaml"

echo "🧹 Cleaning up temporary files..."
rm -f /tmp/secret-patch.yaml
ssh root@5.78.106.236 "rm -f /tmp/secret-patch.yaml"

echo "✅ Secrets updated successfully!"
echo ""
echo "🚀 To deploy with updated secrets, run:"
echo "   ./deploy-optimized.sh"