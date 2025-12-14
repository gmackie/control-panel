#!/bin/bash
set -euo pipefail

# Complete deployment script that combines project setup and deployment

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for required argument
if [ $# -lt 1 ]; then
    cat << EOF
${YELLOW}Complete Project Setup and Deployment${NC}

Usage: $0 <project-path> [OPTIONS]

This script combines project setup and initial deployment.

Options:
  All options from setup-project.sh are supported:
  --name <name>          Project name (required)
  --domain <domain>      Primary domain
  --staging              Create staging environment
  --turso-db            Create Turso database
  --port <port>         Application port
  --type <type>         Project type
  --auto-deploy         Automatically deploy after setup

Examples:
  # Basic setup and deploy
  $0 ./my-app --name my-app --auto-deploy

  # Full setup with database and staging
  $0 ./my-app --name my-app --domain my-app.gmac.io --staging --turso-db --auto-deploy

EOF
    exit 1
fi

# Extract project path (first argument)
PROJECT_PATH="$1"
shift

# Check for --auto-deploy flag
AUTO_DEPLOY=false
ARGS=()
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-deploy)
            AUTO_DEPLOY=true
            shift
            ;;
        *)
            ARGS+=("$1")
            shift
            ;;
    esac
done

# Run project setup
print_info "Running project setup..."
if "$SCRIPT_DIR/setup-project.sh" --path "$PROJECT_PATH" "${ARGS[@]}"; then
    print_success "Project setup completed"
else
    print_error "Project setup failed"
    exit 1
fi

# Change to project directory
cd "$PROJECT_PATH"

# Get project name from the setup
PROJECT_NAME=""
for ((i=0; i<${#ARGS[@]}; i++)); do
    if [ "${ARGS[$i]}" = "--name" ] && [ $((i+1)) -lt ${#ARGS[@]} ]; then
        PROJECT_NAME="${ARGS[$((i+1))]}"
        break
    fi
done

if [ -z "$PROJECT_NAME" ]; then
    print_error "Could not determine project name"
    exit 1
fi

# Commit and push if git is initialized
if [ -d .git ] && git remote get-url origin &>/dev/null; then
    print_info "Committing and pushing to Git..."
    git add -A
    git commit -m "Initial deployment setup" || true
    
    if git push -u origin main 2>/dev/null || git push -u origin master 2>/dev/null; then
        print_success "Code pushed to repository"
    else
        print_warning "Could not push to repository - you may need to do this manually"
    fi
fi

# Auto-deploy if requested
if [ "$AUTO_DEPLOY" = true ]; then
    print_info "Starting deployment..."
    
    # Apply Kubernetes manifests
    if [ -f deploy.sh ]; then
        ./deploy.sh
    else
        kubectl apply -f k8s/
    fi
    
    # Wait for deployment
    print_info "Waiting for deployment to be ready..."
    kubectl wait --for=condition=available --timeout=300s \
        deployment/"$PROJECT_NAME" -n "$PROJECT_NAME" || true
    
    # Get pod status
    print_info "Current pod status:"
    kubectl get pods -n "$PROJECT_NAME"
    
    # Get ingress info
    DOMAIN=$(kubectl get ingress -n "$PROJECT_NAME" -o json | jq -r '.items[0].spec.rules[0].host // empty')
    if [ -n "$DOMAIN" ]; then
        print_success "Application will be available at: https://$DOMAIN"
    fi
fi

print_success "✅ Complete setup finished!"
echo
print_info "📋 Next Steps:"
echo "  1. Monitor deployment: kubectl get pods -n $PROJECT_NAME -w"
echo "  2. Check ArgoCD: https://cd.gmac.io/applications/$PROJECT_NAME"
echo "  3. View logs: kubectl logs -n $PROJECT_NAME -l app=$PROJECT_NAME -f"

if [ "$AUTO_DEPLOY" != true ]; then
    echo
    print_info "To deploy manually, run:"
    echo "  cd $PROJECT_PATH && ./deploy.sh"
fi