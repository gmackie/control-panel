#!/bin/bash
set -euo pipefail

# Comprehensive Project Setup Script for K3s Cluster Deployment

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Default values
PROJECT_NAME=""
PROJECT_PATH=""
DOMAIN=""
CREATE_TURSO_DB=false
CREATE_STAGING=false
STAGING_DOMAIN=""
PORT=3000
PROJECT_TYPE="auto"
NAMESPACE=""
GITEA_REPO=""
SKIP_GIT=false
CREATE_SECRETS=true

# Credentials (loaded from environment or credentials.env)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/credentials.env" ]; then
    source "$SCRIPT_DIR/credentials.env"
fi

# Ensure required environment variables are set
: ${KUBECONFIG:="/Users/mackieg/.kube/config-hetzner"}
: ${GITEA_URL:="https://git.gmac.io"}
: ${GITEA_USER:="gmackie"}
: ${HARBOR_URL:="registry.gmac.io"}
: ${HARBOR_USER:="admin"}
: ${HARBOR_PASSWORD:="Harbor12345"}
: ${TURSO_TOKEN:="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1WGRRT0pOZUVmQ1lieXBIQk9CQVVRIn0.gNVOOypsfbOcAeEvtEujJEDiR2gaN0auj_UecVfiAR7O3ZfOM_IzUg8bkhvcruqNeQAj2Fij9PB8i3-knYGvDw"}

# Parse command line arguments
usage() {
    cat << EOF
Usage: $0 --name <project-name> --path <project-path> [OPTIONS]

Required:
  --name <name>          Project name
  --path <path>          Path to project directory

Options:
  --domain <domain>      Primary domain for the application
  --staging              Create staging environment (beta.<domain>)
  --turso-db            Create Turso database for the project
  --port <port>         Application port (default: 3000)
  --type <type>         Project type: node|python|go|static|auto (default: auto)
  --namespace <ns>      Kubernetes namespace (default: project name)
  --gitea-repo <repo>   Existing Gitea repository (skip creation)
  --skip-git           Skip Git operations
  --no-secrets         Skip secret creation

Examples:
  # Basic deployment
  $0 --name my-app --path ./my-app --domain my-app.gmac.io

  # Full setup with database and staging
  $0 --name my-app --path ./my-app --domain my-app.gmac.io --staging --turso-db

  # Deploy existing repo
  $0 --name my-app --path ./my-app --gitea-repo gmackie/my-app --domain my-app.gmac.io

EOF
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --name)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --path)
            PROJECT_PATH="$2"
            shift 2
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --staging)
            CREATE_STAGING=true
            shift
            ;;
        --turso-db)
            CREATE_TURSO_DB=true
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --type)
            PROJECT_TYPE="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --gitea-repo)
            GITEA_REPO="$2"
            SKIP_GIT=true
            shift 2
            ;;
        --skip-git)
            SKIP_GIT=true
            shift
            ;;
        --no-secrets)
            CREATE_SECRETS=false
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [ -z "$PROJECT_NAME" ] || [ -z "$PROJECT_PATH" ]; then
    print_error "Project name and path are required"
    usage
fi

# Set defaults
NAMESPACE="${NAMESPACE:-$PROJECT_NAME}"
DOMAIN="${DOMAIN:-$PROJECT_NAME.gmac.io}"
STAGING_DOMAIN="beta.$DOMAIN"

# Resolve project path
PROJECT_PATH=$(realpath "$PROJECT_PATH")

print_info "🚀 Project Setup Configuration"
print_info "  Project: $PROJECT_NAME"
print_info "  Path: $PROJECT_PATH"
print_info "  Domain: $DOMAIN"
print_info "  Namespace: $NAMESPACE"
print_info "  Port: $PORT"
print_info "  Create Turso DB: $CREATE_TURSO_DB"
print_info "  Create Staging: $CREATE_STAGING"
if [ "$CREATE_STAGING" = true ]; then
    print_info "  Staging Domain: $STAGING_DOMAIN"
fi
echo

# Step 1: Detect project type if auto
if [ "$PROJECT_TYPE" = "auto" ]; then
    if [ -f "$PROJECT_PATH/package.json" ]; then
        PROJECT_TYPE="node"
    elif [ -f "$PROJECT_PATH/requirements.txt" ] || [ -f "$PROJECT_PATH/setup.py" ]; then
        PROJECT_TYPE="python"
    elif [ -f "$PROJECT_PATH/go.mod" ]; then
        PROJECT_TYPE="go"
    elif [ -f "$PROJECT_PATH/index.html" ]; then
        PROJECT_TYPE="static"
    else
        PROJECT_TYPE="generic"
    fi
    print_info "Detected project type: $PROJECT_TYPE"
fi

# Step 2: Create Turso database if requested
TURSO_DB_URL=""
TURSO_DB_TOKEN=""
if [ "$CREATE_TURSO_DB" = true ]; then
    print_info "Creating Turso database..."
    
    # Check if turso CLI is installed
    if ! command -v turso &> /dev/null; then
        print_warning "Turso CLI not found. Installing..."
        curl -sSfL https://get.tur.so/install.sh | bash
        export PATH="$HOME/.turso:$PATH"
    fi
    
    # Create database
    DB_NAME="${PROJECT_NAME}-db"
    if turso db create "$DB_NAME" 2>/dev/null; then
        print_success "Created Turso database: $DB_NAME"
    else
        print_warning "Database may already exist, continuing..."
    fi
    
    # Get database URL
    TURSO_DB_URL=$(turso db show "$DB_NAME" --url 2>/dev/null || echo "")
    
    # Create auth token
    TURSO_DB_TOKEN=$(turso db tokens create "$DB_NAME" 2>/dev/null || echo "")
    
    if [ -n "$TURSO_DB_URL" ] && [ -n "$TURSO_DB_TOKEN" ]; then
        print_success "Turso database configured"
    else
        print_warning "Could not get Turso credentials, will skip database setup"
        CREATE_TURSO_DB=false
    fi
fi

# Step 3: Create Kubernetes namespace
print_info "Creating Kubernetes namespace..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Step 4: Create secrets
if [ "$CREATE_SECRETS" = true ]; then
    print_info "Creating Kubernetes secrets..."
    
    # Harbor registry secret
    kubectl create secret docker-registry harbor-registry \
        --docker-server="$HARBOR_URL" \
        --docker-username="$HARBOR_USER" \
        --docker-password="$HARBOR_PASSWORD" \
        -n "$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Application secrets
    SECRET_ARGS=""
    
    # Add Turso credentials if database was created
    if [ "$CREATE_TURSO_DB" = true ] && [ -n "$TURSO_DB_URL" ]; then
        SECRET_ARGS="$SECRET_ARGS --from-literal=TURSO_DATABASE_URL=$TURSO_DB_URL"
        SECRET_ARGS="$SECRET_ARGS --from-literal=TURSO_AUTH_TOKEN=$TURSO_DB_TOKEN"
    fi
    
    # Add other common secrets
    SECRET_ARGS="$SECRET_ARGS --from-literal=NODE_ENV=production"
    SECRET_ARGS="$SECRET_ARGS --from-literal=APP_NAME=$PROJECT_NAME"
    SECRET_ARGS="$SECRET_ARGS --from-literal=APP_DOMAIN=$DOMAIN"
    
    kubectl create secret generic "${PROJECT_NAME}-secrets" \
        $SECRET_ARGS \
        -n "$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Secrets created"
fi

# Step 5: Create Git repository if not skipping
if [ "$SKIP_GIT" = false ]; then
    print_info "Creating Gitea repository..."
    
    # Create repository
    CREATE_REPO_RESPONSE=$(curl -s -X POST "$GITEA_URL/api/v1/user/repos" \
        -H "Content-Type: application/json" \
        -u "$GITEA_USER:$HARBOR_PASSWORD" \
        -d "{
            \"name\": \"$PROJECT_NAME\",
            \"private\": false,
            \"auto_init\": false
        }")
    
    if echo "$CREATE_REPO_RESPONSE" | grep -q "already exists"; then
        print_warning "Repository already exists"
    else
        print_success "Repository created"
    fi
    
    GITEA_REPO="$GITEA_USER/$PROJECT_NAME"
fi

# Step 6: Create project structure
cd "$PROJECT_PATH"

# Create .github/workflows directory
mkdir -p .github/workflows

# Create GitHub Actions workflow
print_info "Creating CI/CD workflow..."
cat > .github/workflows/deploy.yml << EOF
name: Build and Deploy

on:
  push:
    branches: [ main, master ]
    tags:
      - 'v*'

env:
  REGISTRY: $HARBOR_URL
  IMAGE_NAME: library/$PROJECT_NAME

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Harbor
        uses: docker/login-action@v2
        with:
          registry: \${{ env.REGISTRY }}
          username: $HARBOR_USER
          password: $HARBOR_PASSWORD
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=tag
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          build-args: |
            NPM_AUTH_TOKEN=\${{ secrets.NPM_AUTH_TOKEN }}
            HARBOR_URL=\${{ env.REGISTRY }}
          cache-from: type=registry,ref=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:buildcache
          cache-to: type=registry,ref=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:buildcache,mode=max
EOF

# Create Dockerfile if it doesn't exist
if [ ! -f Dockerfile ]; then
    print_info "Creating Dockerfile..."
    
    case "$PROJECT_TYPE" in
        node)
            cat > Dockerfile << 'EOF'
FROM node:18-alpine AS builder
WORKDIR /app

# Configure NPM for private registry
ARG NPM_AUTH_TOKEN
ARG HARBOR_URL=registry.gmac.io
RUN echo "@gmac:registry=https://${HARBOR_URL}/npm/" > ~/.npmrc && \
    echo "//${HARBOR_URL}/npm/:_auth=${NPM_AUTH_TOKEN}" >> ~/.npmrc && \
    echo "//${HARBOR_URL}/npm/:always-auth=true" >> ~/.npmrc && \
    echo "registry=https://registry.npmjs.org/" >> ~/.npmrc

COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE ${PORT}
CMD ["npm", "start"]
EOF
            ;;
        python)
            cat > Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt* setup.py* ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || \
    pip install --no-cache-dir . 2>/dev/null || true
COPY . .
EXPOSE ${PORT}
CMD ["python", "app.py"]
EOF
            ;;
        go)
            cat > Dockerfile << 'EOF'
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE ${PORT}
CMD ["./main"]
EOF
            ;;
        static)
            cat > Dockerfile << 'EOF'
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
EOF
            ;;
        *)
            cat > Dockerfile << 'EOF'
FROM alpine:latest
WORKDIR /app
COPY . .
EXPOSE ${PORT}
CMD ["/bin/sh"]
EOF
            ;;
    esac
    
    # Replace PORT placeholder
    sed -i.bak "s/\${PORT}/$PORT/g" Dockerfile && rm Dockerfile.bak
fi

# Create NPM configuration for Node.js projects
if [ "$PROJECT_TYPE" = "node" ]; then
    print_info "Creating NPM registry configuration..."
    
    # Create .npmrc for local development (without auth token)
    cat > .npmrc.example << 'EOF'
# Harbor NPM Registry Configuration
# Copy this to .npmrc and add your auth token

@gmac:registry=https://registry.gmac.io/npm/
registry=https://registry.npmjs.org/

# Add authentication (get token from setup-npm-registry.sh)
# //registry.gmac.io/npm/:_auth=YOUR_AUTH_TOKEN_HERE
# //registry.gmac.io/npm/:always-auth=true
EOF

    # Create npmignore if it doesn't exist
    if [ ! -f .npmignore ]; then
        cat > .npmignore << 'EOF'
# NPM Publish Ignore
.npmrc
.npmrc.*
.env*
*.log
.DS_Store
node_modules/
coverage/
.nyc_output/
*.test.js
*.spec.js
__tests__/
test/
.github/
.git/
k8s/
Dockerfile*
deploy.sh
EOF
    fi
    
    # Add NPM auth secret to Kubernetes if not already added
    if [ "$CREATE_SECRETS" = true ]; then
        # Check if we have NPM robot credentials
        if [ -f "$SCRIPT_DIR/npm-robot-credentials.env" ]; then
            source "$SCRIPT_DIR/npm-robot-credentials.env"
            kubectl patch secret "${PROJECT_NAME}-secrets" \
                -n "$NAMESPACE" \
                --type='json' \
                -p="[{\"op\": \"add\", \"path\": \"/data/NPM_AUTH_TOKEN\", \"value\": \"$(echo -n "$NPM_AUTH_TOKEN" | base64 -w 0)\"}]" 2>/dev/null || \
            print_info "NPM auth token will need to be added manually"
        fi
    fi
    
    print_info "NPM configuration created. See .npmrc.example for setup"
fi

# Create Kubernetes manifests
print_info "Creating Kubernetes manifests..."
mkdir -p k8s

# Base deployment manifest
cat > k8s/base-deployment.yaml << EOF
apiVersion: v1
kind: Namespace
metadata:
  name: $NAMESPACE
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $PROJECT_NAME
  namespace: $NAMESPACE
  labels:
    app: $PROJECT_NAME
spec:
  replicas: 2
  selector:
    matchLabels:
      app: $PROJECT_NAME
  template:
    metadata:
      labels:
        app: $PROJECT_NAME
    spec:
      imagePullSecrets:
      - name: harbor-registry
      containers:
      - name: $PROJECT_NAME
        image: $HARBOR_URL/library/$PROJECT_NAME:latest
        ports:
        - containerPort: $PORT
          name: http
        envFrom:
        - secretRef:
            name: ${PROJECT_NAME}-secrets
        env:
        - name: PORT
          value: "$PORT"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: $PORT
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /
            port: $PORT
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: $PROJECT_NAME
  namespace: $NAMESPACE
  labels:
    app: $PROJECT_NAME
spec:
  type: ClusterIP
  selector:
    app: $PROJECT_NAME
  ports:
  - port: 80
    targetPort: $PORT
    protocol: TCP
    name: http
EOF

# Production ingress
cat > k8s/production-ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${PROJECT_NAME}-production
  namespace: $NAMESPACE
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - $DOMAIN
    secretName: ${PROJECT_NAME}-tls
  rules:
  - host: $DOMAIN
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: $PROJECT_NAME
            port:
              number: 80
EOF

# Staging environment if requested
if [ "$CREATE_STAGING" = true ]; then
    cat > k8s/staging-deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${PROJECT_NAME}-staging
  namespace: $NAMESPACE
  labels:
    app: $PROJECT_NAME
    environment: staging
spec:
  replicas: 1
  selector:
    matchLabels:
      app: $PROJECT_NAME
      environment: staging
  template:
    metadata:
      labels:
        app: $PROJECT_NAME
        environment: staging
    spec:
      imagePullSecrets:
      - name: harbor-registry
      containers:
      - name: $PROJECT_NAME
        image: $HARBOR_URL/library/$PROJECT_NAME:staging
        ports:
        - containerPort: $PORT
          name: http
        envFrom:
        - secretRef:
            name: ${PROJECT_NAME}-secrets
        env:
        - name: NODE_ENV
          value: "staging"
        - name: APP_DOMAIN
          value: "$STAGING_DOMAIN"
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: ${PROJECT_NAME}-staging
  namespace: $NAMESPACE
  labels:
    app: $PROJECT_NAME
    environment: staging
spec:
  type: ClusterIP
  selector:
    app: $PROJECT_NAME
    environment: staging
  ports:
  - port: 80
    targetPort: $PORT
    protocol: TCP
    name: http
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${PROJECT_NAME}-staging
  namespace: $NAMESPACE
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - $STAGING_DOMAIN
    secretName: ${PROJECT_NAME}-staging-tls
  rules:
  - host: $STAGING_DOMAIN
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${PROJECT_NAME}-staging
            port:
              number: 80
EOF
fi

# Create ArgoCD application manifest
cat > k8s/argocd-app.yaml << EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: $PROJECT_NAME
  namespace: argocd
spec:
  project: default
  source:
    repoURL: $GITEA_URL/${GITEA_REPO}.git
    targetRevision: HEAD
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: $NAMESPACE
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
EOF

# Create deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Quick deployment script
echo "🚀 Deploying ${PROJECT_NAME}..."

# Apply Kubernetes manifests
kubectl apply -f k8s/base-deployment.yaml
kubectl apply -f k8s/production-ingress.yaml

if [ -f k8s/staging-deployment.yaml ]; then
    echo "Deploying staging environment..."
    kubectl apply -f k8s/staging-deployment.yaml
fi

# Apply ArgoCD application
kubectl apply -f k8s/argocd-app.yaml

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Push your code to trigger CI/CD: git push origin main"
echo "2. Monitor deployment: kubectl get pods -n ${NAMESPACE}"
echo "3. Check ArgoCD: https://cd.gmac.io/applications/${PROJECT_NAME}"
echo "4. Access app: https://${DOMAIN}"

if [ "${CREATE_STAGING}" = "true" ]; then
    echo "5. Staging environment: https://${STAGING_DOMAIN}"
fi
EOF

# Make deploy script executable
chmod +x deploy.sh

# Replace placeholders in deploy.sh
sed -i.bak "s/\${PROJECT_NAME}/$PROJECT_NAME/g" deploy.sh
sed -i.bak "s/\${NAMESPACE}/$NAMESPACE/g" deploy.sh
sed -i.bak "s/\${DOMAIN}/$DOMAIN/g" deploy.sh
sed -i.bak "s/\${CREATE_STAGING}/$CREATE_STAGING/g" deploy.sh
sed -i.bak "s/\${STAGING_DOMAIN}/$STAGING_DOMAIN/g" deploy.sh
rm deploy.sh.bak

# Create README with project info
cat > DEPLOYMENT.md << EOF
# $PROJECT_NAME Deployment Configuration

This project has been configured for deployment to the gmac.io Kubernetes cluster.

## Configuration

- **Project Name**: $PROJECT_NAME
- **Namespace**: $NAMESPACE
- **Domain**: $DOMAIN
- **Port**: $PORT
- **Registry**: $HARBOR_URL/library/$PROJECT_NAME
EOF

if [ "$CREATE_STAGING" = true ]; then
    cat >> DEPLOYMENT.md << EOF
- **Staging Domain**: $STAGING_DOMAIN
EOF
fi

if [ "$CREATE_TURSO_DB" = true ] && [ -n "$TURSO_DB_URL" ]; then
    cat >> DEPLOYMENT.md << EOF

## Database

- **Turso Database**: $DB_NAME
- **Connection**: Available via \`TURSO_DATABASE_URL\` and \`TURSO_AUTH_TOKEN\` environment variables
EOF
fi

cat >> DEPLOYMENT.md << EOF

## Quick Deploy

\`\`\`bash
# Deploy to cluster
./deploy.sh

# Or use ArgoCD (recommended)
kubectl apply -f k8s/argocd-app.yaml
\`\`\`

## Manual Deployment

\`\`\`bash
# Build and push image
docker build -t $HARBOR_URL/library/$PROJECT_NAME:latest .
docker push $HARBOR_URL/library/$PROJECT_NAME:latest

# Apply manifests
kubectl apply -f k8s/
\`\`\`

## Secrets

The following secrets are configured:
- \`harbor-registry\`: Docker registry credentials
- \`${PROJECT_NAME}-secrets\`: Application secrets
EOF

if [ "$CREATE_TURSO_DB" = true ]; then
    cat >> DEPLOYMENT.md << EOF
  - \`TURSO_DATABASE_URL\`: Database connection URL
  - \`TURSO_AUTH_TOKEN\`: Database auth token
EOF
fi

cat >> DEPLOYMENT.md << EOF

## CI/CD

Push to the main branch to trigger automatic deployment:
\`\`\`bash
git add .
git commit -m "Initial deployment"
git push origin main
\`\`\`

## Monitoring

- ArgoCD: https://cd.gmac.io/applications/$PROJECT_NAME
- Application: https://$DOMAIN
EOF

if [ "$CREATE_STAGING" = true ]; then
    cat >> DEPLOYMENT.md << EOF
- Staging: https://$STAGING_DOMAIN
EOF
fi

# Initialize git if needed and add remote
if [ "$SKIP_GIT" = false ]; then
    if [ ! -d .git ]; then
        print_info "Initializing git repository..."
        git init
        git add .
        git commit -m "Initial commit with deployment configuration" || true
    fi
    
    # Add Gitea remote
    git remote remove origin 2>/dev/null || true
    git remote add origin "$GITEA_URL/${GITEA_REPO}.git"
    
    print_info "Git remote configured: $GITEA_URL/${GITEA_REPO}.git"
fi

# Apply ArgoCD application
print_info "Creating ArgoCD application..."
kubectl apply -f k8s/argocd-app.yaml

print_success "✅ Project setup complete!"
echo
print_info "📋 Summary:"
print_info "  - Kubernetes namespace created: $NAMESPACE"
print_info "  - Secrets configured"
if [ "$CREATE_TURSO_DB" = true ] && [ -n "$TURSO_DB_URL" ]; then
    print_info "  - Turso database created: $DB_NAME"
fi
print_info "  - CI/CD workflow configured"
print_info "  - Kubernetes manifests created"
print_info "  - ArgoCD application configured"
echo
print_info "🚀 Next Steps:"
echo "  1. Review and customize the generated files"
echo "  2. Push to Gitea: git push -u origin main"
echo "  3. Monitor deployment: kubectl get pods -n $NAMESPACE -w"
echo "  4. Access application: https://$DOMAIN"
if [ "$CREATE_STAGING" = true ]; then
    echo "  5. Staging environment: https://$STAGING_DOMAIN"
fi
echo
print_info "📚 Documentation: See DEPLOYMENT.md for details"