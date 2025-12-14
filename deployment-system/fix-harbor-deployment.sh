#!/bin/bash
set -euo pipefail

# Fix Harbor deployment issues

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

export KUBECONFIG="${KUBECONFIG:-/Users/mackieg/.kube/config-hetzner}"

print_info "🔧 Fixing Harbor Deployment"
echo

# Option 1: Try to fix the existing deployment
print_info "Option 1: Attempting to fix existing Harbor deployment..."

# Delete the failing pods
print_info "Deleting failed pods..."
kubectl delete pod -n registry -l app=harbor --force --grace-period=0 2>/dev/null || true

# Scale down and up
print_info "Scaling Harbor deployments..."
kubectl scale deployment -n registry --all --replicas=0
kubectl scale statefulset -n registry --all --replicas=0
sleep 5

# Scale back up
kubectl scale statefulset -n registry harbor-database --replicas=1
sleep 10
kubectl scale statefulset -n registry harbor-redis --replicas=1
sleep 10
kubectl scale deployment -n registry harbor-core --replicas=1
kubectl scale deployment -n registry harbor-jobservice --replicas=1
kubectl scale deployment -n registry harbor-portal --replicas=1
kubectl scale deployment -n registry harbor-registry --replicas=1
kubectl scale statefulset -n registry harbor-trivy --replicas=1

print_info "Waiting for pods to start..."
sleep 20

# Check status
kubectl get pods -n registry

# If still failing, provide alternative solution
if kubectl get pods -n registry | grep -E "CrashLoop|Error" > /dev/null; then
    print_warning "Harbor is still having issues. Here's a fresh minimal Harbor deployment:"
    
    cat > /tmp/harbor-minimal.yaml << 'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: harbor-new
---
apiVersion: v1
kind: Secret
metadata:
  name: harbor-secret
  namespace: harbor-new
type: Opaque
stringData:
  HARBOR_ADMIN_PASSWORD: "Harbor12345"
  secretkey: "not-a-secure-key"
  REGISTRY_CREDENTIAL_USERNAME: "harbor_registry_user"
  REGISTRY_CREDENTIAL_PASSWORD: "harbor_registry_password"
  POSTGRESQL_PASSWORD: "harbor_db_password"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: harbor-config
  namespace: harbor-new
data:
  app.conf: |
    appname = Harbor
    runmode = prod
    enablegzip = true
  
  harbor.yml: |
    hostname: registry.gmac.io
    http:
      port: 80
    harbor_admin_password: Harbor12345
    database:
      password: harbor_db_password
      max_idle_conns: 50
      max_open_conns: 1000
    data_volume: /data
    log:
      level: info
      local:
        rotate_count: 50
        rotate_size: 200M
        location: /var/log/harbor
    _version: 2.13.2
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: harbor-simple
  namespace: harbor-new
spec:
  replicas: 1
  selector:
    matchLabels:
      app: harbor-simple
  template:
    metadata:
      labels:
        app: harbor-simple
    spec:
      containers:
      - name: registry
        image: registry:2.8.3
        ports:
        - containerPort: 5000
        env:
        - name: REGISTRY_HTTP_ADDR
          value: "0.0.0.0:5000"
        - name: REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY
          value: "/var/lib/registry"
        volumeMounts:
        - name: registry-data
          mountPath: /var/lib/registry
      - name: harbor-core
        image: goharbor/harbor-core:v2.13.2
        ports:
        - containerPort: 8080
        env:
        - name: HARBOR_ADMIN_PASSWORD
          value: "Harbor12345"
        - name: EXT_ENDPOINT
          value: "https://registry.gmac.io"
        - name: CORE_URL
          value: "http://localhost:8080"
        - name: JOBSERVICE_URL
          value: "http://localhost:8080"
        - name: REGISTRY_URL
          value: "http://localhost:5000"
        - name: TOKEN_SERVICE_URL
          value: "http://localhost:8080/service/token"
        - name: HARBOR_DATABASE_HOST
          value: "localhost"
        - name: HARBOR_DATABASE_PORT
          value: "5432"
        - name: HARBOR_DATABASE_USERNAME
          value: "postgres"
        - name: HARBOR_DATABASE_PASSWORD
          value: "harbor_db_password"
        - name: HARBOR_DATABASE_DBNAME
          value: "registry"
        - name: _REDIS_URL_CORE
          value: "redis://localhost:6379/0"
        - name: LOG_LEVEL
          value: "info"
        - name: CONFIG_PATH
          value: "/etc/core/app.conf"
        - name: SYNC_QUOTA
          value: "true"
        volumeMounts:
        - name: config
          mountPath: /etc/core
      - name: postgres
        image: postgres:13-alpine
        env:
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          value: "harbor_db_password"
        - name: POSTGRES_DB
          value: "registry"
        volumeMounts:
        - name: database-data
          mountPath: /var/lib/postgresql/data
      - name: redis
        image: redis:7-alpine
        command: ["redis-server", "--save", ""]
      volumes:
      - name: config
        configMap:
          name: harbor-config
      - name: registry-data
        emptyDir: {}
      - name: database-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: harbor-simple
  namespace: harbor-new
spec:
  type: ClusterIP
  selector:
    app: harbor-simple
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: registry
    port: 5000
    targetPort: 5000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-simple-ingress
  namespace: harbor-new
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "0"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - registry-simple.gmac.io
    secretName: harbor-simple-tls
  rules:
  - host: registry-simple.gmac.io
    http:
      paths:
      - path: /v2
        pathType: Prefix
        backend:
          service:
            name: harbor-simple
            port:
              number: 5000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: harbor-simple
            port:
              number: 80
EOF

    print_info ""
    print_warning "To deploy a fresh minimal Harbor:"
    echo "kubectl apply -f /tmp/harbor-minimal.yaml"
    echo ""
    echo "This will create a simple Harbor at registry-simple.gmac.io"
    echo "Login: docker login registry-simple.gmac.io"
    echo "Username: admin"
    echo "Password: Harbor12345"
else
    print_success "Harbor pods are starting up!"
fi

print_info ""
print_info "Checking Harbor service endpoints..."
kubectl get endpoints -n registry

print_info ""
print_info "Testing Harbor API (may take a moment)..."
sleep 10
if curl -s -u admin:Harbor12345 "https://registry.gmac.io/api/v2.0/systeminfo" 2>/dev/null | grep -q harbor_version; then
    print_success "Harbor API is responding!"
else
    print_warning "Harbor API not yet accessible. It may need more time to start."
    print_info "You can check the status with:"
    echo "  kubectl get pods -n registry -w"
    echo "  curl -u admin:Harbor12345 https://registry.gmac.io/api/v2.0/systeminfo"
fi