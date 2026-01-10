#!/bin/bash

# Build and deploy control panel to k3s with compression

echo "🚀 Building control panel image for amd64..."
docker build --platform linux/amd64 -t control-panel:latest .

echo "📦 Compressing image..."
docker save control-panel:latest | gzip > control-panel.tar.gz

echo "📤 Copying compressed image to k3s server..."
scp control-panel.tar.gz root@5.78.106.236:/tmp/

echo "🔧 Loading image on k3s server..."
ssh root@5.78.106.236 "gunzip -c /tmp/control-panel.tar.gz | /usr/local/bin/k3s ctr images import - && rm /tmp/control-panel.tar.gz"

echo "🎯 Copying manifests to server..."
scp -r k8s/ root@5.78.106.236:/tmp/

echo "🚀 Applying Kubernetes manifests (preserving existing secrets)..."
# Apply namespace first
ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl apply -f /tmp/k8s/01-namespace.yaml 2>/dev/null || true"

# Check if secrets already exist - only create if missing
SECRET_EXISTS=$(ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl get secret control-panel-secrets -n control-panel -o name 2>/dev/null || echo ''")
if [ -z "$SECRET_EXISTS" ]; then
    echo "⚠️  No existing secrets found - creating from template (update values afterward!)"
    ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl apply -f /tmp/k8s/03-secret.yaml"
else
    echo "✅ Existing secrets preserved (skipping 03-secret.yaml)"
fi

# Apply all other manifests except namespace and secrets
ssh root@5.78.106.236 "for f in /tmp/k8s/*.yaml; do case \"\$f\" in */01-namespace.yaml|*/03-secret.yaml) ;; *) /usr/local/bin/k3s kubectl apply -f \"\$f\"; esac; done"

echo "🔄 Restarting deployment..."
ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl rollout restart deployment/control-panel -n control-panel"

echo "⏳ Waiting for rollout to complete..."
ssh root@5.78.106.236 "/usr/local/bin/k3s kubectl rollout status deployment/control-panel -n control-panel"

echo "🧹 Cleaning up..."
ssh root@5.78.106.236 "rm -rf /tmp/k8s"
rm -f control-panel.tar.gz

echo "✅ Deployment complete!"
echo "🌐 Access the application at: https://control.gmac.io"