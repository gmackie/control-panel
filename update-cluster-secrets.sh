#!/bin/bash

# Script to update cluster management secrets

echo "📋 Updating control panel secrets for cluster management..."

# Check if HETZNER_API_TOKEN is set
if [ -z "$HETZNER_API_TOKEN" ]; then
    echo "❌ Error: HETZNER_API_TOKEN environment variable is not set"
    echo "Please set it with: export HETZNER_API_TOKEN=your-token-here"
    exit 1
fi

# Create a temporary secret patch file
cat > /tmp/secret-patch.yaml << EOF
data:
  HETZNER_API_TOKEN: $(echo -n "$HETZNER_API_TOKEN" | base64)
  K8S_API_URL: $(echo -n "https://5.78.125.172:6443" | base64)
EOF

echo "🔄 Patching secrets on k3s cluster..."
ssh root@5.78.125.172 "/usr/local/bin/k3s kubectl patch secret control-panel-secrets -n control-panel --patch-file=/tmp/secret-patch.yaml"

echo "✅ Secrets updated successfully!"
echo ""
echo "🚀 To deploy the new cluster management features, run:"
echo "   ./deploy-optimized.sh"