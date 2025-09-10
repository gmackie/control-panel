#!/bin/bash

# End-to-End Monitoring Test for Control Panel
# Tests the complete monitoring pipeline

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 End-to-End Monitoring Test${NC}"
echo -e "${BLUE}=============================${NC}"
echo ""

export KUBECONFIG=/Users/mackieg/.kube/config-hetzner

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=$3
    
    echo -n "  Testing $test_name... "
    
    result=$(eval "$test_command" 2>/dev/null || echo "FAIL")
    
    if [[ "$result" == *"$expected_result"* ]]; then
        echo -e "${GREEN}✓${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# 1. Pod Health Tests
echo -e "${BLUE}1. Pod Health & Status Tests${NC}"
echo -e "${BLUE}---------------------------${NC}"

run_test "Control Panel pods running" \
    "kubectl get --insecure-skip-tls-verify pods -n control-panel -l app.kubernetes.io/name=control-panel --no-headers --insecure-skip-tls-verify | grep Running | wc -l" \
    "3"

run_test "Landing page pod running" \
    "kubectl get --insecure-skip-tls-verify pods -n control-panel -l app=landing-page --no-headers --insecure-skip-tls-verify | grep Running | wc -l" \
    "1"

run_test "No pods in CrashLoopBackOff" \
    "kubectl get --insecure-skip-tls-verify pods -n control-panel --no-headers --insecure-skip-tls-verify | grep CrashLoopBackOff | wc -l" \
    "0"

echo ""

# 2. Configuration Tests
echo -e "${BLUE}2. Configuration Tests${NC}"
echo -e "${BLUE}--------------------${NC}"

run_test "Applications config exists" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

run_test "Grafana links configured" \
    "kubectl get --insecure-skip-tls-verify configmap grafana-dashboard-links -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

run_test "Integration config exists" \
    "kubectl get --insecure-skip-tls-verify configmap control-panel-integrations -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

run_test "Monitoring service exists" \
    "kubectl get --insecure-skip-tls-verify service monitoring-endpoints -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

echo ""

# 3. Service Endpoint Tests
echo -e "${BLUE}3. Service Endpoint Tests${NC}"
echo -e "${BLUE}-----------------------${NC}"

run_test "Control Panel service exists" \
    "kubectl get --insecure-skip-tls-verify service control-panel-service -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

run_test "Service has endpoints" \
    "kubectl get --insecure-skip-tls-verify endpoints control-panel-service -n control-panel -o json | jq '.subsets[0].addresses | length'" \
    "3"

run_test "Ingress configured" \
    "kubectl get --insecure-skip-tls-verify ingress control-panel -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

echo ""

# 4. Application Configuration Tests
echo -e "${BLUE}4. Application Configuration Tests${NC}"
echo -e "${BLUE}---------------------------------${NC}"

run_test "Control Panel app configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep 'name: control-panel' | wc -l" \
    "1"

run_test "Landing Page app configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep 'name: landing-page' | wc -l" \
    "1"

run_test "Development apps configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep 'namespace: development' | wc -l" \
    "3"

run_test "API services configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep 'namespace: api' | wc -l" \
    "3"

run_test "Data services configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep 'namespace: data' | wc -l" \
    "2"

echo ""

# 5. Integration URL Tests
echo -e "${BLUE}5. Integration URL Tests${NC}"
echo -e "${BLUE}----------------------${NC}"

run_test "Grafana URL configured" \
    "kubectl get --insecure-skip-tls-verify configmap control-panel-integrations -n control-panel -o yaml | grep 'GRAFANA_URL: https://grafana.gmac.io' | wc -l" \
    "1"

run_test "Harbor registry configured" \
    "kubectl get --insecure-skip-tls-verify configmap control-panel-integrations -n control-panel -o yaml | grep 'HARBOR_REGISTRY: registry.gmac.io' | wc -l" \
    "1"

run_test "Gitea org configured" \
    "kubectl get --insecure-skip-tls-verify configmap control-panel-integrations -n control-panel -o yaml | grep 'GITEA_ORG: gmackie' | wc -l" \
    "1"

echo ""

# 6. Grafana Dashboard Links Tests
echo -e "${BLUE}6. Grafana Dashboard Links Tests${NC}"
echo -e "${BLUE}-------------------------------${NC}"

run_test "Control Panel dashboard link" \
    "kubectl get --insecure-skip-tls-verify configmap grafana-dashboard-links -n control-panel -o yaml | grep 'control-panel/control-panel-overview' | wc -l" \
    "1"

run_test "Loki links configured" \
    "kubectl get --insecure-skip-tls-verify configmap grafana-dashboard-links -n control-panel -o yaml | grep 'loki_links.json' | wc -l" \
    "1"

run_test "10 application dashboards" \
    "kubectl get --insecure-skip-tls-verify configmap grafana-dashboard-links -n control-panel -o yaml | grep 'https://grafana.gmac.io/d/' | wc -l" \
    "10"

echo ""

# 7. Secret Configuration Tests
echo -e "${BLUE}7. Secret Configuration Tests${NC}"
echo -e "${BLUE}----------------------------${NC}"

run_test "Control Panel secrets exist" \
    "kubectl get --insecure-skip-tls-verify secret control-panel-secrets -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

run_test "Gitea token configured" \
    "kubectl get --insecure-skip-tls-verify secret control-panel-secrets -n control-panel -o yaml | grep 'GITEA_TOKEN:' | wc -l" \
    "1"

run_test "Harbor credentials configured" \
    "kubectl get --insecure-skip-tls-verify secret control-panel-secrets -n control-panel -o yaml | grep 'HARBOR_USERNAME:' | wc -l" \
    "1"

echo ""

# 8. Prometheus/Loki Configuration Tests  
echo -e "${BLUE}8. Observability Configuration Tests${NC}"
echo -e "${BLUE}-----------------------------------${NC}"

run_test "Prometheus annotations on pods" \
    "kubectl get --insecure-skip-tls-verify pod -n control-panel -l app.kubernetes.io/name=control-panel -o yaml | grep 'prometheus.io/scrape: \"true\"' | wc -l" \
    "3"

run_test "Metrics path configured" \
    "kubectl get --insecure-skip-tls-verify pod -n control-panel -l app.kubernetes.io/name=control-panel -o yaml | grep 'prometheus.io/path: /api/metrics' | wc -l" \
    "3"

run_test "Alert rules configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep 'alert_rules.yaml' | wc -l" \
    "1"

echo ""

# 9. Webhook Configuration Tests
echo -e "${BLUE}9. Webhook Configuration Tests${NC}"
echo -e "${BLUE}-----------------------------${NC}"

run_test "Webhook service exists" \
    "kubectl get --insecure-skip-tls-verify service control-panel-webhook -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

run_test "Webhook ingress configured" \
    "kubectl get --insecure-skip-tls-verify ingress control-panel-webhooks -n control-panel --no-headers 2>/dev/null | wc -l" \
    "1"

run_test "Webhook secret configured" \
    "kubectl get --insecure-skip-tls-verify secret control-panel-secrets -n control-panel -o yaml | grep 'WEBHOOK_SECRET:' | wc -l" \
    "1"

echo ""

# 10. Application Features Tests
echo -e "${BLUE}10. Application Features Tests${NC}"
echo -e "${BLUE}-----------------------------${NC}"

run_test "Authentication feature configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep '- authentication' | wc -l" \
    "2"

run_test "Monitoring feature configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep '- monitoring' | wc -l" \
    "1"

run_test "AI integration feature configured" \
    "kubectl get --insecure-skip-tls-verify configmap applications-config -n control-panel -o yaml | grep '- ai-integration' | wc -l" \
    "1"

echo ""

# Summary
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Pass Rate: $PASS_RATE%"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! The monitoring system is fully operational.${NC}"
    echo ""
    echo -e "${YELLOW}Monitoring Dashboard:${NC} https://control.gmac.io/monitoring"
    echo -e "${YELLOW}Grafana:${NC} https://grafana.gmac.io"
    echo -e "${YELLOW}API Endpoint:${NC} https://control.gmac.io/api/monitoring/applications"
else
    echo -e "${RED}❌ Some tests failed. Please review the failures above.${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting Tips:${NC}"
    echo "1. Check pod logs: kubectl logs -n control-panel <pod-name>"
    echo "2. Describe pods: kubectl describe --insecure-skip-tls-verify pod -n control-panel <pod-name>"
    echo "3. Check events: kubectl get --insecure-skip-tls-verify events -n control-panel --sort-by='.lastTimestamp'"
    echo "4. Verify secrets: kubectl get --insecure-skip-tls-verify secret control-panel-secrets -n control-panel -o yaml"
fi

echo ""
echo -e "${BLUE}End of E2E Monitoring Test${NC}"