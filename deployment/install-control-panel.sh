#!/bin/bash
# Enhanced Control Panel Installation Script
# Uses public Docker registry images

set -euo pipefail

# Default configuration
NAMESPACE="control-panel"
DOMAIN="${DOMAIN:-control-panel.local}"
REGISTRY="${REGISTRY:-ghcr.io/gmackie}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
STORAGE_CLASS="${STORAGE_CLASS:-longhorn}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check for required namespaces/resources
    if ! kubectl get storageclass "${STORAGE_CLASS}" &> /dev/null; then
        warn "Storage class '${STORAGE_CLASS}' not found, using default"
        STORAGE_CLASS="default"
    fi
    
    success "Prerequisites checked"
}

# Create namespace and basic resources
create_namespace() {
    info "Creating namespace and basic resources..."
    
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
  labels:
    name: ${NAMESPACE}
    app.kubernetes.io/name: control-panel
    app.kubernetes.io/version: ${IMAGE_TAG}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: control-panel
  namespace: ${NAMESPACE}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: control-panel
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "endpoints", "persistentvolumeclaims", "events", "configmaps", "secrets", "namespaces", "nodes"]
    verbs: ["*"]
  - apiGroups: ["apps"]
    resources: ["deployments", "daemonsets", "replicasets", "statefulsets"]
    verbs: ["*"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["*"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["*"]
  - apiGroups: [""]
    resources: ["pods/log", "pods/exec", "pods/portforward"]
    verbs: ["get", "list", "create"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods", "nodes"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: control-panel
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: control-panel
subjects:
  - kind: ServiceAccount
    name: control-panel
    namespace: ${NAMESPACE}
EOF

    success "Namespace and RBAC created"
}

# Create configuration
create_configuration() {
    info "Creating configuration..."
    
    # Detect monitoring setup
    PROMETHEUS_URL="http://prometheus-kube-prometheus-prometheus.monitoring:9090"
    GRAFANA_URL="/grafana"
    ALERTMANAGER_URL="http://alertmanager-kube-prometheus-alertmanager.monitoring:9093"
    
    # Check if monitoring namespace exists and adjust URLs
    if kubectl get namespace monitoring &> /dev/null; then
        info "Monitoring namespace detected, using internal service URLs"
    else
        warn "Monitoring namespace not found, some features may be limited"
        PROMETHEUS_URL="http://prometheus:9090"
        GRAFANA_URL="http://grafana:3000"
        ALERTMANAGER_URL="http://alertmanager:9093"
    fi
    
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: control-panel-config
  namespace: ${NAMESPACE}
data:
  config.json: |
    {
      "api": {
        "kubernetes": {
          "inCluster": true
        }
      },
      "features": {
        "monitoring": true,
        "deployments": true,
        "gitea": true,
        "logs": true,
        "metrics": true,
        "clusterScaling": true,
        "nodeManagement": true,
        "vpsManagement": true,
        "hybridInfrastructure": true,
        "aiOperations": true,
        "incidentPrediction": true,
        "capacityPlanning": true,
        "rootCauseAnalysis": true,
        "resourceOptimization": true,
        "anomalyDetection": true
      },
      "services": {
        "prometheus": "${PROMETHEUS_URL}",
        "grafana": "${GRAFANA_URL}",
        "alertmanager": "${ALERTMANAGER_URL}",
        "incidentPrediction": "http://control-panel-incident-prediction:8001",
        "capacityPlanning": "http://control-panel-capacity-planning:8001",
        "rootCauseAnalysis": "http://control-panel-root-cause-analysis:8001",
        "resourceOptimization": "http://control-panel-resource-optimization:8001",
        "anomalyDetection": "http://control-panel-anomaly-detection:8001"
      },
      "scaling": {
        "enabled": true,
        "provider": "hetzner",
        "thresholds": {
          "cpuScaleUp": 80,
          "cpuScaleDown": 20,
          "memScaleUp": 80,
          "memScaleDown": 20
        },
        "limits": {
          "minNodes": 1,
          "maxNodes": 10
        },
        "cooldown": {
          "scaleUp": 300,
          "scaleDown": 600
        }
      },
      "ai": {
        "enabled": true,
        "models": {
          "incidentPrediction": {
            "enabled": true,
            "confidence_threshold": 0.8
          },
          "capacityPlanning": {
            "enabled": true,
            "forecast_horizon_hours": 24
          },
          "anomalyDetection": {
            "enabled": true,
            "detection_methods": ["statistical", "ml", "ensemble"]
          }
        }
      }
    }
EOF

    success "Configuration created"
}

# Create persistent storage
create_storage() {
    info "Creating persistent storage..."
    
    kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: control-panel-data
  namespace: ${NAMESPACE}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: ${STORAGE_CLASS}
EOF

    success "Storage created"
}

# Deploy frontend
deploy_frontend() {
    info "Deploying frontend..."
    
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: control-panel-frontend
  namespace: ${NAMESPACE}
  labels:
    app: control-panel-frontend
    component: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: control-panel-frontend
  template:
    metadata:
      labels:
        app: control-panel-frontend
        component: frontend
    spec:
      serviceAccountName: control-panel
      containers:
      - name: frontend
        image: ${REGISTRY}/control-panel:${IMAGE_TAG}
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "3000"
        - name: BACKEND_URL
          value: "http://control-panel-backend:8000"
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: control-panel-config
---
apiVersion: v1
kind: Service
metadata:
  name: control-panel-frontend
  namespace: ${NAMESPACE}
  labels:
    app: control-panel-frontend
spec:
  selector:
    app: control-panel-frontend
  ports:
  - port: 80
    targetPort: http
    protocol: TCP
    name: http
EOF

    success "Frontend deployed"
}

# Deploy backend
deploy_backend() {
    info "Deploying backend..."
    
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: control-panel-backend
  namespace: ${NAMESPACE}
  labels:
    app: control-panel-backend
    component: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: control-panel-backend
  template:
    metadata:
      labels:
        app: control-panel-backend
        component: backend
    spec:
      serviceAccountName: control-panel
      containers:
      - name: backend
        image: ${REGISTRY}/control-panel-backend:${IMAGE_TAG}
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: ENVIRONMENT
          value: production
        - name: LOG_LEVEL
          value: info
        - name: PROMETHEUS_URL
          value: "${PROMETHEUS_URL}"
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: data
          mountPath: /app/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: control-panel-config
      - name: data
        persistentVolumeClaim:
          claimName: control-panel-data
---
apiVersion: v1
kind: Service
metadata:
  name: control-panel-backend
  namespace: ${NAMESPACE}
  labels:
    app: control-panel-backend
spec:
  selector:
    app: control-panel-backend
  ports:
  - port: 8000
    targetPort: http
    protocol: TCP
    name: http
EOF

    success "Backend deployed"
}

# Deploy AI services
deploy_ai_services() {
    info "Deploying AI services..."
    
    local services=("incident-prediction" "capacity-planning" "root-cause-analysis" "resource-optimization" "anomaly-detection")
    
    for service in "${services[@]}"; do
        info "Deploying ${service}..."
        
        kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: control-panel-${service}
  namespace: ${NAMESPACE}
  labels:
    app: control-panel-${service}
    component: ai-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: control-panel-${service}
  template:
    metadata:
      labels:
        app: control-panel-${service}
        component: ai-service
    spec:
      containers:
      - name: ${service}
        image: ${REGISTRY}/control-panel-${service}:${IMAGE_TAG}
        imagePullPolicy: Always
        ports:
        - containerPort: 8001
          name: http
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: control-panel-${service}
  namespace: ${NAMESPACE}
  labels:
    app: control-panel-${service}
spec:
  selector:
    app: control-panel-${service}
  ports:
  - port: 8001
    targetPort: http
    protocol: TCP
    name: http
---
EOF
    done
    
    success "AI services deployed"
}

# Create ingress
create_ingress() {
    info "Creating ingress..."
    
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: control-panel
  namespace: ${NAMESPACE}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "300"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - ${DOMAIN}
    secretName: control-panel-tls
  rules:
  - host: ${DOMAIN}
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: control-panel-backend
            port:
              name: http
      - path: /
        pathType: Prefix
        backend:
          service:
            name: control-panel-frontend
            port:
              name: http
EOF

    success "Ingress created"
}

# Wait for deployments
wait_for_deployments() {
    info "Waiting for deployments to be ready..."
    
    local deployments=("control-panel-frontend" "control-panel-backend" "control-panel-incident-prediction" "control-panel-capacity-planning" "control-panel-root-cause-analysis" "control-panel-resource-optimization" "control-panel-anomaly-detection")
    
    for deployment in "${deployments[@]}"; do
        info "Waiting for ${deployment}..."
        kubectl wait --for=condition=available --timeout=300s deployment/${deployment} -n ${NAMESPACE}
    done
    
    success "All deployments ready"
}

# Main installation function
main() {
    echo "============================================"
    echo "   GMAC.IO Control Panel Installation"
    echo "============================================"
    echo ""
    echo "Configuration:"
    echo "  Domain: ${DOMAIN}"
    echo "  Registry: ${REGISTRY}"
    echo "  Image Tag: ${IMAGE_TAG}"
    echo "  Storage Class: ${STORAGE_CLASS}"
    echo ""
    
    check_prerequisites
    create_namespace
    create_configuration
    create_storage
    deploy_frontend
    deploy_backend
    deploy_ai_services
    create_ingress
    wait_for_deployments
    
    echo ""
    echo "============================================"
    success "Control Panel installation completed!"
    echo "============================================"
    echo ""
    echo "Access your control panel at: https://${DOMAIN}"
    echo ""
    echo "Features available:"
    echo "  ✓ Kubernetes cluster management"
    echo "  ✓ Application deployments"
    echo "  ✓ Monitoring integration"
    echo "  ✓ AI-powered incident prediction"
    echo "  ✓ Intelligent capacity planning"
    echo "  ✓ Automated root cause analysis"
    echo "  ✓ Smart resource optimization"
    echo "  ✓ Anomaly detection and forecasting"
    echo ""
    echo "To check status: kubectl get pods -n ${NAMESPACE}"
    echo "To view logs: kubectl logs -f deployment/control-panel-frontend -n ${NAMESPACE}"
}

# Run installation
main "$@"