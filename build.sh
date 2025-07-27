#!/bin/bash

# Build and push control panel Docker image

IMAGE_NAME="control-panel"
REGISTRY="ci.gmac.io/gmac-io-ci"
VERSION=$(git describe --tags --always --dirty)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "Building control panel image..."
echo "Version: ${VERSION}"
echo "Timestamp: ${TIMESTAMP}"

# Build the image
docker build -t ${IMAGE_NAME}:latest \
  -t ${IMAGE_NAME}:${VERSION} \
  -t ${IMAGE_NAME}:${TIMESTAMP} \
  .

# Tag for registry
docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:latest
docker tag ${IMAGE_NAME}:${VERSION} ${REGISTRY}/${IMAGE_NAME}:${VERSION}
docker tag ${IMAGE_NAME}:${TIMESTAMP} ${REGISTRY}/${IMAGE_NAME}:${TIMESTAMP}

echo "Image built successfully!"
echo ""
echo "To push to registry:"
echo "docker push ${REGISTRY}/${IMAGE_NAME}:latest"
echo "docker push ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo ""
echo "To deploy to k8s:"
echo "kubectl apply -f k8s/"