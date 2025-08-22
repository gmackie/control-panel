#!/bin/bash

# Build and push Control Panel Docker images
# Usage: ./build-images.sh [tag]

set -e

# Configuration
REGISTRY="ghcr.io"
NAMESPACE="gmackie"  # Your GitHub username
TAG="${1:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Control Panel Docker Images${NC}"
echo "Registry: $REGISTRY/$NAMESPACE"
echo "Tag: $TAG"

# Check if logged in to GitHub Container Registry
echo -e "${YELLOW}Checking registry login...${NC}"
if ! docker pull $REGISTRY/$NAMESPACE/control-panel:latest &> /dev/null; then
    echo -e "${YELLOW}Not logged in to GitHub Container Registry${NC}"
    echo "Please run: echo \$GITHUB_TOKEN | docker login ghcr.io -u $NAMESPACE --password-stdin"
    exit 1
fi

# Build Frontend
echo -e "${GREEN}Building Frontend...${NC}"
docker build --target frontend -t $REGISTRY/$NAMESPACE/control-panel:$TAG .

# Build Backend
echo -e "${GREEN}Building Backend...${NC}"
docker build --target backend -t $REGISTRY/$NAMESPACE/control-panel-backend:$TAG .

# Build AI Services
AI_SERVICES=(
    "incident-prediction"
    "capacity-planning"
    "root-cause-analysis"
    "resource-optimization"
    "anomaly-detection"
    "predictive-maintenance"
    "chatbot-nlp"
)

for service in "${AI_SERVICES[@]}"; do
    echo -e "${GREEN}Building AI Service: $service...${NC}"
    docker build --target $service -t $REGISTRY/$NAMESPACE/control-panel-$service:$TAG .
done

# Push images if not building locally
if [ "$TAG" != "local" ]; then
    echo -e "${YELLOW}Pushing images to registry...${NC}"
    
    docker push $REGISTRY/$NAMESPACE/control-panel:$TAG
    docker push $REGISTRY/$NAMESPACE/control-panel-backend:$TAG
    
    for service in "${AI_SERVICES[@]}"; do
        docker push $REGISTRY/$NAMESPACE/control-panel-$service:$TAG
    done
    
    echo -e "${GREEN}All images pushed successfully!${NC}"
else
    echo -e "${YELLOW}Skipping push for local tag${NC}"
fi

echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Images built:"
echo "  - $REGISTRY/$NAMESPACE/control-panel:$TAG"
echo "  - $REGISTRY/$NAMESPACE/control-panel-backend:$TAG"
for service in "${AI_SERVICES[@]}"; do
    echo "  - $REGISTRY/$NAMESPACE/control-panel-$service:$TAG"
done