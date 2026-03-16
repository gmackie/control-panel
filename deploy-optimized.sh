#!/bin/bash
set -euo pipefail

# Build and deploy control panel to K3s (Hetzner production)
#
# Builds an amd64 image, ships it to the worker node, imports into
# K3s containerd, applies manifests, and restarts the deployment.

MASTER_IP="5.78.106.236"
WORKER_IP="5.78.125.172"
IMAGE_NAME="control-panel"
IMAGE_TAG="latest"
IMAGE_REF="docker.io/library/${IMAGE_NAME}:${IMAGE_TAG}"
TARBALL="/tmp/${IMAGE_NAME}.tar.gz"

# Use podman if docker isn't available
if command -v docker &>/dev/null; then
  CONTAINER_CMD="docker"
elif command -v podman &>/dev/null; then
  CONTAINER_CMD="podman"
else
  echo "Error: neither docker nor podman found" >&2
  exit 1
fi

echo "🚀 Building ${IMAGE_NAME} image for amd64 (using ${CONTAINER_CMD})..."
${CONTAINER_CMD} build --platform linux/amd64 -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo "📦 Compressing image..."
${CONTAINER_CMD} save ${IMAGE_NAME}:${IMAGE_TAG} | gzip > "${TARBALL}"

echo "📤 Uploading to worker node (${WORKER_IP})..."
scp "${TARBALL}" root@${WORKER_IP}:/tmp/

echo "🔧 Importing into K3s containerd and tagging..."
ssh root@${WORKER_IP} "
  gunzip -c ${TARBALL} | /usr/local/bin/k3s ctr images import -
  /usr/local/bin/k3s ctr images rm ${IMAGE_REF} 2>/dev/null || true
  /usr/local/bin/k3s ctr images tag localhost/${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_REF}
  rm ${TARBALL}
"

echo "🎯 Applying Kubernetes manifests..."
scp -r k8s/ root@${MASTER_IP}:/tmp/

ssh root@${MASTER_IP} "
  /usr/local/bin/k3s kubectl apply -f /tmp/k8s/01-namespace.yaml 2>/dev/null || true

  # Preserve existing secrets
  if /usr/local/bin/k3s kubectl get secret control-panel-secrets -n control-panel -o name &>/dev/null; then
    echo '✅ Existing secrets preserved'
  else
    echo '⚠️  Creating secrets from template'
    /usr/local/bin/k3s kubectl apply -f /tmp/k8s/03-secret.yaml
  fi

  # Apply all manifests except namespace and secrets
  for f in /tmp/k8s/*.yaml; do
    case \"\$f\" in
      */01-namespace.yaml|*/03-secret.yaml) ;;
      *) /usr/local/bin/k3s kubectl apply -f \"\$f\" 2>&1 || true ;;
    esac
  done

  rm -rf /tmp/k8s
"

echo "🔄 Restarting deployment..."
ssh root@${MASTER_IP} "
  /usr/local/bin/k3s kubectl set image deployment/control-panel control-panel=${IMAGE_REF} -n control-panel
  /usr/local/bin/k3s kubectl patch deployment control-panel -n control-panel -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"control-panel\",\"imagePullPolicy\":\"Never\"}]}}}}'
  /usr/local/bin/k3s kubectl rollout restart deployment/control-panel -n control-panel
"

echo "⏳ Waiting for rollout..."
ssh root@${MASTER_IP} "/usr/local/bin/k3s kubectl rollout status deployment/control-panel -n control-panel --timeout=300s"

echo "🧹 Cleaning up..."
rm -f "${TARBALL}"

echo "✅ Deployment complete!"
echo "🌐 https://control.gmac.io"
