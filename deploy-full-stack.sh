#!/bin/bash

# Full Stack Deployment Script for Control Panel
# This script deploys the control panel with all integrations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="control-panel"
ARGOCD_NAMESPACE="argocd"
MONITORING_NAMESPACE="monitoring"

echo -e "${GREEN}🚀 Starting Full Stack Deployment of Control Panel${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists kubectl; then
    echo -e "${RED}kubectl is not installed. Please install kubectl first.${NC}"
    exit 1
fi

if ! command_exists helm; then
    echo -e "${RED}helm is not installed. Please install helm first.${NC}"
    exit 1
fi

# Check cluster connection
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo -e "${RED}Cannot connect to Kubernetes cluster. Please configure kubectl.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Create namespaces
echo -e "${YELLOW}Creating namespaces...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace $ARGOCD_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Install ArgoCD if not already installed
echo -e "${YELLOW}Installing ArgoCD...${NC}"
if ! kubectl get deployment -n $ARGOCD_NAMESPACE argocd-server >/dev/null 2>&1; then
    kubectl create namespace $ARGOCD_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -n $ARGOCD_NAMESPACE -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    
    # Wait for ArgoCD to be ready
    echo "Waiting for ArgoCD to be ready..."
    kubectl wait --for=condition=available --timeout=600s deployment/argocd-server -n $ARGOCD_NAMESPACE
else
    echo -e "${GREEN}ArgoCD is already installed${NC}"
fi

# Install Prometheus and Grafana using kube-prometheus-stack
echo -e "${YELLOW}Installing Prometheus and Grafana...${NC}"
if ! kubectl get deployment -n $MONITORING_NAMESPACE prometheus-kube-prometheus-prometheus-oper >/dev/null 2>&1; then
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    cat <<EOF > /tmp/prometheus-values.yaml
grafana:
  enabled: true
  adminPassword: admin
  ingress:
    enabled: true
    hosts:
      - grafana.gmac.io
prometheus:
  prometheusSpec:
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    ruleSelectorNilUsesHelmValues: false
  ingress:
    enabled: true
    hosts:
      - prometheus.gmac.io
alertmanager:
  alertmanagerSpec:
    config:
      global:
        resolve_timeout: 5m
      route:
        group_by: ['alertname', 'cluster', 'service']
        group_wait: 10s
        group_interval: 10s
        repeat_interval: 12h
        receiver: 'control-panel'
      receivers:
      - name: 'control-panel'
        webhook_configs:
        - url: 'http://control-panel.control-panel.svc.cluster.local:3000/api/webhooks/prometheus/alerts'
          send_resolved: true
EOF
    
    helm install prometheus prometheus-community/kube-prometheus-stack \
        -n $MONITORING_NAMESPACE \
        -f /tmp/prometheus-values.yaml \
        --create-namespace
    
    rm /tmp/prometheus-values.yaml
else
    echo -e "${GREEN}Prometheus and Grafana are already installed${NC}"
fi

# Deploy Control Panel ConfigMaps and Secrets
echo -e "${YELLOW}Deploying Control Panel configurations...${NC}"
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-configmap.yaml
kubectl apply -f k8s/integrations-config.yaml
kubectl apply -f k8s/webhook-config.yaml

# Check if secrets exist, if not create from template
if ! kubectl get secret control-panel-secrets -n $NAMESPACE >/dev/null 2>&1; then
    echo -e "${YELLOW}Creating secrets from template...${NC}"
    echo -e "${RED}WARNING: Please edit k8s/03-secret.yaml with your actual secrets before running this in production!${NC}"
    kubectl apply -f k8s/03-secret.yaml
else
    echo -e "${GREEN}Secrets already exist${NC}"
fi

# Deploy RBAC
echo -e "${YELLOW}Deploying RBAC...${NC}"
kubectl apply -f k8s/07-rbac.yaml

# Deploy the application
echo -e "${YELLOW}Deploying Control Panel application...${NC}"
kubectl apply -f k8s/04-deployment.yaml
kubectl apply -f k8s/05-service.yaml
kubectl apply -f k8s/06-ingress.yaml

# Deploy Prometheus monitoring
echo -e "${YELLOW}Deploying Prometheus ServiceMonitor and Rules...${NC}"
kubectl apply -f k8s/prometheus-servicemonitor.yaml

# Deploy Grafana dashboard
echo -e "${YELLOW}Deploying Grafana dashboard...${NC}"
kubectl apply -f k8s/grafana-dashboard.yaml

# Deploy ArgoCD Application
echo -e "${YELLOW}Setting up ArgoCD application...${NC}"
kubectl apply -f k8s/argocd-application.yaml

# Wait for deployment to be ready
echo -e "${YELLOW}Waiting for Control Panel deployment to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/control-panel -n $NAMESPACE

# Get ArgoCD admin password
echo -e "${YELLOW}Getting ArgoCD admin password...${NC}"
ARGOCD_PASSWORD=$(kubectl -n $ARGOCD_NAMESPACE get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

# Get service endpoints
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${GREEN}Service Endpoints:${NC}"
echo "Control Panel: https://control.gmac.io"
echo "ArgoCD: https://argocd.gmac.io (admin / $ARGOCD_PASSWORD)"
echo "Grafana: https://grafana.gmac.io (admin / admin)"
echo "Prometheus: https://prometheus.gmac.io"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update DNS records to point to your ingress controller"
echo "2. Configure SSL certificates (cert-manager recommended)"
echo "3. Update secrets in k8s/03-secret.yaml with actual values"
echo "4. Configure Gitea webhook to point to https://control.gmac.io/api/webhooks/gitea"
echo "5. Configure Harbor webhook to point to https://control.gmac.io/api/webhooks/harbor"
echo "6. Set up ArgoCD to monitor your Git repository"
echo ""
echo -e "${GREEN}To access the services locally, you can port-forward:${NC}"
echo "kubectl port-forward -n $NAMESPACE svc/control-panel 3000:3000"
echo "kubectl port-forward -n $ARGOCD_NAMESPACE svc/argocd-server 8080:443"
echo "kubectl port-forward -n $MONITORING_NAMESPACE svc/prometheus-kube-prometheus-prometheus 9090:9090"
echo "kubectl port-forward -n $MONITORING_NAMESPACE svc/prometheus-grafana 3001:80"