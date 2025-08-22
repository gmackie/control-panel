#!/bin/bash

# GMAC.IO Control Panel Backup Script
# This script creates backups of the database, configurations, and important data

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
S3_BUCKET="${S3_BUCKET:-gmac-control-panel-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
NAMESPACE="${NAMESPACE:-control-panel}"

# Database configuration
DB_HOST="${DB_HOST:-postgres-service.control-panel.svc.cluster.local}"
DB_NAME="${DB_NAME:-control_panel}"
DB_USER="${DB_USER:-control_panel_user}"

# Timestamp for backup files
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PREFIX="control-panel-backup-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: ${BACKUP_DIR}/${BACKUP_PREFIX}"
    mkdir -p "${BACKUP_DIR}/${BACKUP_PREFIX}"
}

# Backup PostgreSQL database
backup_database() {
    log "Starting database backup..."
    
    if command -v pg_dump &> /dev/null; then
        log "Using pg_dump for database backup"
        PGPASSWORD="${DB_PASSWORD}" pg_dump \
            -h "${DB_HOST}" \
            -U "${DB_USER}" \
            -d "${DB_NAME}" \
            --no-owner \
            --no-privileges \
            --clean \
            --if-exists \
            > "${BACKUP_DIR}/${BACKUP_PREFIX}/database.sql"
    else
        log "Using kubectl exec for database backup"
        kubectl exec -n "${NAMESPACE}" deployment/postgres -- pg_dump \
            -U "${DB_USER}" \
            -d "${DB_NAME}" \
            --no-owner \
            --no-privileges \
            --clean \
            --if-exists \
            > "${BACKUP_DIR}/${BACKUP_PREFIX}/database.sql"
    fi
    
    # Compress the database backup
    gzip "${BACKUP_DIR}/${BACKUP_PREFIX}/database.sql"
    log "Database backup completed: database.sql.gz"
}

# Backup Kubernetes manifests and secrets
backup_kubernetes_config() {
    log "Starting Kubernetes configuration backup..."
    
    # Create k8s backup directory
    mkdir -p "${BACKUP_DIR}/${BACKUP_PREFIX}/k8s"
    
    # Backup all resources in the namespace
    kubectl get all,secrets,configmaps,pvc,ingress -n "${NAMESPACE}" -o yaml > \
        "${BACKUP_DIR}/${BACKUP_PREFIX}/k8s/namespace-resources.yaml"
    
    # Backup individual manifest files
    if [ -d "./k8s" ]; then
        cp -r ./k8s/* "${BACKUP_DIR}/${BACKUP_PREFIX}/k8s/"
    fi
    
    # Backup RBAC and cluster-wide resources
    kubectl get clusterrole,clusterrolebinding -l app.kubernetes.io/name=control-panel -o yaml > \
        "${BACKUP_DIR}/${BACKUP_PREFIX}/k8s/cluster-resources.yaml" || true
    
    log "Kubernetes configuration backup completed"
}

# Backup application configuration
backup_app_config() {
    log "Starting application configuration backup..."
    
    mkdir -p "${BACKUP_DIR}/${BACKUP_PREFIX}/config"
    
    # Backup environment configuration (without secrets)
    if [ -f ".env.example" ]; then
        cp .env.example "${BACKUP_DIR}/${BACKUP_PREFIX}/config/"
    fi
    
    # Backup monitoring configuration
    if [ -d "./monitoring" ]; then
        cp -r ./monitoring "${BACKUP_DIR}/${BACKUP_PREFIX}/config/"
    fi
    
    # Backup docker and CI/CD configurations
    if [ -f "Dockerfile" ]; then
        cp Dockerfile "${BACKUP_DIR}/${BACKUP_PREFIX}/config/"
    fi
    
    if [ -f "docker-compose.yml" ]; then
        cp docker-compose.yml "${BACKUP_DIR}/${BACKUP_PREFIX}/config/"
    fi
    
    if [ -d ".github" ]; then
        cp -r .github "${BACKUP_DIR}/${BACKUP_PREFIX}/config/"
    fi
    
    log "Application configuration backup completed"
}

# Backup persistent volumes (if any)
backup_persistent_volumes() {
    log "Starting persistent volume backup..."
    
    # List all PVCs in the namespace
    PVCs=$(kubectl get pvc -n "${NAMESPACE}" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$PVCs" ]; then
        mkdir -p "${BACKUP_DIR}/${BACKUP_PREFIX}/volumes"
        
        for pvc in $PVCs; do
            log "Backing up PVC: $pvc"
            
            # Create a backup pod to access the volume
            kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: backup-${pvc}
  namespace: ${NAMESPACE}
spec:
  containers:
  - name: backup
    image: alpine:3.18
    command: ['sleep', '3600']
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: ${pvc}
  restartPolicy: Never
EOF
            
            # Wait for pod to be ready
            kubectl wait --for=condition=Ready pod/backup-${pvc} -n "${NAMESPACE}" --timeout=300s
            
            # Create tar archive of the volume data
            kubectl exec -n "${NAMESPACE}" backup-${pvc} -- tar czf - /data > \
                "${BACKUP_DIR}/${BACKUP_PREFIX}/volumes/${pvc}.tar.gz"
            
            # Clean up backup pod
            kubectl delete pod backup-${pvc} -n "${NAMESPACE}"
            
            log "PVC backup completed: ${pvc}.tar.gz"
        done
    else
        log "No persistent volumes found to backup"
    fi
}

# Create backup metadata
create_metadata() {
    log "Creating backup metadata..."
    
    cat > "${BACKUP_DIR}/${BACKUP_PREFIX}/metadata.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "version": "$(kubectl get deployment control-panel -n ${NAMESPACE} -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo 'unknown')",
  "namespace": "${NAMESPACE}",
  "cluster": "$(kubectl config current-context 2>/dev/null || echo 'unknown')",
  "backup_components": [
    "database",
    "kubernetes_config",
    "app_config",
    "persistent_volumes"
  ],
  "created_by": "$(whoami)@$(hostname)",
  "backup_size": "$(du -sh ${BACKUP_DIR}/${BACKUP_PREFIX} | cut -f1)"
}
EOF
    
    log "Backup metadata created"
}

# Compress entire backup
compress_backup() {
    log "Compressing backup archive..."
    
    cd "${BACKUP_DIR}"
    tar czf "${BACKUP_PREFIX}.tar.gz" "${BACKUP_PREFIX}/"
    rm -rf "${BACKUP_PREFIX}/"
    
    log "Backup compressed: ${BACKUP_PREFIX}.tar.gz"
}

# Upload to S3 (optional)
upload_to_s3() {
    if command -v aws &> /dev/null && [ -n "${S3_BUCKET}" ]; then
        log "Uploading backup to S3..."
        
        aws s3 cp "${BACKUP_DIR}/${BACKUP_PREFIX}.tar.gz" \
            "s3://${S3_BUCKET}/control-panel/${BACKUP_PREFIX}.tar.gz"
        
        log "Backup uploaded to S3: s3://${S3_BUCKET}/control-panel/${BACKUP_PREFIX}.tar.gz"
    else
        warning "AWS CLI not found or S3_BUCKET not set, skipping S3 upload"
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    # Local cleanup
    find "${BACKUP_DIR}" -name "control-panel-backup-*.tar.gz" -mtime +${RETENTION_DAYS} -delete
    
    # S3 cleanup (if configured)
    if command -v aws &> /dev/null && [ -n "${S3_BUCKET}" ]; then
        aws s3api list-objects-v2 \
            --bucket "${S3_BUCKET}" \
            --prefix "control-panel/" \
            --query "Contents[?LastModified<=\`$(date -d "${RETENTION_DAYS} days ago" --iso-8601)\`].Key" \
            --output text | xargs -r -I {} aws s3 rm "s3://${S3_BUCKET}/{}"
    fi
    
    log "Cleanup completed"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    if tar tzf "${BACKUP_DIR}/${BACKUP_PREFIX}.tar.gz" >/dev/null 2>&1; then
        log "Backup archive integrity verified"
    else
        error "Backup archive is corrupted!"
        exit 1
    fi
}

# Send notification (optional)
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Control Panel Backup ${status}: ${message}\"}" \
            "${SLACK_WEBHOOK_URL}" || true
    fi
}

# Main backup function
main() {
    log "Starting GMAC.IO Control Panel backup process..."
    send_notification "Started" "Backup process initiated"
    
    # Check required tools
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed"
        exit 1
    fi
    
    # Verify namespace exists
    if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
        error "Namespace ${NAMESPACE} does not exist"
        exit 1
    fi
    
    # Execute backup steps
    create_backup_dir
    backup_database
    backup_kubernetes_config
    backup_app_config
    backup_persistent_volumes
    create_metadata
    compress_backup
    verify_backup
    upload_to_s3
    cleanup_old_backups
    
    local backup_size=$(du -sh "${BACKUP_DIR}/${BACKUP_PREFIX}.tar.gz" | cut -f1)
    log "Backup completed successfully! Size: ${backup_size}"
    send_notification "Completed" "Backup finished successfully (${backup_size})"
}

# Handle script arguments
case "${1:-backup}" in
    backup)
        main
        ;;
    database-only)
        create_backup_dir
        backup_database
        create_metadata
        compress_backup
        log "Database-only backup completed"
        ;;
    config-only)
        create_backup_dir
        backup_kubernetes_config
        backup_app_config
        create_metadata
        compress_backup
        log "Configuration-only backup completed"
        ;;
    help)
        echo "Usage: $0 [backup|database-only|config-only|help]"
        echo "  backup       - Full backup (default)"
        echo "  database-only - Backup only the database"
        echo "  config-only  - Backup only configurations"
        echo "  help         - Show this help message"
        ;;
    *)
        error "Unknown option: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac