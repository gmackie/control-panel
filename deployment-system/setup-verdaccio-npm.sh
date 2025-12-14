#!/bin/bash
set -euo pipefail

# Setup NPM to use existing Verdaccio registry at npm.gmac.io

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Configuration
NPM_REGISTRY_URL="https://npm.gmac.io"
SCOPE="@gmac"
DEFAULT_USER="admin"
DEFAULT_PASSWORD="verdaccio123"  # You'll need to set this to the actual password

# Parse arguments
SETUP_GLOBAL=false
SETUP_PROJECT=false
PROJECT_PATH=""
NPM_USER=""
NPM_PASSWORD=""

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Configure NPM to use the Verdaccio registry at npm.gmac.io

Options:
  --global              Configure globally for current user
  --project <path>      Configure for specific project
  --user <username>     NPM username (default: admin)
  --password <pass>     NPM password (required for first login)
  --scope <scope>       NPM scope (default: @gmac)
  --help                Show this help

Examples:
  # Configure globally with login
  $0 --global --user admin --password yourpassword

  # Configure for project
  $0 --project . --user ci-build --password cipassword

  # Just create .npmrc without login
  $0 --project . --no-login

EOF
    exit 1
}

# Parse command line arguments
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
        --user)
            NPM_USER="$2"
            shift 2
            ;;
        --password)
            NPM_PASSWORD="$2"
            shift 2
            ;;
        --scope)
            SCOPE="$2"
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

# Validate options
if [ "$SETUP_GLOBAL" = false ] && [ "$SETUP_PROJECT" = false ]; then
    print_error "Please specify --global or --project"
    usage
fi

print_info "🔧 NPM Registry Setup for Verdaccio"
print_info "  Registry: $NPM_REGISTRY_URL"
print_info "  Scope: $SCOPE"
echo

# Function to configure NPM
configure_npm() {
    local npm_cmd="$1"
    local is_global="$2"
    
    print_info "Setting registry for $SCOPE..."
    if [ "$is_global" = true ]; then
        npm config set "${SCOPE}:registry" "$NPM_REGISTRY_URL"
        npm config set "registry" "https://registry.npmjs.org/"
    fi
    
    print_success "NPM configuration updated"
}

# Global configuration
if [ "$SETUP_GLOBAL" = true ]; then
    print_info "Configuring NPM globally..."
    configure_npm "npm config" true
    
    # Login if credentials provided
    if [ -n "$NPM_USER" ] && [ -n "$NPM_PASSWORD" ]; then
        print_info "Logging in to NPM registry..."
        npm logout --registry="$NPM_REGISTRY_URL" 2>/dev/null || true
        
        # Create expect script for npm login
        cat > /tmp/npm-login.exp << EOF
#!/usr/bin/expect -f
set timeout 30
spawn npm login --registry=$NPM_REGISTRY_URL --scope=$SCOPE
expect "Username:"
send "$NPM_USER\r"
expect "Password:"
send "$NPM_PASSWORD\r"
expect "Email:"
send "npm@gmac.io\r"
expect eof
EOF
        chmod +x /tmp/npm-login.exp
        
        if command -v expect &> /dev/null; then
            /tmp/npm-login.exp
            rm -f /tmp/npm-login.exp
            print_success "Logged in to NPM registry"
        else
            print_warning "expect not installed. Manual login required:"
            echo "  npm login --registry=$NPM_REGISTRY_URL --scope=$SCOPE"
        fi
    else
        print_info "No credentials provided. You'll need to login manually:"
        echo "  npm login --registry=$NPM_REGISTRY_URL --scope=$SCOPE"
    fi
    
    # Show current configuration
    print_info "Current NPM configuration:"
    npm config list | grep -E "(registry|$NPM_REGISTRY_URL)" || true
fi

# Project configuration
if [ "$SETUP_PROJECT" = true ]; then
    PROJECT_PATH=$(realpath "$PROJECT_PATH")
    print_info "Configuring NPM for project: $PROJECT_PATH"
    
    cd "$PROJECT_PATH"
    
    # Get auth token from npm config if logged in
    AUTH_TOKEN=""
    if [ -f ~/.npmrc ]; then
        AUTH_TOKEN=$(grep "${NPM_REGISTRY_URL/:\/\//:}" ~/.npmrc | cut -d= -f2 || true)
    fi
    
    # Create .npmrc
    cat > .npmrc << EOF
# Verdaccio NPM Registry Configuration
${SCOPE}:registry=${NPM_REGISTRY_URL}
registry=https://registry.npmjs.org/
EOF

    if [ -n "$AUTH_TOKEN" ]; then
        echo "${NPM_REGISTRY_URL/:\/\//:}:_authToken=${AUTH_TOKEN}" >> .npmrc
        print_info "Added authentication token from global config"
    else
        print_warning "No auth token found. You'll need to login first."
    fi
    
    print_success "Created .npmrc in $PROJECT_PATH"
    
    # Add .npmrc to .gitignore
    if [ -f .gitignore ] && ! grep -q "^.npmrc" .gitignore; then
        echo -e "\n# NPM configuration\n.npmrc" >> .gitignore
        print_info "Added .npmrc to .gitignore"
    fi
fi

# Test registry access
print_info "Testing registry access..."
if curl -s "$NPM_REGISTRY_URL" | grep -q "verdaccio"; then
    print_success "Verdaccio registry is accessible"
else
    print_error "Could not reach Verdaccio registry"
fi

# Create helper scripts
if [ "$SETUP_PROJECT" = true ]; then
    # Create publish helper
    cat > "$PROJECT_PATH/npm-publish.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Publish to Verdaccio NPM registry

REGISTRY="https://npm.gmac.io"
SCOPE="@gmac"

if [ ! -f package.json ]; then
    echo "Error: package.json not found"
    exit 1
fi

# Check if logged in
if ! npm whoami --registry="$REGISTRY" &>/dev/null; then
    echo "Not logged in. Please run:"
    echo "  npm login --registry=$REGISTRY --scope=$SCOPE"
    exit 1
fi

# Get package info
PACKAGE_NAME=$(node -p "require('./package.json').name")
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "Publishing $PACKAGE_NAME@$CURRENT_VERSION to Verdaccio..."

# Ensure package name has scope
if [[ ! "$PACKAGE_NAME" =~ ^@.+/.+ ]]; then
    echo "Warning: Package name should be scoped (e.g., $SCOPE/package-name)"
fi

# Run tests if available
npm test --if-present

# Build if needed
npm run build --if-present

# Publish
npm publish --registry="$REGISTRY"

echo "✅ Published successfully!"
echo "Install with: npm install $PACKAGE_NAME --registry=$REGISTRY"
EOF
    chmod +x "$PROJECT_PATH/npm-publish.sh"
    
    # Create example package.json if none exists
    if [ ! -f "$PROJECT_PATH/package.json" ]; then
        cat > "$PROJECT_PATH/package.json" << EOF
{
  "name": "${SCOPE}/my-package",
  "version": "1.0.0",
  "description": "Example package for Verdaccio",
  "main": "index.js",
  "publishConfig": {
    "registry": "${NPM_REGISTRY_URL}"
  },
  "scripts": {
    "test": "echo \"No tests yet\" && exit 0"
  }
}
EOF
        print_info "Created example package.json"
    fi
fi

print_success "✅ Verdaccio NPM setup complete!"
echo
print_info "📋 Next Steps:"
echo "1. Login to registry:"
echo "   npm login --registry=$NPM_REGISTRY_URL --scope=$SCOPE"
echo "   Username: admin or ci-build"
echo "   Password: (check with your admin)"
echo ""
echo "2. Publish packages:"
echo "   npm publish --registry=$NPM_REGISTRY_URL"
echo ""
echo "3. Install packages:"
echo "   npm install ${SCOPE}/package-name"
echo ""
print_info "🔐 Known Users:"
echo "  - admin (full access)"
echo "  - ci-build (for CI/CD systems)"
echo ""
print_warning "⚠️  Note: You need the actual passwords for these users."
print_info "Contact your administrator or check the initial setup documentation."