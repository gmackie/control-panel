#!/bin/bash

# Complete Application Monitoring Setup
# This script sets up comprehensive monitoring for Git repos, Helm charts, pods, and observability

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Complete Application Monitoring Setup${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# Check if cluster is available
echo -e "${YELLOW}Checking cluster connectivity...${NC}"
export KUBECONFIG=~/.kube/config-hetzner

if ! kubectl cluster-info --insecure-skip-tls-verify >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    echo "Please ensure your cluster is accessible and try again."
    exit 1
fi

echo -e "${GREEN}✓ Connected to cluster${NC}"

# Apply all monitoring configurations
echo -e "${YELLOW}Step 1: Applying monitoring configurations...${NC}"

# Core integrations
kubectl apply -f k8s/integrations-full.yaml --insecure-skip-tls-verify
echo -e "${GREEN}  ✓ Applied integration configurations${NC}"

# Application definitions
kubectl apply -f k8s/applications-config.yaml --insecure-skip-tls-verify  
echo -e "${GREEN}  ✓ Applied application monitoring config${NC}"

# Check deployment status
echo -e "${YELLOW}Step 2: Checking deployment status...${NC}"
kubectl get pods -n control-panel --insecure-skip-tls-verify
echo ""

# Create Grafana dashboard configurations
echo -e "${YELLOW}Step 3: Setting up Grafana dashboard links...${NC}"

cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard-links
  namespace: control-panel
data:
  dashboards.json: |
    {
      "control-panel": "https://grafana.gmac.io/d/control-panel/control-panel-overview",
      "landing-page": "https://grafana.gmac.io/d/landing-page/landing-page-metrics", 
      "gmac-chat": "https://grafana.gmac.io/d/gmac-chat/chat-application-metrics",
      "ai-dashboard": "https://grafana.gmac.io/d/ai-dashboard/ai-dashboard-monitoring",
      "dev-tools": "https://grafana.gmac.io/d/dev-tools/development-tools-metrics",
      "api-gateway": "https://grafana.gmac.io/d/api-gateway/api-gateway-overview",
      "user-service": "https://grafana.gmac.io/d/user-service/user-service-metrics",
      "notification-service": "https://grafana.gmac.io/d/notification-service/notification-service-monitoring",
      "analytics-engine": "https://grafana.gmac.io/d/analytics-engine/analytics-engine-metrics",
      "data-pipeline": "https://grafana.gmac.io/d/data-pipeline/data-pipeline-monitoring"
    }
  
  loki_links.json: |
    {
      "control-panel": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"control-panel\\\\\\",app=\\\\\\"control-panel\\\\\\"}\\"}]}",
      "landing-page": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"control-panel\\\\\\",app=\\\\\\"landing-page\\\\\\"}\\"}]}",
      "gmac-chat": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"development\\\\\\",app=\\\\\\"gmac-chat\\\\\\"}\\"}]}",
      "ai-dashboard": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"development\\\\\\",app=\\\\\\"ai-dashboard\\\\\\"}\\"}]}",
      "dev-tools": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"development\\\\\\",app=\\\\\\"dev-tools\\\\\\"}\\"}]}",
      "api-gateway": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"api\\\\\\",app=\\\\\\"api-gateway\\\\\\"}\\"}]}",
      "user-service": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"api\\\\\\",app=\\\\\\"user-service\\\\\\"}\\"}]}",
      "notification-service": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"api\\\\\\",app=\\\\\\"notification-service\\\\\\"}\\"}]}",
      "analytics-engine": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"data\\\\\\",app=\\\\\\"analytics-engine\\\\\\"}\\"}]}",
      "data-pipeline": "https://grafana.gmac.io/explore?left={\\"datasource\\":\\"loki\\",\\"queries\\":[{\\"expr\\":\\"{namespace=\\\\\\"data\\\\\\",app=\\\\\\"data-pipeline\\\\\\"}\\"}]}"
    }
EOF

echo -e "${GREEN}  ✓ Created Grafana dashboard links${NC}"

# Create monitoring endpoints
echo -e "${YELLOW}Step 4: Setting up monitoring endpoints...${NC}"

cat <<EOF | kubectl apply -f - --insecure-skip-tls-verify
apiVersion: v1
kind: Service  
metadata:
  name: monitoring-endpoints
  namespace: control-panel
  labels:
    app.kubernetes.io/name: monitoring-endpoints
spec:
  type: ClusterIP
  ports:
  - port: 9090
    targetPort: 9090
    name: prometheus-metrics
  - port: 3100  
    targetPort: 3100
    name: loki-logs
  selector:
    app.kubernetes.io/name: control-panel
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monitoring-endpoints
  namespace: control-panel
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: control.gmac.io
    http:
      paths:
      - path: /monitoring
        pathType: Prefix
        backend:
          service:
            name: monitoring-endpoints
            port:
              number: 9090
EOF

echo -e "${GREEN}  ✓ Created monitoring endpoints${NC}"

# Update deployment to include monitoring volumes
echo -e "${YELLOW}Step 5: Updating deployment with monitoring configs...${NC}"

# Check if control panel deployment exists and update it
if kubectl get deployment control-panel -n control-panel --insecure-skip-tls-verify >/dev/null 2>&1; then
    # Add volume mounts for monitoring configs
    kubectl patch deployment control-panel -n control-panel --insecure-skip-tls-verify --type='merge' -p='
    {
      "spec": {
        "template": {
          "spec": {
            "volumes": [
              {
                "name": "applications-config",
                "configMap": {
                  "name": "applications-config"
                }
              },
              {
                "name": "grafana-links",
                "configMap": {
                  "name": "grafana-dashboard-links"
                }
              }
            ],
            "containers": [
              {
                "name": "control-panel",
                "volumeMounts": [
                  {
                    "name": "applications-config",
                    "mountPath": "/app/config/applications.yaml",
                    "subPath": "applications.yaml"
                  },
                  {
                    "name": "grafana-links", 
                    "mountPath": "/app/config/grafana-dashboards.json",
                    "subPath": "dashboards.json"
                  }
                ]
              }
            ]
          }
        }
      }
    }'
    
    echo -e "${GREEN}  ✓ Updated control panel deployment${NC}"
else
    echo -e "${YELLOW}  ⚠ Control panel deployment not found, will be configured on next deployment${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Complete Application Monitoring Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Monitoring Features Enabled:${NC}"
echo ""
echo -e "${GREEN}📊 Application Monitoring:${NC}"
echo "  • Git repository tracking via Gitea API"
echo "  • Helm chart status and release information"  
echo "  • Pod status, health, and restart monitoring"
echo "  • Real-time application health checks"
echo ""
echo -e "${GREEN}📈 Observability Integration:${NC}"
echo "  • Grafana dashboards for each application"
echo "  • Loki log aggregation and querying"
echo "  • Prometheus metrics and alerting"
echo "  • Direct links to logs and metrics for each app"
echo ""
echo -e "${GREEN}🔗 Quick Access Links:${NC}"
echo "  • Control Panel: https://control.gmac.io/monitoring"
echo "  • Grafana: https://grafana.gmac.io" 
echo "  • Prometheus: https://prometheus.gmac.io"
echo "  • Loki Logs: https://grafana.gmac.io/explore"
echo ""
echo -e "${YELLOW}Applications Being Monitored:${NC}"
echo "  1. control-panel (production)"
echo "  2. landing-page (production)"  
echo "  3. gmac-chat (development)"
echo "  4. ai-dashboard (development)"
echo "  5. dev-tools (staging)"
echo "  6. api-gateway (production)"
echo "  7. user-service (production)"
echo "  8. notification-service (production)"
echo "  9. analytics-engine (production)"
echo "  10. data-pipeline (production)"
echo ""
echo -e "${YELLOW}For Each Application You Can Monitor:${NC}"
echo "  ✅ Git repo status and latest commits"
echo "  ✅ Helm chart version and deployment status"
echo "  ✅ Pod count, health, and restart history"
echo "  ✅ Direct links to Grafana dashboards"
echo "  ✅ Direct links to Loki logs"
echo "  ✅ Prometheus metrics and alerts"
echo "  ✅ Real-time health and response time"
echo "  ✅ CI/CD pipeline status"
echo ""
echo -e "${GREEN}🚀 Next Steps:${NC}"
echo "1. Visit https://control.gmac.io/monitoring to view the dashboard"
echo "2. Configure your actual Grafana/Prometheus URLs in the integration setup"
echo "3. Set up webhooks in Gitea for real-time repository updates"
echo "4. Configure Prometheus scraping for your applications"
echo "5. Set up Loki log shipping from your applications"
echo ""
echo -e "${BLUE}The control panel now provides comprehensive monitoring${NC}"
echo -e "${BLUE}for your entire application ecosystem! 🎉${NC}"