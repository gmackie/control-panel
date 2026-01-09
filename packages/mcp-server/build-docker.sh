#!/bin/bash
set -e

VERSION=${1:-$(node -p "require('./package.json').version")}
IMAGE_NAME="ghcr.io/gmackie/control-panel-mcp"

echo "Building @gmac/control-panel-mcp v${VERSION}"

echo "Step 1: Building TypeScript..."
pnpm build

echo "Step 2: Running tests..."
pnpm test

echo "Step 3: Building Docker image..."
docker build -t "${IMAGE_NAME}:${VERSION}" -t "${IMAGE_NAME}:latest" .

echo "Docker image built: ${IMAGE_NAME}:${VERSION}"
echo ""
echo "To push to GitHub Container Registry:"
echo "  docker push ${IMAGE_NAME}:${VERSION}"
echo "  docker push ${IMAGE_NAME}:latest"
echo ""
echo "To run locally:"
echo "  docker run -it \\"
echo "    -e CONTROL_PANEL_URL=https://control.gmac.io \\"
echo "    -e CONTROL_PANEL_API_KEY=cp_your_key \\"
echo "    ${IMAGE_NAME}:${VERSION}"
