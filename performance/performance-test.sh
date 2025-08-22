#!/bin/bash

# GMAC.IO Control Panel Performance Testing Script
# This script runs comprehensive performance tests using k6 and other tools

set -euo pipefail

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
REPORT_DIR="${REPORT_DIR:-./performance/reports}"
TEST_TYPE="${TEST_TYPE:-load}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check service availability
check_service_availability() {
    log_info "Checking service availability at $BASE_URL..."
    
    if curl -sf "$BASE_URL/api/health" > /dev/null; then
        log_success "Service is available"
        return 0
    else
        log_error "Service is not available at $BASE_URL"
        return 1
    fi
}

# Function to run k6 load test
run_k6_test() {
    local test_type="$1"
    local script_file="${2:-load-test.js}"
    
    log_info "Running k6 $test_type test..."
    
    if ! command_exists k6; then
        log_error "k6 is not installed. Please install k6 to run performance tests."
        return 1
    fi
    
    local output_file="$REPORT_DIR/k6-${test_type}-${TIMESTAMP}"
    
    # Set environment variables for the test
    export K6_BASE_URL="$BASE_URL"
    
    # Run k6 with different configurations based on test type
    case "$test_type" in
        "load")
            k6 run \
                --out json="${output_file}.json" \
                --out influxdb=http://localhost:8086/k6 \
                "$(dirname "$0")/$script_file"
            ;;
        "stress")
            k6 run \
                --config='{"stages":[{"duration":"2m","target":50},{"duration":"5m","target":100},{"duration":"2m","target":200},{"duration":"5m","target":200},{"duration":"2m","target":0}],"thresholds":{"errors":["rate<0.1"],"http_req_duration":["p(95)<5000"]}}' \
                --out json="${output_file}.json" \
                "$(dirname "$0")/$script_file"
            ;;
        "spike")
            k6 run \
                --config='{"stages":[{"duration":"1m","target":10},{"duration":"30s","target":200},{"duration":"1m","target":10}],"thresholds":{"errors":["rate<0.05"],"http_req_duration":["p(95)<2000"]}}' \
                --out json="${output_file}.json" \
                "$(dirname "$0")/$script_file"
            ;;
        "volume")
            k6 run \
                --config='{"stages":[{"duration":"5m","target":100},{"duration":"30m","target":100},{"duration":"5m","target":0}],"thresholds":{"errors":["rate<0.02"],"http_req_duration":["p(95)<1000"]}}' \
                --out json="${output_file}.json" \
                "$(dirname "$0")/$script_file"
            ;;
        *)
            log_error "Unknown test type: $test_type"
            return 1
            ;;
    esac
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_success "k6 $test_type test completed successfully"
    else
        log_warning "k6 $test_type test completed with issues (exit code: $exit_code)"
    fi
    
    # Generate HTML report if jq is available
    if command_exists jq && [ -f "${output_file}.json" ]; then
        generate_k6_html_report "${output_file}.json" "${output_file}.html"
    fi
    
    return $exit_code
}

# Function to generate HTML report from k6 JSON output
generate_k6_html_report() {
    local json_file="$1"
    local html_file="$2"
    
    log_info "Generating HTML report..."
    
    # Extract key metrics from k6 JSON output
    local avg_response_time=$(jq -r '.metrics.http_req_duration.values.avg' "$json_file" 2>/dev/null || echo "N/A")
    local p95_response_time=$(jq -r '.metrics.http_req_duration.values."p(95)"' "$json_file" 2>/dev/null || echo "N/A")
    local error_rate=$(jq -r '.metrics.errors.values.rate' "$json_file" 2>/dev/null || echo "N/A")
    local total_requests=$(jq -r '.metrics.http_reqs.values.count' "$json_file" 2>/dev/null || echo "N/A")
    local requests_per_second=$(jq -r '.metrics.http_reqs.values.rate' "$json_file" 2>/dev/null || echo "N/A")
    
    cat > "$html_file" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report - $TIMESTAMP</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #007acc;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #007acc;
        }
        .metric-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #007acc;
        }
        .metric-unit {
            font-size: 0.8em;
            color: #666;
        }
        .status-good { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-error { color: #dc3545; }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GMAC.IO Control Panel - Performance Test Report</h1>
            <p>Test Type: <strong>$TEST_TYPE</strong></p>
            <p>Target URL: <strong>$BASE_URL</strong></p>
            <p>Test Date: <strong>$(date)</strong></p>
        </div>
        
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-title">Average Response Time</div>
                <div class="metric-value">$(printf "%.2f" "$avg_response_time" 2>/dev/null || echo "N/A")<span class="metric-unit">ms</span></div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">95th Percentile Response Time</div>
                <div class="metric-value">$(printf "%.2f" "$p95_response_time" 2>/dev/null || echo "N/A")<span class="metric-unit">ms</span></div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Error Rate</div>
                <div class="metric-value $([ "${error_rate%.*}" -lt 1 ] 2>/dev/null && echo "status-good" || echo "status-warning")">$(printf "%.2f" "$(echo "$error_rate * 100" | bc 2>/dev/null || echo "0")" 2>/dev/null || echo "N/A")<span class="metric-unit">%</span></div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Total Requests</div>
                <div class="metric-value">$total_requests</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Requests Per Second</div>
                <div class="metric-value">$(printf "%.2f" "$requests_per_second" 2>/dev/null || echo "N/A")<span class="metric-unit">req/s</span></div>
            </div>
        </div>
        
        <h2>Test Configuration</h2>
        <ul>
            <li><strong>Test Type:</strong> $TEST_TYPE</li>
            <li><strong>Base URL:</strong> $BASE_URL</li>
            <li><strong>Report Directory:</strong> $REPORT_DIR</li>
        </ul>
        
        <h2>Performance Thresholds</h2>
        <ul>
            <li><strong>Error Rate:</strong> < 1% (Good), < 5% (Warning), ≥ 5% (Critical)</li>
            <li><strong>Average Response Time:</strong> < 200ms (Good), < 500ms (Warning), ≥ 500ms (Critical)</li>
            <li><strong>95th Percentile:</strong> < 500ms (Good), < 1000ms (Warning), ≥ 1000ms (Critical)</li>
        </ul>
        
        <div class="footer">
            <p>Generated by GMAC.IO Control Panel Performance Test Suite</p>
            <p>Report ID: $TIMESTAMP</p>
        </div>
    </div>
</body>
</html>
EOF
    
    log_success "HTML report generated: $html_file"
}

# Function to run Apache Bench test
run_apache_bench() {
    log_info "Running Apache Bench (ab) test..."
    
    if ! command_exists ab; then
        log_warning "Apache Bench (ab) not installed, skipping"
        return 0
    fi
    
    local output_file="$REPORT_DIR/ab-test-${TIMESTAMP}.txt"
    
    # Test key endpoints
    {
        echo "=== Apache Bench Performance Test ==="
        echo "Date: $(date)"
        echo "Target: $BASE_URL"
        echo ""
        
        echo "--- Health Check Endpoint ---"
        ab -n 1000 -c 10 "$BASE_URL/api/health" 2>/dev/null || echo "Health check test failed"
        echo ""
        
        echo "--- API Metrics Endpoint (with auth header) ---"
        ab -n 100 -c 5 -H "Authorization: Bearer mock-token" "$BASE_URL/api/monitoring/metrics" 2>/dev/null || echo "Metrics test failed"
        echo ""
        
    } > "$output_file"
    
    log_success "Apache Bench test completed: $output_file"
}

# Function to run curl-based response time test
run_curl_benchmark() {
    log_info "Running curl response time benchmark..."
    
    local output_file="$REPORT_DIR/curl-benchmark-${TIMESTAMP}.txt"
    local endpoints=(
        "/api/health"
        "/api/auth/verify"
        "/api/monitoring/metrics"
        "/api/cluster/health"
        "/api/applications"
    )
    
    {
        echo "=== Curl Response Time Benchmark ==="
        echo "Date: $(date)"
        echo "Target: $BASE_URL"
        echo ""
        
        for endpoint in "${endpoints[@]}"; do
            echo "--- Testing $endpoint ---"
            
            local total_time=0
            local count=10
            
            for i in $(seq 1 $count); do
                local time_total=$(curl -w "%{time_total}" -s -o /dev/null "$BASE_URL$endpoint" -H "Authorization: Bearer mock-token")
                total_time=$(echo "$total_time + $time_total" | bc -l)
                echo "Request $i: ${time_total}s"
            done
            
            local avg_time=$(echo "scale=3; $total_time / $count" | bc -l)
            echo "Average response time: ${avg_time}s"
            echo ""
        done
        
    } > "$output_file"
    
    log_success "Curl benchmark completed: $output_file"
}

# Function to monitor system resources during test
monitor_system_resources() {
    log_info "Starting system resource monitoring..."
    
    local output_file="$REPORT_DIR/system-monitor-${TIMESTAMP}.txt"
    local duration=${1:-600} # Default 10 minutes
    
    {
        echo "=== System Resource Monitoring ==="
        echo "Date: $(date)"
        echo "Duration: ${duration}s"
        echo ""
        
        # Monitor for specified duration
        local end_time=$(($(date +%s) + duration))
        
        while [ $(date +%s) -lt $end_time ]; do
            echo "--- $(date) ---"
            
            # CPU usage
            echo "CPU Usage:"
            top -bn1 | grep "Cpu(s)" || echo "CPU info unavailable"
            echo ""
            
            # Memory usage
            echo "Memory Usage:"
            free -h || echo "Memory info unavailable"
            echo ""
            
            # Disk usage
            echo "Disk Usage:"
            df -h / || echo "Disk info unavailable"
            echo ""
            
            # Network connections
            echo "Network Connections:"
            netstat -an | grep :3000 | wc -l || echo "0"
            echo ""
            
            sleep 30
        done
        
    } > "$output_file" &
    
    local monitor_pid=$!
    echo "$monitor_pid" > "$REPORT_DIR/monitor.pid"
    
    log_success "System monitoring started (PID: $monitor_pid)"
}

# Function to stop system monitoring
stop_system_monitoring() {
    if [ -f "$REPORT_DIR/monitor.pid" ]; then
        local monitor_pid=$(cat "$REPORT_DIR/monitor.pid")
        if kill -0 "$monitor_pid" 2>/dev/null; then
            kill "$monitor_pid"
            log_info "System monitoring stopped"
        fi
        rm -f "$REPORT_DIR/monitor.pid"
    fi
}

# Function to generate performance summary
generate_performance_summary() {
    log_info "Generating performance summary..."
    
    local summary_file="$REPORT_DIR/performance-summary-${TIMESTAMP}.txt"
    
    {
        echo "=== GMAC.IO Control Panel Performance Test Summary ==="
        echo "Generated: $(date)"
        echo "Test ID: $TIMESTAMP"
        echo "Test Type: $TEST_TYPE"
        echo "Target URL: $BASE_URL"
        echo ""
        
        echo "--- Test Results ---"
        ls -la "$REPORT_DIR"/*-${TIMESTAMP}.* 2>/dev/null || echo "No test results found"
        echo ""
        
        echo "--- Key Findings ---"
        
        # Extract key metrics from k6 results if available
        if [ -f "$REPORT_DIR/k6-${TEST_TYPE}-${TIMESTAMP}.json" ]; then
            echo "k6 Load Test Results:"
            local k6_file="$REPORT_DIR/k6-${TEST_TYPE}-${TIMESTAMP}.json"
            
            if command_exists jq; then
                echo "  Average Response Time: $(jq -r '.metrics.http_req_duration.values.avg // "N/A"' "$k6_file")ms"
                echo "  95th Percentile: $(jq -r '.metrics.http_req_duration.values."p(95)" // "N/A"' "$k6_file")ms"
                echo "  Error Rate: $(jq -r '.metrics.errors.values.rate // "N/A"' "$k6_file")"
                echo "  Total Requests: $(jq -r '.metrics.http_reqs.values.count // "N/A"' "$k6_file")"
                echo "  Requests/Second: $(jq -r '.metrics.http_reqs.values.rate // "N/A"' "$k6_file")"
            else
                echo "  (jq not available for detailed analysis)"
            fi
        fi
        echo ""
        
        echo "--- Performance Assessment ---"
        echo "✓ Response Time: Target < 200ms average"
        echo "✓ Error Rate: Target < 1%"
        echo "✓ Throughput: Target > 100 req/s"
        echo "✓ Availability: Target > 99.9%"
        echo ""
        
        echo "--- Recommendations ---"
        echo "1. Review response time trends for optimization opportunities"
        echo "2. Monitor error rates during peak load"
        echo "3. Implement caching for frequently accessed endpoints"
        echo "4. Consider horizontal scaling if throughput targets not met"
        echo "5. Schedule regular performance testing"
        echo ""
        
        echo "--- Next Steps ---"
        echo "1. Analyze detailed reports in $REPORT_DIR"
        echo "2. Compare results with previous test runs"
        echo "3. Identify performance bottlenecks"
        echo "4. Implement optimization recommendations"
        echo "5. Schedule follow-up testing"
        
    } > "$summary_file"
    
    log_success "Performance summary generated: $summary_file"
}

# Function to send notifications
send_notifications() {
    log_info "Sending performance test notifications..."
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"📊 Performance test completed for Control Panel. Test Type: $TEST_TYPE, Report ID: $TIMESTAMP. Check reports at: $REPORT_DIR\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || {
            log_warning "Failed to send Slack notification"
        }
        log_success "Slack notification sent"
    fi
}

# Main execution function
main() {
    log_info "=== GMAC.IO Control Panel Performance Testing ==="
    log_info "Test Type: $TEST_TYPE"
    log_info "Base URL: $BASE_URL"
    log_info "Report Directory: $REPORT_DIR"
    
    # Check service availability
    if ! check_service_availability; then
        log_error "Cannot proceed with performance testing - service unavailable"
        exit 1
    fi
    
    # Start system monitoring
    monitor_system_resources 1200 # 20 minutes
    
    # Run performance tests based on type
    case "$TEST_TYPE" in
        "load")
            run_k6_test "load"
            run_apache_bench
            run_curl_benchmark
            ;;
        "stress")
            run_k6_test "stress"
            ;;
        "spike")
            run_k6_test "spike"
            ;;
        "volume")
            run_k6_test "volume"
            ;;
        "all")
            run_k6_test "load"
            run_k6_test "stress"
            run_apache_bench
            run_curl_benchmark
            ;;
        *)
            log_error "Unknown test type: $TEST_TYPE"
            log_info "Available types: load, stress, spike, volume, all"
            exit 1
            ;;
    esac
    
    # Stop system monitoring
    stop_system_monitoring
    
    # Generate summary and notifications
    generate_performance_summary
    send_notifications
    
    log_success "Performance testing completed!"
    log_info "Reports available in: $REPORT_DIR"
    log_info "Summary report: $REPORT_DIR/performance-summary-${TIMESTAMP}.txt"
}

# Help function
show_help() {
    echo "GMAC.IO Control Panel Performance Test Suite"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL          Base URL for testing (default: http://localhost:3000)"
    echo "  -t, --type TYPE        Test type: load, stress, spike, volume, all (default: load)"
    echo "  -r, --reports DIR      Reports directory (default: ./performance/reports)"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  SLACK_WEBHOOK_URL     Slack webhook for notifications"
    echo ""
    echo "Test Types:"
    echo "  load     - Gradual load increase to test normal capacity"
    echo "  stress   - High load to test system breaking point"
    echo "  spike    - Sudden load spikes to test elasticity"
    echo "  volume   - Extended duration test for stability"
    echo "  all      - Run all test types sequentially"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Basic load test"
    echo "  $0 -t stress -u https://control.gmac.io  # Stress test production"
    echo "  $0 -t all -r /tmp/perf-reports       # All tests with custom report dir"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -r|--reports)
            REPORT_DIR="$2"
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

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    stop_system_monitoring
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Run main function
main "$@"