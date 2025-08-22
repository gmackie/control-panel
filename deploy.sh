#!/bin/bash

# Build and deploy control panel to k3s

echo "🚀 Building control panel image..."
docker build -t control-panel:latest .

echo "📦 Saving image to tar file..."
docker save control-panel:latest -o control-panel.tar

echo "📤 Copying image to k3s server..."
scp control-panel.tar root@5.78.125.172:/tmp/

echo "🔧 Loading image on k3s server..."
ssh root@5.78.125.172 "/usr/local/bin/k3s ctr images import /tmp/control-panel.tar && rm /tmp/control-panel.tar"

echo "🎯 Copying manifests to server..."
scp -r k8s/ root@5.78.125.172:/tmp/

echo "🚀 Applying Kubernetes manifests..."
ssh root@5.78.125.172 "/usr/local/bin/k3s kubectl apply -f /tmp/k8s/"

echo "🔄 Restarting deployment..."
ssh root@5.78.125.172 "/usr/local/bin/k3s kubectl rollout restart deployment/control-panel -n control-panel"

echo "⏳ Waiting for rollout to complete..."
ssh root@5.78.125.172 "/usr/local/bin/k3s kubectl rollout status deployment/control-panel -n control-panel"

echo "🧹 Cleaning up..."
ssh root@5.78.125.172 "rm -rf /tmp/k8s"

echo "✅ Deployment complete!"
echo "🌐 Access the application at: https://gmac.io"

# Cleanup local tar file
rm -f control-panel.tar