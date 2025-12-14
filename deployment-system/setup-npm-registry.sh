#!/bin/bash
set -euo pipefail

# NPM Registry Setup Script for Harbor

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Load credentials
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/credentials.env" ]; then
    source "$SCRIPT_DIR/credentials.env"
fi

# Configuration
HARBOR_URL="${HARBOR_URL:-registry.gmac.io}"
HARBOR_USER="${HARBOR_USER:-admin}"
HARBOR_PASSWORD="${HARBOR_PASSWORD:-Harbor12345}"
NPM_REGISTRY="https://$HARBOR_URL/npm/"
SCOPE="@gmac"
SETUP_GLOBAL=false
SETUP_PROJECT=false
PROJECT_PATH=""

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Configure NPM to use Harbor private registry.

Options:
  --global              Configure globally for current user
  --project <path>      Configure for specific project
  --scope <scope>       NPM scope (default: @gmac)
  --registry-url <url>  Custom registry URL
  --help                Show this help

Examples:
  # Configure globally
  $0 --global

  # Configure for current project
  $0 --project .

  # Configure with custom scope
  $0 --global --scope @mycompany

EOF
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --global)
            SETUP_GLOBAL=true
            shift
            ;;
        --project)
            SETUP_PROJECT=true
            PROJECT_PATH="$2"
            shift 2
            ;;
        --scope)
            SCOPE="$2"
            shift 2
            ;;
        --registry-url)
            NPM_REGISTRY="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Ensure at least one setup type is selected
if [ "$SETUP_GLOBAL" = false ] && [ "$SETUP_PROJECT" = false ]; then
    print_error "Please specify --global or --project"
    usage
fi

print_info "🔧 NPM Registry Setup"
print_info "  Registry: $NPM_REGISTRY"
print_info "  Scope: $SCOPE"
print_info "  User: $HARBOR_USER"
echo

# Generate auth token (base64 encoded username:password)
AUTH_TOKEN=$(echo -n "$HARBOR_USER:$HARBOR_PASSWORD" | base64)

# Function to configure NPM
configure_npm() {
    local config_cmd="$1"
    
    # Set registry for scope
    print_info "Setting registry for $SCOPE..."
    $config_cmd set "${SCOPE}:registry" "$NPM_REGISTRY"
    
    # Set authentication
    print_info "Setting authentication..."
    # Harbor uses basic auth, we need to set _auth
    $config_cmd set "//${HARBOR_URL}/npm/:_auth" "$AUTH_TOKEN"
    $config_cmd set "//${HARBOR_URL}/npm/:always-auth" "true"
    
    # Set email (required by some registries)
    $config_cmd set "//${HARBOR_URL}/npm/:email" "npm@gmac.io"
    
    # For publishing packages
    $config_cmd set "${SCOPE}:registry" "https://$HARBOR_URL/npm/"
    
    print_success "NPM configuration updated"
}

# Global configuration
if [ "$SETUP_GLOBAL" = true ]; then
    print_info "Configuring NPM globally..."
    configure_npm "npm config"
    
    # Show current configuration
    print_info "Current global NPM configuration:"
    npm config list | grep -E "(registry|auth|$HARBOR_URL)" || true
    echo
fi

# Project configuration
if [ "$SETUP_PROJECT" = true ]; then
    # Resolve project path
    PROJECT_PATH=$(realpath "$PROJECT_PATH")
    print_info "Configuring NPM for project: $PROJECT_PATH"
    
    cd "$PROJECT_PATH"
    
    # Create .npmrc file
    cat > .npmrc << EOF
# Harbor NPM Registry Configuration
${SCOPE}:registry=https://${HARBOR_URL}/npm/
//${HARBOR_URL}/npm/:_auth=${AUTH_TOKEN}
//${HARBOR_URL}/npm/:always-auth=true
//${HARBOR_URL}/npm/:email=npm@gmac.io

# Fallback to public registry for non-scoped packages
registry=https://registry.npmjs.org/

# Security settings
package-lock=true
save-exact=false
EOF
    
    print_success "Created .npmrc in $PROJECT_PATH"
    
    # Add .npmrc to .gitignore if it exists
    if [ -f .gitignore ]; then
        if ! grep -q "^.npmrc" .gitignore; then
            echo -e "\n# NPM configuration (contains auth tokens)\n.npmrc" >> .gitignore
            print_info "Added .npmrc to .gitignore"
        fi
    fi
fi

# Test the configuration
print_info "Testing registry access..."
if npm view "${SCOPE}/test" --registry "$NPM_REGISTRY" &>/dev/null; then
    print_success "Successfully connected to Harbor NPM registry"
else
    print_warning "Could not fetch test package (this is normal if no packages are published yet)"
fi

# Create example package.json for publishing
if [ "$SETUP_PROJECT" = true ]; then
    if [ ! -f "$PROJECT_PATH/package.json" ]; then
        print_info "Creating example package.json..."
        cat > "$PROJECT_PATH/package.json" << EOF
{
  "name": "${SCOPE}/my-package",
  "version": "1.0.0",
  "description": "Example package for Harbor NPM registry",
  "main": "index.js",
  "publishConfig": {
    "registry": "https://${HARBOR_URL}/npm/"
  },
  "repository": {
    "type": "git",
    "url": "https://git.gmac.io/gmackie/my-package.git"
  }
}
EOF
        print_info "Created example package.json"
    fi
fi

print_success "✅ NPM registry setup complete!"
echo
print_info "📋 Next Steps:"
echo

if [ "$SETUP_GLOBAL" = true ]; then
    cat << EOF
Global Configuration:
1. Install private packages: npm install ${SCOPE}/package-name
2. Publish packages: npm publish --registry $NPM_REGISTRY
3. Set as default for scope: npm config set ${SCOPE}:registry $NPM_REGISTRY

EOF
fi

if [ "$SETUP_PROJECT" = true ]; then
    cat << EOF
Project Configuration:
1. The .npmrc file has been created in your project
2. Install dependencies: npm install
3. Publish this package: npm publish
4. Install in other projects: npm install ${SCOPE}/$(basename "$PROJECT_PATH")

EOF
fi

cat << EOF
📦 Publishing a Package:
1. Ensure package.json has "${SCOPE}/" prefix in name
2. Set version: npm version patch/minor/major
3. Publish: npm publish
4. View in Harbor: https://$HARBOR_URL

🔐 Security Notes:
- .npmrc contains authentication tokens
- Always add .npmrc to .gitignore
- Use environment variables in CI/CD

🔧 Troubleshooting:
- Login issues: npm logout && npm login --registry $NPM_REGISTRY
- Clear cache: npm cache clean --force
- Verbose logging: npm install --verbose
EOF

# Create helper scripts
if [ "$SETUP_PROJECT" = true ]; then
    cat > "$PROJECT_PATH/npm-publish.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Helper script to publish to Harbor NPM registry

if [ ! -f package.json ]; then
    echo "Error: package.json not found"
    exit 1
fi

PACKAGE_NAME=$(node -p "require('./package.json').name")
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "Publishing $PACKAGE_NAME@$CURRENT_VERSION to Harbor..."

# Ensure we're logged in
npm whoami --registry https://registry.gmac.io/npm/ || {
    echo "Not logged in. Please run: npm login --registry https://registry.gmac.io/npm/"
    exit 1
}

# Run tests if they exist
if npm run test --if-present; then
    echo "Tests passed"
else
    echo "Warning: No tests or tests failed"
fi

# Build if build script exists
npm run build --if-present

# Publish
npm publish

echo "✅ Published successfully!"
echo "Install with: npm install $PACKAGE_NAME"
EOF
    chmod +x "$PROJECT_PATH/npm-publish.sh"
    print_info "Created npm-publish.sh helper script"
fi