#!/bin/bash
set -euo pipefail

# Harbor NPM Repository Setup Script

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Load credentials
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/credentials.env" ]; then
    source "$SCRIPT_DIR/credentials.env"
fi

HARBOR_URL="${HARBOR_URL:-registry.gmac.io}"
HARBOR_USER="${HARBOR_USER:-admin}"
HARBOR_PASSWORD="${HARBOR_PASSWORD:-Harbor12345}"
HARBOR_API="https://$HARBOR_URL/api/v2.0"

print_info "🚢 Harbor NPM Repository Setup"
print_info "  Harbor URL: $HARBOR_URL"
print_info "  Admin User: $HARBOR_USER"
echo

# Function to make Harbor API calls
harbor_api() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    
    curl -s -k -X "$method" \
        -u "$HARBOR_USER:$HARBOR_PASSWORD" \
        -H "Content-Type: application/json" \
        ${data:+-d "$data"} \
        "$HARBOR_API/$endpoint"
}

# Check if NPM project already exists
print_info "Checking for existing NPM project..."
PROJECTS_RESPONSE=$(harbor_api GET "projects?name=npm")
NPM_PROJECT_EXISTS=$(echo "$PROJECTS_RESPONSE" | jq 'length > 0' 2>/dev/null || echo "false")

if [ "$NPM_PROJECT_EXISTS" = "true" ]; then
    print_info "NPM project already exists"
    NPM_PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | jq -r '.[0].project_id')
else
    print_info "Creating NPM project in Harbor..."
    CREATE_RESPONSE=$(harbor_api POST "projects" '{
        "project_name": "npm",
        "public": false,
        "metadata": {
            "public": "false",
            "enable_content_trust": "false",
            "auto_scan": "true",
            "severity": "low",
            "reuse_sys_cve_whitelist": "true"
        }
    }')
    
    if echo "$CREATE_RESPONSE" | grep -q "created"; then
        print_success "NPM project created successfully"
        # Get the project ID
        PROJECTS_RESPONSE=$(harbor_api GET "projects?name=npm")
        NPM_PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | jq -r '.[0].project_id')
    else
        print_error "Failed to create NPM project"
        echo "Response: $CREATE_RESPONSE"
        exit 1
    fi
fi

print_info "NPM Project ID: $NPM_PROJECT_ID"

# Create a robot account for NPM access
print_info "Creating robot account for NPM..."
ROBOT_NAME="npm-publisher"
ROBOT_RESPONSE=$(harbor_api POST "robots" "{
    \"name\": \"$ROBOT_NAME\",
    \"description\": \"Robot account for NPM package publishing\",
    \"duration\": -1,
    \"permissions\": [{
        \"namespace\": \"npm\",
        \"kind\": \"project\",
        \"access\": [{
            \"resource\": \"repository\",
            \"action\": \"push\"
        }, {
            \"resource\": \"repository\",
            \"action\": \"pull\"
        }, {
            \"resource\": \"repository\",
            \"action\": \"list\"
        }]
    }]
}")

if echo "$ROBOT_RESPONSE" | grep -q "secret"; then
    ROBOT_SECRET=$(echo "$ROBOT_RESPONSE" | jq -r '.secret')
    ROBOT_USER=$(echo "$ROBOT_RESPONSE" | jq -r '.name')
    print_success "Robot account created"
    print_info "Robot user: $ROBOT_USER"
    
    # Save robot credentials
    cat > "$SCRIPT_DIR/npm-robot-credentials.env" << EOF
# Harbor NPM Robot Account Credentials
# Generated on $(date)
export NPM_ROBOT_USER="$ROBOT_USER"
export NPM_ROBOT_SECRET="$ROBOT_SECRET"
export NPM_AUTH_TOKEN="$(echo -n "$ROBOT_USER:$ROBOT_SECRET" | base64)"
EOF
    chmod 600 "$SCRIPT_DIR/npm-robot-credentials.env"
    print_info "Robot credentials saved to npm-robot-credentials.env"
else
    print_warning "Could not create robot account (might already exist)"
fi

# Create NPM configuration for CI/CD
print_info "Creating CI/CD NPM configuration..."
cat > "$SCRIPT_DIR/npmrc-ci-template" << EOF
# Harbor NPM Registry Configuration for CI/CD
# Use environment variables:
# - NPM_AUTH_TOKEN (base64 encoded user:pass)
# - HARBOR_URL

@gmac:registry=https://\${HARBOR_URL}/npm/
//\${HARBOR_URL}/npm/:_auth=\${NPM_AUTH_TOKEN}
//\${HARBOR_URL}/npm/:always-auth=true
//\${HARBOR_URL}/npm/:email=ci@gmac.io

# Fallback to public registry
registry=https://registry.npmjs.org/
EOF

# Update project setup script to include NPM configuration
print_info "Updating project setup script..."
if grep -q "NPM Registry Configuration" "$SCRIPT_DIR/setup-project.sh"; then
    print_info "Project setup script already includes NPM configuration"
else
    # Add NPM setup to project creation
    cat >> "$SCRIPT_DIR/setup-project-npm-addon.sh" << 'EOF'
# NPM Registry Configuration Addon for setup-project.sh

# Add to Dockerfile for Node.js projects
if [ "$PROJECT_TYPE" = "node" ] && [ ! -f .npmrc ]; then
    print_info "Configuring NPM registry for project..."
    
    # Create .npmrc for builds
    cat > .npmrc.docker << 'NPMRC'
# Harbor NPM Registry (for Docker builds)
@gmac:registry=https://${HARBOR_URL}/npm/
//${HARBOR_URL}/npm/:_auth=${NPM_AUTH_TOKEN}
//${HARBOR_URL}/npm/:always-auth=true
registry=https://registry.npmjs.org/
NPMRC

    # Update Dockerfile to use .npmrc
    sed -i.bak '/COPY package\*.json/a\
# Copy NPM configuration\
ARG NPM_AUTH_TOKEN\
ARG HARBOR_URL=registry.gmac.io\
COPY .npmrc.docker /root/.npmrc\
RUN sed -i "s/\${HARBOR_URL}/$HARBOR_URL/g; s/\${NPM_AUTH_TOKEN}/$NPM_AUTH_TOKEN/g" /root/.npmrc
' Dockerfile && rm Dockerfile.bak

    # Update GitHub Actions workflow
    sed -i.bak '/Build and push/i\
      - name: Setup NPM Registry\
        run: |\
          echo "@gmac:registry=https://${{ env.REGISTRY }}/npm/" > ~/.npmrc\
          echo "//${{ env.REGISTRY }}/npm/:_auth=${{ secrets.NPM_AUTH_TOKEN }}" >> ~/.npmrc\
          echo "//${{ env.REGISTRY }}/npm/:always-auth=true" >> ~/.npmrc\
' .github/workflows/deploy.yml && rm .github/workflows/deploy.yml.bak

    print_info "Added NPM registry configuration"
fi
EOF
    chmod +x "$SCRIPT_DIR/setup-project-npm-addon.sh"
fi

# Create GitHub Actions secret setup script
cat > "$SCRIPT_DIR/setup-github-npm-secret.sh" << 'EOF'
#!/bin/bash
# Setup GitHub/Gitea secret for NPM authentication

REPO_NAME="$1"
if [ -z "$REPO_NAME" ]; then
    echo "Usage: $0 <repository-name>"
    exit 1
fi

# Load NPM robot credentials
source "$(dirname "$0")/npm-robot-credentials.env"

echo "Setting NPM_AUTH_TOKEN secret for repository: $REPO_NAME"
echo ""
echo "For GitHub:"
echo "  gh secret set NPM_AUTH_TOKEN -b '$NPM_AUTH_TOKEN' -R $REPO_NAME"
echo ""
echo "For Gitea:"
echo "  Add secret 'NPM_AUTH_TOKEN' with value: $NPM_AUTH_TOKEN"
echo ""
echo "For Kubernetes:"
echo "  kubectl create secret generic npm-registry \\"
echo "    --from-literal=NPM_AUTH_TOKEN='$NPM_AUTH_TOKEN' \\"
echo "    -n <namespace>"
EOF
chmod +x "$SCRIPT_DIR/setup-github-npm-secret.sh"

print_success "✅ Harbor NPM setup complete!"
echo
print_info "📋 Next Steps:"
echo "1. Configure NPM locally:"
echo "   ./setup-npm-registry.sh --global"
echo ""
echo "2. Configure NPM for a project:"
echo "   ./setup-npm-registry.sh --project /path/to/project"
echo ""
echo "3. Publish your first package:"
echo "   npm init --scope=@gmac"
echo "   npm publish"
echo ""
echo "4. Install private packages:"
echo "   npm install @gmac/package-name"
echo ""
print_info "🔐 Security:"
echo "- Robot credentials saved in: npm-robot-credentials.env"
echo "- Use these for CI/CD systems"
echo "- Never commit .npmrc files with auth tokens"
echo ""
print_info "🏗️ CI/CD Integration:"
echo "- Template .npmrc for CI: npmrc-ci-template"
echo "- Add NPM_AUTH_TOKEN secret to your CI/CD"
echo "- See setup-github-npm-secret.sh for details"