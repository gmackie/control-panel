#!/bin/bash

# Build and deploy control panel to k3s with compression

echo "🚀 Building control panel image for amd64..."
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_AZURE_AD_CLIENT_ID="41e226f9-fb86-4a0e-bd65-cf3de772b6bc" \
  --build-arg NEXT_PUBLIC_AZURE_AD_TENANT_ID="ad622e7f-42f1-462d-99a1-64af463becbe" \
  -t control-panel:latest .

echo "📦 Compressing image..."
docker save control-panel:latest | gzip > control-panel.tar.gz

echo "📤 Copying compressed image to k3s server..."
scp control-panel.tar.gz root@5.78.106.236:/tmp/

echo "🔧 Loading image on k3s server..."
ssh root@5.78.106.236 "gunzip -c /tmp/control-panel.tar.gz | /usr/local/bin/k3s ctr images import - && rm /tmp/control-panel.tar.gz"

echo "🎯 Copying manifests to server..."
scp -r k8s/ root@5.78.106.236:/tmp/

echo "🚀 Applying Kubernetes manifests (secrets are managed separately)..."
# Apply namespace first
ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl apply -f /tmp/k8s/01-namespace.yaml 2>/dev/null || true"

SECRET_EXISTS=$(ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl get secret control-panel-secrets -n control-panel -o name 2>/dev/null || echo ''")
if [ -z "$SECRET_EXISTS" ]; then
    echo "❌ control-panel-secrets is missing. Refusing to apply any Secret manifests during deploy."
    echo "   Create/update secrets separately (e.g. run ./update-cluster-secrets.sh) and retry."
    exit 1
fi
echo "✅ Existing secrets present (skipping 03-secret.yaml)"

# Apply all other manifests except namespace and secrets
ssh root@5.78.106.236 "for f in /tmp/k8s/*.yaml; do case \"\$f\" in */01-namespace.yaml|*/03-secret.yaml|*secret*.yaml) ;; *) /usr/local/bin/k3s kubectl apply -f \"\$f\"; esac; done"

echo "🔄 Restarting deployment..."
ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl rollout restart deployment/control-panel -n control-panel"

echo "⏳ Waiting for rollout to complete..."
ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl rollout status deployment/control-panel -n control-panel"

echo "🧹 Cleaning up..."
ssh root@5.78.106.236 "rm -rf /tmp/k8s"
rm -f control-panel.tar.gz

echo "✅ Deployment complete!"
echo "🌐 Access the application at: https://control.gmac.io"
