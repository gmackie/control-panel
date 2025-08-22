#!/bin/bash

# GMAC.IO Control Panel Security Scanning Script
# This script performs automated security scans on the control panel

set -euo pipefail

# Configuration
SCAN_DIR="${SCAN_DIR:-$(pwd)}"
REPORT_DIR="${REPORT_DIR:-${SCAN_DIR}/security/reports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DOCKER_IMAGE="${DOCKER_IMAGE:-registry.gmac.io/gmac/control-panel:latest}"
TARGET_URL="${TARGET_URL:-http://localhost:3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Create report directory
mkdir -p "$REPORT_DIR"

log_info "Starting security scan at $(date)"
log_info "Scan directory: $SCAN_DIR"
log_info "Report directory: $REPORT_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to run npm audit
run_npm_audit() {
    log_info "Running npm audit..."
    
    if [ -f "$SCAN_DIR/package.json" ]; then
        cd "$SCAN_DIR"
        
        # Generate audit report
        npm audit --audit-level=low --json > "$REPORT_DIR/npm-audit-${TIMESTAMP}.json" 2>/dev/null || true
        npm audit --audit-level=low > "$REPORT_DIR/npm-audit-${TIMESTAMP}.txt" 2>/dev/null || true
        
        # Check for vulnerabilities
        if npm audit --audit-level=high > /dev/null 2>&1; then
            log_success "No high/critical npm vulnerabilities found"
        else
            log_warning "High/critical npm vulnerabilities detected - check report"
        fi
    else
        log_warning "package.json not found, skipping npm audit"
    fi
}

# Function to run ESLint security scan
run_eslint_security() {
    log_info "Running ESLint security scan..."
    
    if command_exists eslint && [ -f "$SCAN_DIR/.eslintrc.json" ]; then
        cd "$SCAN_DIR"
        
        # Run ESLint with security plugin
        eslint --ext .js,.jsx,.ts,.tsx \
               --config .eslintrc.json \
               --format json \
               src/ > "$REPORT_DIR/eslint-security-${TIMESTAMP}.json" 2>/dev/null || true
        
        eslint --ext .js,.jsx,.ts,.tsx \
               --config .eslintrc.json \
               src/ > "$REPORT_DIR/eslint-security-${TIMESTAMP}.txt" 2>/dev/null || true
        
        log_success "ESLint security scan completed"
    else
        log_warning "ESLint not available, skipping security linting"
    fi
}

# Function to run Trivy container scan
run_trivy_scan() {
    log_info "Running Trivy container security scan..."
    
    if command_exists trivy; then
        # Scan Docker image
        trivy image --format json --output "$REPORT_DIR/trivy-${TIMESTAMP}.json" "$DOCKER_IMAGE" 2>/dev/null || {
            log_warning "Trivy scan failed for image $DOCKER_IMAGE"
        }
        
        trivy image --format table --output "$REPORT_DIR/trivy-${TIMESTAMP}.txt" "$DOCKER_IMAGE" 2>/dev/null || true
        
        # Scan filesystem
        trivy fs --format json --output "$REPORT_DIR/trivy-fs-${TIMESTAMP}.json" "$SCAN_DIR" 2>/dev/null || true
        
        log_success "Trivy container scan completed"
    else
        log_warning "Trivy not installed, skipping container scan"
    fi
}

# Function to run semgrep static analysis
run_semgrep_scan() {
    log_info "Running Semgrep static analysis..."
    
    if command_exists semgrep; then
        cd "$SCAN_DIR"
        
        # Run semgrep with security rules
        semgrep --config=auto \
                --json \
                --output="$REPORT_DIR/semgrep-${TIMESTAMP}.json" \
                src/ 2>/dev/null || true
        
        semgrep --config=auto \
                --output="$REPORT_DIR/semgrep-${TIMESTAMP}.txt" \
                src/ 2>/dev/null || true
        
        log_success "Semgrep static analysis completed"
    else
        log_warning "Semgrep not installed, skipping static analysis"
    fi
}

# Function to run OWASP ZAP baseline scan
run_zap_baseline() {
    log_info "Running OWASP ZAP baseline scan..."
    
    if command_exists docker; then
        # Check if application is running
        if curl -sf "$TARGET_URL/api/health" > /dev/null 2>&1; then
            docker run --rm -t \
                -v "$REPORT_DIR:/zap/wrk:rw" \
                owasp/zap2docker-stable:latest \
                zap-baseline.py \
                -t "$TARGET_URL" \
                -J "zap-baseline-${TIMESTAMP}.json" \
                -r "zap-baseline-${TIMESTAMP}.html" 2>/dev/null || {
                log_warning "ZAP baseline scan encountered issues"
            }
            
            log_success "OWASP ZAP baseline scan completed"
        else
            log_warning "Application not accessible at $TARGET_URL, skipping ZAP scan"
        fi
    else
        log_warning "Docker not available, skipping ZAP scan"
    fi
}

# Function to check Kubernetes security
run_kube_bench() {
    log_info "Running Kubernetes security benchmark..."
    
    if command_exists kubectl && kubectl cluster-info > /dev/null 2>&1; then
        # Run kube-bench if available
        if command_exists kube-bench; then
            kube-bench run --outputfile "$REPORT_DIR/kube-bench-${TIMESTAMP}.txt" 2>/dev/null || true
            kube-bench run --json --outputfile "$REPORT_DIR/kube-bench-${TIMESTAMP}.json" 2>/dev/null || true
            log_success "Kubernetes benchmark completed"
        else
            # Fallback: Check basic security settings
            {
                echo "=== Kubernetes Security Check ==="
                echo "Date: $(date)"
                echo ""
                
                echo "--- Cluster Info ---"
                kubectl cluster-info 2>/dev/null || echo "Failed to get cluster info"
                echo ""
                
                echo "--- Node Security ---"
                kubectl get nodes -o wide 2>/dev/null || echo "Failed to get nodes"
                echo ""
                
                echo "--- Pod Security Policies ---"
                kubectl get psp 2>/dev/null || echo "No Pod Security Policies found"
                echo ""
                
                echo "--- Network Policies ---"
                kubectl get networkpolicy --all-namespaces 2>/dev/null || echo "No Network Policies found"
                echo ""
                
                echo "--- RBAC ---"
                kubectl get clusterrolebindings 2>/dev/null || echo "Failed to get cluster role bindings"
                echo ""
                
                echo "--- Secrets ---"
                kubectl get secrets --all-namespaces 2>/dev/null || echo "Failed to get secrets"
                
            } > "$REPORT_DIR/k8s-security-${TIMESTAMP}.txt"
            
            log_success "Basic Kubernetes security check completed"
        fi
    else
        log_warning "Kubernetes not accessible, skipping cluster security check"
    fi
}

# Function to check SSL/TLS configuration
run_ssl_check() {
    log_info "Running SSL/TLS configuration check..."
    
    # Extract hostname from TARGET_URL
    if [[ "$TARGET_URL" =~ https://([^/]+) ]]; then
        hostname="${BASH_REMATCH[1]}"
        
        if command_exists openssl; then
            {
                echo "=== SSL/TLS Security Check ==="
                echo "Date: $(date)"
                echo "Hostname: $hostname"
                echo ""
                
                # Check certificate
                echo "--- Certificate Information ---"
                echo | openssl s_client -connect "$hostname:443" -servername "$hostname" 2>/dev/null | openssl x509 -noout -text 2>/dev/null || echo "Failed to retrieve certificate"
                echo ""
                
                # Check supported ciphers
                echo "--- Supported Ciphers ---"
                nmap --script ssl-enum-ciphers -p 443 "$hostname" 2>/dev/null || echo "Nmap not available for cipher check"
                
            } > "$REPORT_DIR/ssl-check-${TIMESTAMP}.txt"
            
            log_success "SSL/TLS check completed"
        else
            log_warning "OpenSSL not available, skipping SSL check"
        fi
    else
        log_warning "Target URL is not HTTPS, skipping SSL check"
    fi
}

# Function to run custom security checks
run_custom_checks() {
    log_info "Running custom security checks..."
    
    {
        echo "=== Custom Security Checks ==="
        echo "Date: $(date)"
        echo ""
        
        echo "--- Environment Variables Check ---"
        if [ -f "$SCAN_DIR/.env" ]; then
            echo "Found .env file - checking for secrets..."
            grep -i -E "(password|secret|key|token)" "$SCAN_DIR/.env" 2>/dev/null || echo "No obvious secrets found in .env"
        else
            echo "No .env file found"
        fi
        echo ""
        
        echo "--- Configuration Files Check ---"
        find "$SCAN_DIR" -name "*.json" -o -name "*.yaml" -o -name "*.yml" | while read -r file; do
            if grep -i -E "(password|secret|key|token)" "$file" > /dev/null 2>&1; then
                echo "Potential secrets found in: $file"
            fi
        done
        echo ""
        
        echo "--- Code Security Patterns ---"
        # Check for common security anti-patterns
        grep -r -i "eval(" "$SCAN_DIR/src" 2>/dev/null || echo "No eval() usage found"
        grep -r -i "innerHTML" "$SCAN_DIR/src" 2>/dev/null || echo "No innerHTML usage found"
        grep -r -i "document.write" "$SCAN_DIR/src" 2>/dev/null || echo "No document.write usage found"
        echo ""
        
        echo "--- Database Query Check ---"
        grep -r -E "SELECT.*\$\{|INSERT.*\$\{|UPDATE.*\$\{|DELETE.*\$\{" "$SCAN_DIR/src" 2>/dev/null || echo "No obvious SQL injection patterns found"
        echo ""
        
        echo "--- Dependency Check ---"
        if [ -f "$SCAN_DIR/package.json" ]; then
            echo "Checking for outdated dependencies..."
            cd "$SCAN_DIR"
            npm outdated 2>/dev/null || echo "npm outdated check failed"
        fi
        
    } > "$REPORT_DIR/custom-checks-${TIMESTAMP}.txt"
    
    log_success "Custom security checks completed"
}

# Function to generate summary report
generate_summary() {
    log_info "Generating security scan summary..."
    
    {
        echo "=== Security Scan Summary Report ==="
        echo "Generated: $(date)"
        echo "Scan ID: $TIMESTAMP"
        echo ""
        
        echo "--- Scan Configuration ---"
        echo "Scan Directory: $SCAN_DIR"
        echo "Target URL: $TARGET_URL"
        echo "Docker Image: $DOCKER_IMAGE"
        echo ""
        
        echo "--- Completed Scans ---"
        ls -la "$REPORT_DIR"/*-${TIMESTAMP}.* 2>/dev/null || echo "No scan reports found"
        echo ""
        
        echo "--- Quick Analysis ---"
        
        # NPM Audit Summary
        if [ -f "$REPORT_DIR/npm-audit-${TIMESTAMP}.json" ]; then
            echo "NPM Vulnerabilities:"
            jq -r '.metadata.vulnerabilities | to_entries[] | "\(.key): \(.value)"' "$REPORT_DIR/npm-audit-${TIMESTAMP}.json" 2>/dev/null || echo "Could not parse npm audit results"
        fi
        
        # Trivy Summary
        if [ -f "$REPORT_DIR/trivy-${TIMESTAMP}.json" ]; then
            echo "Container Vulnerabilities:"
            jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL") | "\(.Severity): \(.PkgName) - \(.Title)"' "$REPORT_DIR/trivy-${TIMESTAMP}.json" 2>/dev/null | head -10 || echo "No high/critical container vulnerabilities found"
        fi
        
        # Semgrep Summary
        if [ -f "$REPORT_DIR/semgrep-${TIMESTAMP}.json" ]; then
            echo "Static Analysis Issues:"
            jq -r '.results[] | select(.extra.severity == "ERROR" or .extra.severity == "WARNING") | "\(.extra.severity): \(.check_id) in \(.path):\(.start.line)"' "$REPORT_DIR/semgrep-${TIMESTAMP}.json" 2>/dev/null | head -10 || echo "No static analysis issues found"
        fi
        
        echo ""
        echo "--- Recommendations ---"
        echo "1. Review all high/critical vulnerabilities immediately"
        echo "2. Update outdated dependencies"
        echo "3. Address static analysis findings"
        echo "4. Review custom security check results"
        echo "5. Schedule regular security scans"
        echo ""
        
        echo "--- Next Steps ---"
        echo "1. Analyze detailed reports in $REPORT_DIR"
        echo "2. Create remediation tickets for findings"
        echo "3. Update security documentation"
        echo "4. Schedule follow-up scan after fixes"
        
    } > "$REPORT_DIR/security-summary-${TIMESTAMP}.txt"
    
    log_success "Security scan summary generated"
}

# Function to send notifications
send_notifications() {
    log_info "Sending scan completion notifications..."
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔒 Security scan completed for Control Panel. Report ID: $TIMESTAMP. Check reports at: $REPORT_DIR\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || {
            log_warning "Failed to send Slack notification"
        }
        log_success "Slack notification sent"
    fi
    
    if [ -n "${EMAIL_RECIPIENT:-}" ] && command_exists mail; then
        {
            echo "Subject: Security Scan Report - $TIMESTAMP"
            echo ""
            cat "$REPORT_DIR/security-summary-${TIMESTAMP}.txt"
        } | mail "$EMAIL_RECIPIENT" 2>/dev/null || {
            log_warning "Failed to send email notification"
        }
        log_success "Email notification sent"
    fi
}

# Main execution
main() {
    log_info "=== GMAC.IO Control Panel Security Scan ==="
    
    # Run all security scans
    run_npm_audit
    run_eslint_security
    run_trivy_scan
    run_semgrep_scan
    run_zap_baseline
    run_kube_bench
    run_ssl_check
    run_custom_checks
    
    # Generate summary and send notifications
    generate_summary
    send_notifications
    
    log_success "Security scan completed successfully!"
    log_info "Reports available in: $REPORT_DIR"
    log_info "Summary report: $REPORT_DIR/security-summary-${TIMESTAMP}.txt"
}

# Help function
show_help() {
    echo "GMAC.IO Control Panel Security Scanner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --directory DIR    Scan directory (default: current directory)"
    echo "  -r, --reports DIR      Reports directory (default: ./security/reports)"
    echo "  -u, --url URL          Target URL for dynamic testing (default: http://localhost:3000)"
    echo "  -i, --image IMAGE      Docker image to scan (default: registry.gmac.io/gmac/control-panel:latest)"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  SLACK_WEBHOOK_URL     Slack webhook for notifications"
    echo "  EMAIL_RECIPIENT       Email address for notifications"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run with defaults"
    echo "  $0 -u https://control.gmac.io        # Scan production"
    echo "  $0 -d /path/to/project -r /tmp/reports # Custom paths"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--directory)
            SCAN_DIR="$2"
            shift 2
            ;;
        -r|--reports)
            REPORT_DIR="$2"
            shift 2
            ;;
        -u|--url)
            TARGET_URL="$2"
            shift 2
            ;;
        -i|--image)
            DOCKER_IMAGE="$2"
            shift 2
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

# Run main function
main "$@"