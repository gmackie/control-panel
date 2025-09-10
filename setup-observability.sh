#!/bin/bash

# Setup Observability for Control Panel Applications
# Configures Prometheus scraping and Loki log shipping

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 Observability Setup for Control Panel${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

export KUBECONFIG=/Users/mackieg/.kube/config-hetzner

# 1. Create Prometheus ServiceMonitor for applications
echo -e "${BLUE}1. Setting up Prometheus ServiceMonitors${NC}"
echo -e "${BLUE}---------------------------------------${NC}"

cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: control-panel
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
      # Control Panel Application
      - job_name: 'control-panel'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - control-panel
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
            action: keep
            regex: control-panel
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
      
      # Landing Page
      - job_name: 'landing-page'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - control-panel
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
            action: keep
            regex: landing-page
      
      # Development Applications
      - job_name: 'development-apps'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - development
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            regex: ([^:]+)(?::\d+)?;(\d+)
            replacement: \$1:\$2
            target_label: __address__
      
      # API Services
      - job_name: 'api-services'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - api
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
      
      # Data Services
      - job_name: 'data-services'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - data
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
EOF

echo -e "${GREEN}  ✓ Created Prometheus scraping configuration${NC}"

# 2. Create Loki log shipping configuration
echo -e "${BLUE}2. Setting up Loki Log Shipping${NC}"
echo -e "${BLUE}-------------------------------${NC}"

cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-promtail-config
  namespace: control-panel
data:
  promtail.yaml: |
    server:
      http_listen_port: 9080
      grpc_listen_port: 0
    
    positions:
      filename: /tmp/positions.yaml
    
    clients:
      - url: https://loki.gmac.io/loki/api/v1/push
    
    scrape_configs:
      # Control Panel namespace
      - job_name: control-panel
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - control-panel
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_node_name]
            target_label: node
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
          - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
            target_label: app
          - source_labels: [__meta_kubernetes_pod_container_name]
            target_label: container
        pipeline_stages:
          - regex:
              expression: '(?P<timestamp>\S+)\s+(?P<level>\S+)\s+(?P<message>.*)'
          - labels:
              level:
      
      # Development namespace
      - job_name: development
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - development
        relabel_configs:
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_label_app]
            target_label: app
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
      
      # API namespace
      - job_name: api
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - api
        relabel_configs:
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_label_app]
            target_label: app
      
      # Data namespace
      - job_name: data
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - data
        relabel_configs:
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_label_app]
            target_label: app
EOF

echo -e "${GREEN}  ✓ Created Loki log shipping configuration${NC}"

# 3. Create ServiceMonitor CRDs for Prometheus Operator (if available)
echo -e "${BLUE}3. Creating ServiceMonitor Resources${NC}"
echo -e "${BLUE}-----------------------------------${NC}"

cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify 2>/dev/null || echo -e "${YELLOW}  ⚠ ServiceMonitor CRD not available (Prometheus Operator not installed)${NC}"
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: control-panel-monitor
  namespace: control-panel
  labels:
    app.kubernetes.io/name: control-panel
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: control-panel
  endpoints:
  - port: http
    path: /api/metrics
    interval: 15s
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: landing-page-monitor
  namespace: control-panel
  labels:
    app.kubernetes.io/name: landing-page
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: landing-page
  endpoints:
  - port: http
    path: /metrics
    interval: 15s
EOF

# 4. Create Grafana Dashboard ConfigMap
echo -e "${BLUE}4. Creating Grafana Dashboard Templates${NC}"
echo -e "${BLUE}---------------------------------------${NC}"

cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
  namespace: control-panel
data:
  control-panel-dashboard.json: |
    {
      "dashboard": {
        "title": "Control Panel Overview",
        "panels": [
          {
            "title": "Application Health",
            "type": "stat",
            "targets": [
              {
                "expr": "up{job='control-panel'}",
                "legendFormat": "Health Status"
              }
            ]
          },
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total{job='control-panel'}[5m])",
                "legendFormat": "Requests/sec"
              }
            ]
          },
          {
            "title": "Response Time (95th percentile)",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job='control-panel'}[5m]))",
                "legendFormat": "95th percentile"
              }
            ]
          },
          {
            "title": "Error Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total{job='control-panel',status=~'5..'}[5m])",
                "legendFormat": "Error Rate"
              }
            ]
          },
          {
            "title": "Pod Memory Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "container_memory_usage_bytes{pod=~'control-panel.*'}",
                "legendFormat": "{{pod}}"
              }
            ]
          },
          {
            "title": "Pod CPU Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(container_cpu_usage_seconds_total{pod=~'control-panel.*'}[5m])",
                "legendFormat": "{{pod}}"
              }
            ]
          }
        ]
      }
    }
EOF

echo -e "${GREEN}  ✓ Created Grafana dashboard templates${NC}"

# 5. Create Alert Rules
echo -e "${BLUE}5. Setting up Prometheus Alert Rules${NC}"
echo -e "${BLUE}------------------------------------${NC}"

cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-alerts
  namespace: control-panel
data:
  alerts.yaml: |
    groups:
      - name: control-panel-alerts
        interval: 30s
        rules:
          - alert: ControlPanelDown
            expr: up{job="control-panel"} == 0
            for: 1m
            labels:
              severity: critical
              service: control-panel
            annotations:
              summary: "Control Panel is down"
              description: "The control panel application has been down for more than 1 minute."
          
          - alert: HighErrorRate
            expr: rate(http_requests_total{job="control-panel",status=~"5.."}[5m]) > 0.1
            for: 2m
            labels:
              severity: warning
              service: control-panel
            annotations:
              summary: "High error rate on Control Panel"
              description: "Error rate is above 10% for more than 2 minutes."
          
          - alert: HighResponseTime
            expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) > 1
            for: 5m
            labels:
              severity: warning
              service: control-panel
            annotations:
              summary: "High response time on Control Panel"
              description: "95th percentile response time is above 1 second."
          
          - alert: PodMemoryHigh
            expr: container_memory_usage_bytes{pod=~"control-panel.*"} > 900000000
            for: 5m
            labels:
              severity: warning
              service: control-panel
            annotations:
              summary: "High memory usage on Control Panel pod"
              description: "Pod {{ \$labels.pod }} memory usage is above 900MB."
EOF

echo -e "${GREEN}  ✓ Created Prometheus alert rules${NC}"

# 6. Create namespaces if they don't exist
echo -e "${BLUE}6. Ensuring Application Namespaces Exist${NC}"
echo -e "${BLUE}---------------------------------------${NC}"

for ns in development api data; do
    kubectl create namespace $ns --insecure-skip-tls-verify 2>/dev/null && \
        echo -e "${GREEN}  ✓ Created namespace: $ns${NC}" || \
        echo -e "${YELLOW}  ⚠ Namespace $ns already exists${NC}"
done

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Observability Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Prometheus Configuration:${NC}"
echo "  • Scraping control-panel, landing-page"
echo "  • Monitoring development, api, data namespaces"
echo "  • Alert rules configured"
echo "  • ServiceMonitors created (if Prometheus Operator exists)"
echo ""

echo -e "${YELLOW}Loki Configuration:${NC}"
echo "  • Log collection from all application namespaces"
echo "  • Labels: namespace, app, pod, container"
echo "  • Log parsing pipeline configured"
echo ""

echo -e "${YELLOW}Grafana Dashboards:${NC}"
echo "  • Control Panel Overview dashboard template created"
echo "  • Metrics: Health, Request Rate, Response Time, Errors"
echo "  • Resource monitoring: CPU and Memory"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Deploy Prometheus using the prometheus-config ConfigMap"
echo "2. Deploy Promtail using the loki-promtail-config ConfigMap"
echo "3. Import dashboard templates into Grafana"
echo "4. Configure alert notification channels"
echo "5. Test metrics and logs are being collected"
echo ""

echo -e "${GREEN}Your observability stack is ready for deployment!${NC}"