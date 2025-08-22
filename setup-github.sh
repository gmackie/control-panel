#!/bin/bash

# Setup GitHub repository and container registry for Control Panel
# Uses GitHub CLI (gh) for all operations

set -e

# Configuration
REPO_NAME="control-panel"
REPO_DESCRIPTION="GMAC.IO Control Panel - Comprehensive Kubernetes cluster management platform"
VISIBILITY="public"  # or "private"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== GMAC.IO Control Panel GitHub Setup ===${NC}"

# Check if gh is logged in
echo -e "${YELLOW}Checking GitHub CLI authentication...${NC}"
if ! gh auth status &> /dev/null; then
    echo -e "${RED}GitHub CLI not authenticated. Please run: gh auth login${NC}"
    exit 1
fi

# Get GitHub username
GITHUB_USER=$(gh api user --jq .login)
echo -e "${GREEN}Authenticated as: $GITHUB_USER${NC}"

# Check if repo already exists
echo -e "${YELLOW}Checking if repository exists...${NC}"
if gh repo view $GITHUB_USER/$REPO_NAME &> /dev/null; then
    echo -e "${YELLOW}Repository $GITHUB_USER/$REPO_NAME already exists${NC}"
    read -p "Do you want to use the existing repository? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    # Create repository
    echo -e "${GREEN}Creating repository $GITHUB_USER/$REPO_NAME...${NC}"
    gh repo create $REPO_NAME \
        --description "$REPO_DESCRIPTION" \
        --$VISIBILITY \
        --clone=false \
        --add-readme=false
    
    echo -e "${GREEN}Repository created successfully!${NC}"
fi

# Initialize git if not already initialized
if [ ! -d .git ]; then
    echo -e "${YELLOW}Initializing git repository...${NC}"
    git init
    git branch -M main
fi

# Add remote if not exists
if ! git remote get-url origin &> /dev/null; then
    echo -e "${YELLOW}Adding remote origin...${NC}"
    git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git
else
    echo -e "${YELLOW}Remote origin already exists${NC}"
fi

# Create .gitignore if not exists
if [ ! -f .gitignore ]; then
    echo -e "${YELLOW}Creating .gitignore...${NC}"
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
*.pyc
__pycache__/
venv/
env/
.env
.env.local

# Build outputs
.next/
out/
dist/
build/
*.egg-info/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.coverage
htmlcov/
.pytest_cache/

# Temporary files
*.tmp
*.bak
tmp/
temp/

# Kubernetes secrets
*-secret.yaml
*-secrets.yaml
secrets/

# Docker
*.tar
*.tar.gz
control-panel.tar
control-panel.tar.gz
EOF
fi

# Add all files and create initial commit
echo -e "${YELLOW}Creating initial commit...${NC}"
git add .
git commit -m "Initial commit: GMAC.IO Control Panel

- Comprehensive Kubernetes cluster management
- Service orchestration and monitoring
- Integrated development environment
- AI-powered operations
- Advanced analytics and business intelligence
- Cost optimization and performance benchmarking
- Real-time monitoring and alerting" || echo "Already committed"

# Push to GitHub
echo -e "${YELLOW}Pushing to GitHub...${NC}"
git push -u origin main || echo "Already pushed"

# Enable GitHub Container Registry
echo -e "${YELLOW}Configuring GitHub Container Registry...${NC}"
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  /user/packages/container/control-panel/visibility \
  -f visibility='public' 2>/dev/null || echo "Package visibility already configured"

# Set up GitHub Actions secrets if needed
echo -e "${YELLOW}Setting up repository settings...${NC}"

# Enable GitHub Actions
gh api \
  --method PUT \
  repos/$GITHUB_USER/$REPO_NAME/actions/permissions \
  -f enabled=true \
  -f allowed_actions='all' 2>/dev/null || echo "Actions already enabled"

# Create a GitHub token for container registry (using gh auth token)
GITHUB_TOKEN=$(gh auth token)

# Login to GitHub Container Registry using gh auth token
echo -e "${YELLOW}Logging into GitHub Container Registry...${NC}"
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USER --password-stdin

# Build and push images
echo -e "${BLUE}Ready to build and push Docker images${NC}"
echo -e "Run the following command to build and push:"
echo -e "${GREEN}./build-images.sh latest${NC}"
echo
echo -e "${BLUE}Or trigger GitHub Actions by pushing a tag:${NC}"
echo -e "${GREEN}git tag v1.0.0 && git push origin v1.0.0${NC}"

# Display summary
echo
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo -e "Repository: ${BLUE}https://github.com/$GITHUB_USER/$REPO_NAME${NC}"
echo -e "Container Registry: ${BLUE}ghcr.io/$GITHUB_USER/control-panel${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Build and push images: ${GREEN}./build-images.sh latest${NC}"
echo -e "2. Deploy to cluster: ${GREEN}cd /Volumes/dev/gmac-io-ci/components/control-panel && ./install.sh${NC}"
echo -e "3. Access control panel: ${GREEN}https://control-panel.gmac.io${NC}"

# Check GitHub Actions workflow status
echo
echo -e "${YELLOW}To monitor GitHub Actions workflows:${NC}"
echo -e "${GREEN}gh run list --repo $GITHUB_USER/$REPO_NAME${NC}"
echo -e "${GREEN}gh run watch --repo $GITHUB_USER/$REPO_NAME${NC}"

# Package visibility settings
echo
echo -e "${YELLOW}To make packages public (if needed):${NC}"
echo -e "${GREEN}gh api --method PUT /user/packages/container/control-panel/visibility -f visibility='public'${NC}"
echo -e "${GREEN}gh api --method PUT /user/packages/container/control-panel-backend/visibility -f visibility='public'${NC}"