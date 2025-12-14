#!/bin/bash
set -euo pipefail

# Secret Management Script for K3s Deployments

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

: ${KUBECONFIG:="/Users/mackieg/.kube/config-hetzner"}

# Default values
NAMESPACE=""
SECRET_NAME=""
ACTION="list"
KEY=""
VALUE=""
FROM_FILE=""

usage() {
    cat << EOF
Usage: $0 --namespace <namespace> --secret <name> [OPTIONS]

Actions:
  list                    List all keys in secret (default)
  get <key>              Get value of specific key
  set <key> <value>      Set or update a key
  delete <key>           Delete a key
  create                 Create new secret
  update-from-env        Update from .env file

Options:
  --namespace <ns>       Kubernetes namespace
  --secret <name>        Secret name
  --from-file <file>     Load from .env file

Examples:
  # List all secrets in a namespace
  $0 --namespace my-app --secret my-app-secrets list

  # Set a new secret value
  $0 --namespace my-app --secret my-app-secrets set DATABASE_URL "postgres://..."

  # Update from .env file
  $0 --namespace my-app --secret my-app-secrets update-from-env --from-file .env.production

EOF
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --secret)
            SECRET_NAME="$2"
            shift 2
            ;;
        --from-file)
            FROM_FILE="$2"
            shift 2
            ;;
        list|get|set|delete|create|update-from-env)
            ACTION="$1"
            shift
            if [ "$ACTION" = "get" ] || [ "$ACTION" = "delete" ]; then
                KEY="${1:-}"
                [ -n "$KEY" ] && shift
            elif [ "$ACTION" = "set" ]; then
                KEY="${1:-}"
                VALUE="${2:-}"
                [ -n "$KEY" ] && shift
                [ -n "$VALUE" ] && shift
            fi
            ;;
        -h|--help)
            usage
            ;;
        *)
            # Might be key/value for set action
            if [ "$ACTION" = "set" ] && [ -z "$KEY" ]; then
                KEY="$1"
            elif [ "$ACTION" = "set" ] && [ -z "$VALUE" ]; then
                VALUE="$1"
            elif [ "$ACTION" = "get" ] && [ -z "$KEY" ]; then
                KEY="$1"
            elif [ "$ACTION" = "delete" ] && [ -z "$KEY" ]; then
                KEY="$1"
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [ -z "$NAMESPACE" ] || [ -z "$SECRET_NAME" ]; then
    print_error "Namespace and secret name are required"
    usage
fi

# Execute action
case "$ACTION" in
    list)
        print_info "Listing keys in secret '$SECRET_NAME' (namespace: $NAMESPACE)"
        kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json 2>/dev/null | \
            jq -r '.data | keys[]' || echo "Secret not found or empty"
        ;;
        
    get)
        if [ -z "$KEY" ]; then
            print_error "Key required for get action"
            exit 1
        fi
        VALUE=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json 2>/dev/null | \
            jq -r ".data[\"$KEY\"] // empty" | base64 -d)
        if [ -n "$VALUE" ]; then
            echo "$VALUE"
        else
            print_error "Key '$KEY' not found in secret"
            exit 1
        fi
        ;;
        
    set)
        if [ -z "$KEY" ] || [ -z "$VALUE" ]; then
            print_error "Key and value required for set action"
            exit 1
        fi
        
        # Get existing secret data
        EXISTING_DATA=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json 2>/dev/null | \
            jq -c '.data // {}')
        
        if [ "$EXISTING_DATA" = "{}" ]; then
            # Create new secret
            kubectl create secret generic "$SECRET_NAME" \
                --from-literal="$KEY=$VALUE" \
                -n "$NAMESPACE" \
                --dry-run=client -o yaml | kubectl apply -f -
        else
            # Update existing secret
            kubectl patch secret "$SECRET_NAME" -n "$NAMESPACE" \
                --type='json' \
                -p="[{\"op\": \"add\", \"path\": \"/data/$KEY\", \"value\": \"$(echo -n "$VALUE" | base64 -w 0)\"}]"
        fi
        
        print_success "Set $KEY in secret $SECRET_NAME"
        ;;
        
    delete)
        if [ -z "$KEY" ]; then
            print_error "Key required for delete action"
            exit 1
        fi
        
        kubectl patch secret "$SECRET_NAME" -n "$NAMESPACE" \
            --type='json' \
            -p="[{\"op\": \"remove\", \"path\": \"/data/$KEY\"}]" && \
        print_success "Deleted $KEY from secret $SECRET_NAME" || \
        print_error "Failed to delete key"
        ;;
        
    create)
        kubectl create secret generic "$SECRET_NAME" \
            -n "$NAMESPACE" \
            --dry-run=client -o yaml | kubectl apply -f -
        print_success "Created secret $SECRET_NAME in namespace $NAMESPACE"
        ;;
        
    update-from-env)
        if [ -z "$FROM_FILE" ] || [ ! -f "$FROM_FILE" ]; then
            print_error "Valid .env file required for update-from-env action"
            exit 1
        fi
        
        print_info "Updating secret from $FROM_FILE"
        
        # Create secret from env file
        kubectl create secret generic "$SECRET_NAME" \
            --from-env-file="$FROM_FILE" \
            -n "$NAMESPACE" \
            --dry-run=client -o yaml | kubectl apply -f -
            
        print_success "Updated secret $SECRET_NAME from $FROM_FILE"
        ;;
        
    *)
        print_error "Unknown action: $ACTION"
        usage
        ;;
esac