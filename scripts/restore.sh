#!/bin/bash

# GMAC.IO Control Panel Restore Script
# This script restores the control panel from a backup

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
S3_BUCKET="${S3_BUCKET:-gmac-control-panel-backups}"
NAMESPACE="${NAMESPACE:-control-panel}"

# Database configuration
DB_HOST="${DB_HOST:-postgres-service.control-panel.svc.cluster.local}"
DB_NAME="${DB_NAME:-control_panel}"
DB_USER="${DB_USER:-control_panel_user}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# List available backups
list_backups() {
    log "Available local backups:"
    
    if ls "${BACKUP_DIR}"/control-panel-backup-*.tar.gz >/dev/null 2>&1; then
        ls -la "${BACKUP_DIR}"/control-panel-backup-*.tar.gz | awk '{print $9, $5, $6, $7, $8}' | column -t
    else
        log "No local backups found"
    fi
    
    if command -v aws &> /dev/null && [ -n "${S3_BUCKET}" ]; then
        log "Available S3 backups:"
        aws s3 ls "s3://${S3_BUCKET}/control-panel/" --human-readable --summarize
    fi
}

# Download backup from S3
download_backup() {
    local backup_name=$1
    
    if command -v aws &> /dev/null && [ -n "${S3_BUCKET}" ]; then
        log "Downloading backup from S3: ${backup_name}"
        aws s3 cp "s3://${S3_BUCKET}/control-panel/${backup_name}" "${BACKUP_DIR}/${backup_name}"
        log "Backup downloaded successfully"
    else
        error "AWS CLI not available or S3_BUCKET not configured"
        exit 1
    fi
}

# Extract backup
extract_backup() {
    local backup_file=$1
    local extract_dir="${BACKUP_DIR}/restore-$(date +%s)"
    
    log "Extracting backup: ${backup_file}"
    mkdir -p "${extract_dir}"
    tar xzf "${backup_file}" -C "${extract_dir}" --strip-components=1
    
    echo "${extract_dir}"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1
    
    log "Verifying backup integrity..."
    
    if ! tar tzf "${backup_file}" >/dev/null 2>&1; then
        error "Backup file is corrupted or invalid"
        exit 1
    fi
    
    log "Backup integrity verified"
}

# Restore database
restore_database() {
    local restore_dir=$1
    local db_file="${restore_dir}/database.sql.gz"
    
    if [ ! -f "${db_file}" ]; then
        error "Database backup file not found: ${db_file}"
        exit 1
    fi
    
    log "Restoring database from: ${db_file}"
    
    # Stop the application to prevent connections
    log "Scaling down application..."
    kubectl scale deployment control-panel --replicas=0 -n "${NAMESPACE}" || true
    
    # Wait for pods to terminate
    kubectl wait --for=delete pod -l app.kubernetes.io/name=control-panel -n "${NAMESPACE}" --timeout=300s || true
    
    # Restore database
    if command -v psql &> /dev/null; then
        log "Using psql for database restore"
        gunzip -c "${db_file}" | PGPASSWORD="${DB_PASSWORD}" psql \
            -h "${DB_HOST}" \
            -U "${DB_USER}" \
            -d "${DB_NAME}"
    else
        log "Using kubectl exec for database restore"
        gunzip -c "${db_file}" | kubectl exec -i -n "${NAMESPACE}" deployment/postgres -- \
            psql -U "${DB_USER}" -d "${DB_NAME}"
    fi
    
    log "Database restore completed"
}

# Restore Kubernetes configuration
restore_kubernetes_config() {
    local restore_dir=$1
    local k8s_dir="${restore_dir}/k8s"
    
    if [ ! -d "${k8s_dir}" ]; then
        warning "Kubernetes configuration directory not found: ${k8s_dir}"
        return
    fi
    
    log "Restoring Kubernetes configuration..."
    
    # Apply namespace first
    if [ -f "${k8s_dir}/01-namespace.yaml" ]; then
        kubectl apply -f "${k8s_dir}/01-namespace.yaml"
    fi
    
    # Apply RBAC
    if [ -f "${k8s_dir}/07-rbac.yaml" ]; then
        kubectl apply -f "${k8s_dir}/07-rbac.yaml"
    fi
    
    # Apply ConfigMaps and Secrets
    if [ -f "${k8s_dir}/02-configmap.yaml" ]; then
        kubectl apply -f "${k8s_dir}/02-configmap.yaml"
    fi
    
    warning "Secrets must be manually restored for security reasons"
    
    # Apply Services
    if [ -f "${k8s_dir}/05-service.yaml" ]; then
        kubectl apply -f "${k8s_dir}/05-service.yaml"
    fi
    
    # Apply Ingress
    if [ -f "${k8s_dir}/06-ingress.yaml" ]; then
        kubectl apply -f "${k8s_dir}/06-ingress.yaml"
    fi
    
    log "Kubernetes configuration restored (excluding secrets)"
}

# Restore persistent volumes
restore_persistent_volumes() {
    local restore_dir=$1
    local volumes_dir="${restore_dir}/volumes"
    
    if [ ! -d "${volumes_dir}" ]; then
        log "No persistent volume backups found"
        return
    fi
    
    log "Restoring persistent volumes..."
    
    for volume_backup in "${volumes_dir}"/*.tar.gz; do
        if [ -f "${volume_backup}" ]; then
            local pvc_name=$(basename "${volume_backup}" .tar.gz)
            log "Restoring PVC: ${pvc_name}"
            
            # Create restore pod
            kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: restore-${pvc_name}
  namespace: ${NAMESPACE}
spec:
  containers:
  - name: restore
    image: alpine:3.18
    command: ['sleep', '3600']
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: ${pvc_name}
  restartPolicy: Never
EOF
            
            # Wait for pod to be ready
            kubectl wait --for=condition=Ready pod/restore-${pvc_name} -n "${NAMESPACE}" --timeout=300s
            
            # Clear existing data and restore
            kubectl exec -n "${NAMESPACE}" restore-${pvc_name} -- rm -rf /data/*
            kubectl exec -i -n "${NAMESPACE}" restore-${pvc_name} -- tar xzf - -C / < "${volume_backup}"
            
            # Clean up restore pod
            kubectl delete pod restore-${pvc_name} -n "${NAMESPACE}"
            
            log "PVC restored: ${pvc_name}"
        fi
    done
}

# Restore deployment
restore_deployment() {
    local restore_dir=$1
    
    log "Restoring application deployment..."
    
    # Apply deployment
    if [ -f "${restore_dir}/k8s/04-deployment.yaml" ]; then
        kubectl apply -f "${restore_dir}/k8s/04-deployment.yaml"
        
        # Wait for deployment to be ready
        log "Waiting for deployment to be ready..."
        kubectl wait --for=condition=Available deployment/control-panel -n "${NAMESPACE}" --timeout=600s
        
        log "Deployment restored and ready"
    else
        error "Deployment configuration not found"
        exit 1
    fi
}

# Verify restore
verify_restore() {
    log "Verifying restore..."
    
    # Check pods are running
    local ready_pods=$(kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/name=control-panel --no-headers | grep "Running" | wc -l)
    local total_pods=$(kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/name=control-panel --no-headers | wc -l)
    
    log "Pods running: ${ready_pods}/${total_pods}"
    
    if [ "${ready_pods}" -eq "${total_pods}" ] && [ "${total_pods}" -gt "0" ]; then
        log "All pods are running"
    else
        warning "Some pods are not running. Check pod status:"
        kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/name=control-panel
    fi
    
    # Test health endpoint
    if kubectl exec -n "${NAMESPACE}" deployment/control-panel -- curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
        log "Health check passed"
    else
        warning "Health check failed"
    fi
    
    # Show service status
    kubectl get svc -n "${NAMESPACE}"
    kubectl get ingress -n "${NAMESPACE}"
}

# Cleanup restore files
cleanup_restore() {
    local restore_dir=$1
    
    log "Cleaning up restore files..."
    rm -rf "${restore_dir}"
    log "Cleanup completed"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Control Panel Restore ${status}: ${message}\"}" \
            "${SLACK_WEBHOOK_URL}" || true
    fi
}

# Interactive restore process
interactive_restore() {
    log "Starting interactive restore process..."
    
    echo "Available backups:"
    list_backups
    echo
    
    read -p "Enter backup filename (local) or S3 key: " backup_name
    
    if [ ! -f "${BACKUP_DIR}/${backup_name}" ]; then
        log "Backup not found locally, attempting to download from S3..."
        download_backup "${backup_name}"
    fi
    
    local backup_file="${BACKUP_DIR}/${backup_name}"
    
    echo
    warning "This will replace the current installation. Are you sure? (yes/no)"
    read -p "Confirm: " confirm
    
    if [ "${confirm}" != "yes" ]; then
        log "Restore cancelled"
        exit 0
    fi
    
    perform_restore "${backup_file}"
}

# Main restore function
perform_restore() {
    local backup_file=$1
    
    log "Starting restore process..."
    send_notification "Started" "Restore process initiated"
    
    # Verify backup
    verify_backup "${backup_file}"
    
    # Extract backup
    local restore_dir
    restore_dir=$(extract_backup "${backup_file}")
    
    # Read metadata
    if [ -f "${restore_dir}/metadata.json" ]; then
        log "Backup metadata:"
        cat "${restore_dir}/metadata.json" | jq .
    fi
    
    # Perform restore steps
    restore_database "${restore_dir}"
    restore_kubernetes_config "${restore_dir}"
    restore_persistent_volumes "${restore_dir}"
    restore_deployment "${restore_dir}"
    
    # Verify restore
    verify_restore
    
    # Cleanup
    cleanup_restore "${restore_dir}"
    
    log "Restore completed successfully!"
    send_notification "Completed" "Restore finished successfully"
}

# Print usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  restore <backup-file>  - Restore from specified backup file"
    echo "  list                   - List available backups"
    echo "  interactive           - Interactive restore process"
    echo "  help                  - Show this help message"
    echo
    echo "Environment Variables:"
    echo "  BACKUP_DIR           - Directory containing backups (default: /backups)"
    echo "  S3_BUCKET           - S3 bucket for remote backups"
    echo "  NAMESPACE           - Kubernetes namespace (default: control-panel)"
    echo "  DB_HOST             - Database host"
    echo "  DB_NAME             - Database name"
    echo "  DB_USER             - Database user"
    echo "  DB_PASSWORD         - Database password"
}

# Main script logic
case "${1:-interactive}" in
    restore)
        if [ -z "${2:-}" ]; then
            error "Backup file required"
            usage
            exit 1
        fi
        perform_restore "$2"
        ;;
    list)
        list_backups
        ;;
    interactive)
        interactive_restore
        ;;
    help)
        usage
        ;;
    *)
        error "Unknown command: $1"
        usage
        exit 1
        ;;
esac