#!/bin/bash

# GMAC.IO Control Panel Production Deployment Script
# This script handles the complete production deployment process

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-registry.gmac.io}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
KUBE_NAMESPACE="${KUBE_NAMESPACE:-control-panel}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_step "Checking deployment prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "helm" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            return 1
        fi
    done
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    # Check Docker registry access
    if ! docker login "$DOCKER_REGISTRY" &> /dev/null; then
        log_error "Cannot authenticate with Docker registry $DOCKER_REGISTRY"
        return 1
    fi
    
    # Verify namespace exists
    if ! kubectl get namespace "$KUBE_NAMESPACE" &> /dev/null; then
        log_warning "Namespace '$KUBE_NAMESPACE' does not exist, creating..."
        kubectl create namespace "$KUBE_NAMESPACE"
    fi
    
    log_success "All prerequisites satisfied"
}

# Function to run pre-deployment tests
run_pre_deployment_tests() {
    log_step "Running pre-deployment tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run unit tests
    log_info "Running unit tests..."
    npm run test -- --coverage --watchAll=false
    
    # Run type checking
    log_info "Running TypeScript type checking..."
    npm run type-check
    
    # Run linting
    log_info "Running code linting..."
    npm run lint
    
    # Run security audit
    log_info "Running security audit..."
    npm audit --audit-level=moderate
    
    # Build application
    log_info "Building application..."
    npm run build
    
    log_success "All pre-deployment tests passed"
}

# Function to build and push Docker image
build_and_push_image() {
    log_step "Building and pushing Docker image..."
    
    cd "$PROJECT_ROOT"
    
    local image_name="$DOCKER_REGISTRY/gmac/control-panel"
    local full_tag="$image_name:$IMAGE_TAG"
    local latest_tag="$image_name:latest"
    
    log_info "Building image: $full_tag"
    
    # Build multi-platform image
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "$full_tag" \
        --tag "$latest_tag" \
        --push \
        --file Dockerfile \
        .
    
    # Scan image for vulnerabilities
    if command -v trivy &> /dev/null; then
        log_info "Scanning image for vulnerabilities..."
        trivy image --exit-code 1 --severity HIGH,CRITICAL "$full_tag" || {
            log_warning "Image vulnerabilities found, but proceeding with deployment"
        }
    fi
    
    log_success "Docker image built and pushed: $full_tag"
}

# Function to backup current deployment
backup_current_deployment() {
    if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
        log_step "Creating backup of current deployment..."
        
        local backup_dir="/backups/pre-deployment-$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Backup Kubernetes resources
        kubectl get all,configmap,secret,ingress,pvc -n "$KUBE_NAMESPACE" -o yaml > "$backup_dir/kubernetes-resources.yaml"
        
        # Backup database
        if kubectl get deployment postgres -n "$KUBE_NAMESPACE" &> /dev/null; then
            log_info "Backing up database..."
            kubectl exec -n "$KUBE_NAMESPACE" deployment/postgres -- pg_dump -U control_panel_user control_panel | gzip > "$backup_dir/database.sql.gz"
        fi
        
        # Create metadata file
        cat > "$backup_dir/metadata.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "environment": "$DEPLOYMENT_ENV",
  "namespace": "$KUBE_NAMESPACE",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD)",
  "deployer": "${USER:-unknown}",
  "backup_type": "pre-deployment"
}
EOF
        
        log_success "Backup created: $backup_dir"
        echo "$backup_dir" > /tmp/last-backup-path
    else
        log_info "Backup skipped (BACKUP_BEFORE_DEPLOY=false)"
    fi
}

# Function to deploy using Helm
deploy_with_helm() {
    log_step "Deploying application with Helm..."
    
    cd "$PROJECT_ROOT"
    
    # Check if Helm chart exists
    if [ ! -d "helm/control-panel" ]; then
        log_error "Helm chart not found at helm/control-panel"
        return 1
    fi
    
    # Update Helm dependencies
    helm dependency update helm/control-panel
    
    # Create values file for this deployment
    local values_file="/tmp/values-${DEPLOYMENT_ENV}-${IMAGE_TAG}.yaml"
    
    cat > "$values_file" <<EOF
image:
  repository: ${DOCKER_REGISTRY}/gmac/control-panel
  tag: ${IMAGE_TAG}
  pullPolicy: Always

environment: ${DEPLOYMENT_ENV}

replicaCount: 3

resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

service:
  type: ClusterIP
  port: 3000

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: control.gmac.io
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: control-panel-tls
      hosts:
        - control.gmac.io

postgresql:
  enabled: true
  auth:
    database: control_panel
    username: control_panel_user
    existingSecret: postgres-secret
  primary:
    persistence:
      size: 20Gi
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "1Gi"
        cpu: "500m"

redis:
  enabled: true
  auth:
    enabled: true
    existingSecret: redis-secret
  master:
    persistence:
      size: 8Gi
    resources:
      requests:
        memory: "128Mi"
        cpu: "50m"
      limits:
        memory: "512Mi"
        cpu: "200m"

monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    namespace: monitoring

networkPolicy:
  enabled: true

podSecurityPolicy:
  enabled: true

secrets:
  create: false
  existingSecret: control-panel-secrets
EOF
    
    # Deploy or upgrade with Helm
    local release_name="control-panel"
    
    if helm list -n "$KUBE_NAMESPACE" | grep -q "$release_name"; then
        log_info "Upgrading existing Helm release..."
        helm upgrade "$release_name" helm/control-panel \
            --namespace "$KUBE_NAMESPACE" \
            --values "$values_file" \
            --atomic \
            --timeout 10m \
            --wait
    else
        log_info "Installing new Helm release..."
        helm install "$release_name" helm/control-panel \
            --namespace "$KUBE_NAMESPACE" \
            --values "$values_file" \
            --atomic \
            --timeout 10m \
            --wait \
            --create-namespace
    fi
    
    log_success "Helm deployment completed"
    rm -f "$values_file"
}

# Function to deploy using kubectl (fallback)
deploy_with_kubectl() {
    log_step "Deploying application with kubectl..."
    
    cd "$PROJECT_ROOT"
    
    # Update image tags in deployment files
    local temp_dir="/tmp/k8s-deployment-${IMAGE_TAG}"
    mkdir -p "$temp_dir"
    cp -r k8s/* "$temp_dir/"
    
    # Replace image tag in deployment
    sed -i "s|registry.gmac.io/gmac/control-panel:.*|${DOCKER_REGISTRY}/gmac/control-panel:${IMAGE_TAG}|g" "$temp_dir/04-deployment.yaml"
    
    # Apply Kubernetes manifests
    kubectl apply -f "$temp_dir/" -n "$KUBE_NAMESPACE"
    
    # Wait for deployment to complete
    kubectl rollout status deployment/control-panel -n "$KUBE_NAMESPACE" --timeout=600s
    
    log_success "kubectl deployment completed"
    rm -rf "$temp_dir"
}

# Function to run post-deployment verification
verify_deployment() {
    log_step "Verifying deployment..."
    
    # Wait for pods to be ready
    log_info "Waiting for pods to be ready..."
    kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=control-panel -n "$KUBE_NAMESPACE" --timeout=300s
    
    # Check deployment status
    local replicas_ready
    replicas_ready=$(kubectl get deployment control-panel -n "$KUBE_NAMESPACE" -o jsonpath='{.status.readyReplicas}')
    local replicas_desired
    replicas_desired=$(kubectl get deployment control-panel -n "$KUBE_NAMESPACE" -o jsonpath='{.spec.replicas}')
    
    if [ "$replicas_ready" != "$replicas_desired" ]; then
        log_error "Deployment not ready: $replicas_ready/$replicas_desired replicas ready"
        return 1
    fi
    
    # Test health endpoint
    log_info "Testing health endpoint..."
    local health_url="https://control.gmac.io/api/health"
    
    for i in {1..30}; do
        if curl -sf "$health_url" > /dev/null; then
            log_success "Health check passed"
            break
        fi
        
        if [ $i -eq 30 ]; then
            log_error "Health check failed after 30 attempts"
            return 1
        fi
        
        log_info "Health check attempt $i/30 failed, retrying in 10s..."
        sleep 10
    done
    
    # Test API endpoints
    log_info "Testing API endpoints..."
    local test_endpoints=(
        "/api/health"
        "/api/auth/verify"
        "/api/monitoring/metrics"
        "/api/cluster/health"
    )
    
    for endpoint in "${test_endpoints[@]}"; do
        local url="https://control.gmac.io$endpoint"
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" -H "Authorization: Bearer test-token" || echo "000")
        
        if [ "$status_code" = "000" ]; then
            log_error "Failed to connect to $endpoint"
            return 1
        elif [ "$status_code" = "401" ]; then
            log_info "$endpoint - Authentication required (expected)"
        elif [ "$status_code" = "200" ]; then
            log_info "$endpoint - OK"
        else
            log_warning "$endpoint - Status: $status_code"
        fi
    done
    
    log_success "Deployment verification completed"
}

# Function to run smoke tests
run_smoke_tests() {
    log_step "Running smoke tests..."
    
    # Run basic smoke tests
    cd "$PROJECT_ROOT"
    
    # Test if we can run E2E tests against production
    if [ -f "tests/e2e/smoke.spec.ts" ]; then
        npx playwright test tests/e2e/smoke.spec.ts --config=playwright.config.production.ts || {
            log_warning "Smoke tests failed, but deployment continues"
        }
    fi
    
    # Run API validation script
    if [ -f "production/validate-apis.sh" ]; then
        bash production/validate-apis.sh || {
            log_warning "API validation failed, but deployment continues"
        }
    fi
    
    log_success "Smoke tests completed"
}

# Function to send deployment notifications
send_deployment_notification() {
    local status="$1"
    local message="$2"
    
    log_info "Sending deployment notification..."
    
    # Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local emoji="🚀"
        if [ "$status" = "failed" ]; then
            emoji="❌"
        elif [ "$status" = "success" ]; then
            emoji="✅"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji Control Panel Deployment $status\n\n**Environment:** $DEPLOYMENT_ENV\n**Image:** ${DOCKER_REGISTRY}/gmac/control-panel:${IMAGE_TAG}\n**Message:** $message\n**Deployed by:** ${USER:-unknown}\n**Time:** $(date)\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || {
            log_warning "Failed to send Slack notification"
        }
    fi
    
    # Email notification (if configured)
    if [ -n "${EMAIL_NOTIFICATION:-}" ] && command -v mail &> /dev/null; then
        {
            echo "Subject: Control Panel Deployment $status"
            echo ""
            echo "Deployment Status: $status"
            echo "Environment: $DEPLOYMENT_ENV"
            echo "Image: ${DOCKER_REGISTRY}/gmac/control-panel:${IMAGE_TAG}"
            echo "Message: $message"
            echo "Deployed by: ${USER:-unknown}"
            echo "Time: $(date)"
            echo ""
            echo "Kubernetes Namespace: $KUBE_NAMESPACE"
            echo "Git Commit: $(git rev-parse HEAD)"
            echo "Git Branch: $(git rev-parse --abbrev-ref HEAD)"
        } | mail "$EMAIL_NOTIFICATION" 2>/dev/null || {
            log_warning "Failed to send email notification"
        }
    fi
}

# Function to handle rollback
handle_rollback() {
    log_error "Deployment failed, initiating rollback..."
    
    # Try Helm rollback first
    if helm list -n "$KUBE_NAMESPACE" | grep -q "control-panel"; then
        log_info "Rolling back Helm release..."
        helm rollback control-panel -n "$KUBE_NAMESPACE" || {
            log_error "Helm rollback failed"
        }
    else
        # Fallback to kubectl rollback
        log_info "Rolling back Kubernetes deployment..."
        kubectl rollout undo deployment/control-panel -n "$KUBE_NAMESPACE" || {
            log_error "kubectl rollback failed"
        }
    fi
    
    # Restore from backup if available
    if [ -f "/tmp/last-backup-path" ]; then
        local backup_path
        backup_path=$(cat /tmp/last-backup-path)
        log_info "Backup available at: $backup_path"
        log_info "To manually restore, run: ./scripts/restore.sh restore $backup_path"
    fi
    
    send_deployment_notification "failed" "Deployment failed and rollback initiated"
}

# Function to cleanup temporary files
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/values-${DEPLOYMENT_ENV}-${IMAGE_TAG}.yaml
    rm -f /tmp/last-backup-path
}

# Main deployment function
main() {
    local start_time
    start_time=$(date +%s)
    
    log_info "=================================="
    log_info "GMAC.IO Control Panel Deployment"
    log_info "=================================="
    log_info "Environment: $DEPLOYMENT_ENV"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "Registry: $DOCKER_REGISTRY"
    log_info "Namespace: $KUBE_NAMESPACE"
    log_info "Started: $(date)"
    log_info "=================================="
    
    # Set trap for cleanup and error handling
    trap 'cleanup; handle_rollback' ERR
    trap 'cleanup' EXIT
    
    # Execute deployment steps
    check_prerequisites
    run_pre_deployment_tests
    build_and_push_image
    backup_current_deployment
    
    # Choose deployment method
    if command -v helm &> /dev/null && [ -d "helm/control-panel" ]; then
        deploy_with_helm
    else
        log_warning "Helm not available or chart missing, using kubectl"
        deploy_with_kubectl
    fi
    
    verify_deployment
    run_smoke_tests
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "=================================="
    log_success "DEPLOYMENT COMPLETED SUCCESSFULLY"
    log_success "=================================="
    log_success "Duration: ${duration}s"
    log_success "Environment: $DEPLOYMENT_ENV"
    log_success "Image: ${DOCKER_REGISTRY}/gmac/control-panel:${IMAGE_TAG}"
    log_success "URL: https://control.gmac.io"
    log_success "=================================="
    
    send_deployment_notification "success" "Deployment completed successfully in ${duration}s"
}

# Help function
show_help() {
    echo "GMAC.IO Control Panel Production Deployment"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV          Environment (default: production)"
    echo "  -t, --tag TAG          Docker image tag (default: git short hash)"
    echo "  -r, --registry REG     Docker registry (default: registry.gmac.io)"
    echo "  -n, --namespace NS     Kubernetes namespace (default: control-panel)"
    echo "  --no-backup           Skip pre-deployment backup"
    echo "  --dry-run             Show what would be deployed without executing"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  SLACK_WEBHOOK_URL     Slack webhook for notifications"
    echo "  EMAIL_NOTIFICATION    Email address for notifications"
    echo "  DOCKER_REGISTRY       Docker registry override"
    echo "  IMAGE_TAG            Image tag override"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Deploy to production"
    echo "  $0 -e staging -t dev-123             # Deploy to staging"
    echo "  $0 --no-backup -t latest             # Deploy without backup"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            DEPLOYMENT_ENV="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        -n|--namespace)
            KUBE_NAMESPACE="$2"
            shift 2
            ;;
        --no-backup)
            BACKUP_BEFORE_DEPLOY="false"
            shift
            ;;
        --dry-run)
            log_info "DRY RUN MODE - No changes will be made"
            DRY_RUN="true"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Execute main function
if [ "${DRY_RUN:-false}" = "true" ]; then
    log_info "DRY RUN: Would deploy ${DOCKER_REGISTRY}/gmac/control-panel:${IMAGE_TAG} to $DEPLOYMENT_ENV"
    exit 0
else
    main "$@"
fi