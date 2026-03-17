# Traefik Migration Plan: Hetzner K3s Production Cluster

**Date:** 2026-03-16
**Cluster:** Hetzner K3s production (`~/.kube/config-hetzner`, API `https://5.78.106.236:6443`)
**Nodes:** k3s-master-1 (control plane), k3s-worker-1
**Current state:** nginx-ingress controller, 35 ingresses, cert-manager with letsencrypt-prod ClusterIssuer
**Target state:** Traefik ingress controller (K3s built-in), same cert-manager setup

---

## Table of Contents

1. [Pre-Migration Audit](#1-pre-migration-audit)
2. [Phase 1: Enable Traefik Alongside Nginx](#2-phase-1-enable-traefik-alongside-nginx)
3. [Phase 2: Create Traefik Middleware CRDs](#3-phase-2-create-traefik-middleware-crds)
4. [Phase 3: Migrate Simple Ingresses](#4-phase-3-migrate-simple-ingresses)
5. [Phase 4: Migrate Medium-Complexity Ingresses](#5-phase-4-migrate-medium-complexity-ingresses)
6. [Phase 5: Migrate Complex Ingresses](#6-phase-5-migrate-complex-ingresses)
7. [Phase 6: Migrate Harbor Ingress](#7-phase-6-migrate-harbor-ingress)
8. [Phase 7: Cleanup and Remove Nginx](#8-phase-7-cleanup-and-remove-nginx)
9. [Annotation Conversion Reference](#9-annotation-conversion-reference)
10. [Generic App Helm Chart Update](#10-generic-app-helm-chart-update)

---

## 1. Pre-Migration Audit

### 1.1 Export current ingress inventory

```bash
# SSH into k3s-master-1
ssh root@5.78.106.236

# List all ingresses across all namespaces
kubectl get ingress -A -o wide

# Export full ingress specs for reference/rollback
kubectl get ingress -A -o yaml > /root/backup-ingresses-$(date +%Y%m%d).yaml

# List all nginx-ingress annotations in use
kubectl get ingress -A -o json | jq -r '.items[].metadata.annotations // {} | keys[] | select(startswith("nginx"))' | sort -u

# Check current nginx-ingress controller version and config
kubectl get pods -n ingress-nginx -o wide
kubectl get configmap -n ingress-nginx nginx-ingress-controller -o yaml

# Verify cert-manager is healthy
kubectl get clusterissuer letsencrypt-prod -o yaml
kubectl get certificates -A
```

### 1.2 Verify the `--disable=traefik` flag

```bash
# On k3s-master-1
cat /etc/systemd/system/k3s.service | grep disable
# Expected output includes: --disable=traefik

# Also check for any k3s config file overrides
cat /etc/rancher/k3s/config.yaml 2>/dev/null || echo "No config.yaml found"
```

### 1.3 Document current ingress classification

Group all 35 ingresses by complexity tier before starting:

| Tier | Count | Description | Examples |
|------|-------|-------------|----------|
| Simple | ~12 | No special annotations beyond ssl-redirect and cert-manager | test-app, demo-app, npm-registry, static sites |
| Medium | ~10 | proxy-body-size, timeouts, backend-protocol | control-panel, control-panel-webhooks, API services |
| Complex (OAuth2) | ~6 | OAuth2 proxy forward auth | ArgoCD, K8s dashboard, Longhorn, Grafana, Prometheus, Alertmanager |
| Complex (Sessions) | ~3 | Session affinity / sticky cookies | habit, linear-clone, playpath |
| Complex (Headers/CORS) | ~2 | configuration-snippet, CORS | turntable-bot, habit |
| Complex (SSE/WS) | ~1 | proxy-buffering off, websockets | linear-clone, canvas |
| Critical | ~1 | Harbor registry | harbor (core + notary) |

---

## 2. Phase 1: Enable Traefik Alongside Nginx

**Goal:** Run both ingress controllers simultaneously so nginx continues serving all traffic while we test Traefik.

### 2.1 Remove the `--disable=traefik` flag from K3s

```bash
# On k3s-master-1
ssh root@5.78.106.236

# Edit the systemd unit
sudo vi /etc/systemd/system/k3s.service
# Remove '--disable=traefik' from the ExecStart line
# If using config.yaml instead:
# sudo vi /etc/rancher/k3s/config.yaml
# Remove the 'disable: traefik' line

# Reload and restart K3s
sudo systemctl daemon-reload
sudo systemctl restart k3s

# Wait for Traefik to come up (K3s deploys it as a HelmChart resource)
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik --watch
```

### 2.2 Verify Traefik is running but not conflicting

```bash
# Traefik should be running
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik
kubectl get svc -n kube-system traefik

# IMPORTANT: Traefik and nginx will both try to bind ports 80/443.
# Since nginx is already using a LoadBalancer or HostPort, we need to
# ensure Traefik uses a different port initially or only watches its own IngressClass.

# Check how nginx is exposed
kubectl get svc -n ingress-nginx

# If nginx uses LoadBalancer, Traefik's default LoadBalancer service will get
# a separate IP. If nginx uses HostPort/NodePort, there will be a port conflict.
```

### 2.3 Configure Traefik to only watch `ingressClassName: traefik`

K3s deploys Traefik via a HelmChart CRD. Override its values:

```bash
# Edit the K3s Traefik HelmChartConfig
cat <<'EOF' | kubectl apply -f -
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    providers:
      kubernetesIngress:
        ingressClass: traefik
        publishedService:
          enabled: true
    # Ensure Traefik does NOT set itself as default IngressClass
    ingressClass:
      enabled: true
      isDefaultClass: false
    # Enable CRD provider for Middleware, IngressRoute, etc.
    providers:
      kubernetesCRD:
        enabled: true
        allowCrossNamespace: true
    # Match nginx's entrypoint ports
    ports:
      web:
        port: 8000
        exposedPort: 80
        protocol: TCP
      websecure:
        port: 8443
        exposedPort: 443
        protocol: TCP
    # Redirect HTTP to HTTPS by default
    ports:
      web:
        redirectTo:
          port: websecure
    # Enable access logs for debugging during migration
    logs:
      access:
        enabled: true
EOF
```

### 2.4 Update cert-manager ClusterIssuer for Traefik

The current ClusterIssuer references `class: nginx` for ACME HTTP-01 challenges. We need a second solver (or update it later when nginx is removed).

```bash
# Create a Traefik-compatible ClusterIssuer alongside the existing one
cat <<'EOF' | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod-traefik
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: gmackie@gmail.com
    privateKeySecretRef:
      name: letsencrypt-prod-traefik-account-key
    solvers:
    - http01:
        ingress:
          class: traefik
EOF
```

### 2.5 Smoke test Traefik with a throwaway ingress

```bash
# Deploy a test service
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: traefik-test
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo
  namespace: traefik-test
spec:
  replicas: 1
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
      - name: echo
        image: hashicorp/http-echo:0.2.3
        args: ["-text=traefik-works"]
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: echo
  namespace: traefik-test
spec:
  selector:
    app: echo
  ports:
  - port: 80
    targetPort: 5678
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo
  namespace: traefik-test
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - echo-test.gmac.io
    secretName: echo-test-tls
  rules:
  - host: echo-test.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: echo
            port:
              number: 80
EOF

# Point echo-test.gmac.io DNS to the Traefik LoadBalancer IP
kubectl get svc -n kube-system traefik -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Test
curl -v https://echo-test.gmac.io
# Should return "traefik-works" with valid TLS cert
```

### 2.6 Verification checklist

- [ ] Traefik pods running in kube-system
- [ ] Traefik LoadBalancer service has an external IP
- [ ] Traefik only watches `ingressClassName: traefik` (not processing nginx ingresses)
- [ ] All existing nginx ingresses still working (no disruption)
- [ ] cert-manager can issue certs via Traefik for the test ingress
- [ ] Test ingress returns correct response with valid TLS

### 2.7 Rollback

```bash
# If Traefik causes issues, re-disable it:
# Add --disable=traefik back to /etc/systemd/system/k3s.service
sudo systemctl daemon-reload
sudo systemctl restart k3s
# Traefik pods and resources will be removed automatically
```

---

## 3. Phase 2: Create Traefik Middleware CRDs

**Goal:** Pre-create all Middleware CRDs that will be referenced by migrated ingresses.

### 3.1 Security Headers Middleware

Replaces: `nginx.ingress.kubernetes.io/configuration-snippet` with security headers (used by control-panel).

```yaml
# File: k8s/traefik/middleware-security-headers.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: security-headers
  namespace: control-panel
spec:
  headers:
    frameDeny: true
    contentTypeNosniff: true
    browserXssFilter: true
    referrerPolicy: "strict-origin-when-cross-origin"
    stsSeconds: 63072000
    stsIncludeSubdomains: true
    stsPreload: true
    customResponseHeaders:
      X-XSS-Protection: "1; mode=block"
```

### 3.2 Body Size Limit Middlewares

Replaces: `nginx.ingress.kubernetes.io/proxy-body-size`.

```yaml
# File: k8s/traefik/middleware-body-size.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: body-size-10m
  namespace: default
spec:
  buffering:
    maxRequestBodyBytes: 10485760  # 10MB
---
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: body-size-50m
  namespace: default
spec:
  buffering:
    maxRequestBodyBytes: 52428800  # 50MB
---
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: body-size-100m
  namespace: default
spec:
  buffering:
    maxRequestBodyBytes: 104857600  # 100MB
```

> **Note:** Create these in each namespace that needs them, or enable `allowCrossNamespace` in Traefik config (done in Phase 1) and reference as `<namespace>-<name>@kubernetescrd`.

### 3.3 OAuth2 ForwardAuth Middleware

Replaces: nginx `auth-url` / `auth-signin` annotations for OAuth2 proxy.

```yaml
# File: k8s/traefik/middleware-oauth2-forward-auth.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: oauth2-forward-auth
  namespace: oauth2-proxy   # namespace where oauth2-proxy runs
spec:
  forwardAuth:
    address: http://oauth2-proxy.oauth2-proxy.svc.cluster.local:4180/oauth2/auth
    trustForwardHeader: true
    authResponseHeaders:
      - X-Auth-Request-User
      - X-Auth-Request-Email
      - X-Auth-Request-Groups
      - X-Auth-Request-Access-Token
      - Authorization
```

### 3.4 Rate Limiting Middleware

Replaces: `nginx.ingress.kubernetes.io/rate-limit`.

```yaml
# File: k8s/traefik/middleware-rate-limit.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: rate-limit-100
  namespace: control-panel
spec:
  rateLimit:
    average: 100
    period: 1m
    burst: 150
```

### 3.5 CORS Middleware

Replaces: nginx CORS `configuration-snippet` (used by turntable-bot).

```yaml
# File: k8s/traefik/middleware-cors.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: cors-permissive
  namespace: turntable-bot
spec:
  headers:
    accessControlAllowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
    accessControlAllowHeaders:
      - Content-Type
      - Authorization
      - X-Requested-With
    accessControlAllowOriginList:
      - "*"
    accessControlMaxAge: 86400
    addVaryHeader: true
```

### 3.6 Sticky Sessions Middleware

Replaces: `nginx.ingress.kubernetes.io/affinity: cookie` / `session-cookie-*` annotations.

Traefik handles sticky sessions at the service level, not via Middleware CRD. Instead, you configure it via `traefik.ingress.kubernetes.io/service.sticky.cookie` annotations on the Ingress, or use an IngressRoute with weighted round-robin.

```yaml
# For Ingress resources, use these annotations:
# traefik.ingress.kubernetes.io/service.sticky.cookie: "true"
# traefik.ingress.kubernetes.io/service.sticky.cookie.name: "app_session"
# traefik.ingress.kubernetes.io/service.sticky.cookie.secure: "true"
# traefik.ingress.kubernetes.io/service.sticky.cookie.httponly: "true"
# traefik.ingress.kubernetes.io/service.sticky.cookie.samesite: "lax"
```

### 3.7 SSE / Buffering-Off Middleware

Replaces: `nginx.ingress.kubernetes.io/proxy-buffering: "off"` for Server-Sent Events (linear-clone).

```yaml
# File: k8s/traefik/middleware-no-buffering.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: no-buffering
  namespace: linear-clone
spec:
  buffering:
    maxRequestBodyBytes: 10485760
    memRequestBodyBytes: 2097152
    maxResponseBodyBytes: 0        # 0 = unlimited (streaming)
    memResponseBodyBytes: 2097152
    retryExpression: ""
```

> **Note:** For true streaming (SSE), you may also need to set `flushInterval` on the Traefik `ServersTransport`. By default Traefik streams responses when `Content-Type: text/event-stream` is detected, so this middleware may not be needed. Test without it first.

### 3.8 Apply all middleware CRDs

```bash
kubectl apply -f k8s/traefik/middleware-security-headers.yaml
kubectl apply -f k8s/traefik/middleware-body-size.yaml
kubectl apply -f k8s/traefik/middleware-oauth2-forward-auth.yaml
kubectl apply -f k8s/traefik/middleware-rate-limit.yaml
kubectl apply -f k8s/traefik/middleware-cors.yaml
kubectl apply -f k8s/traefik/middleware-no-buffering.yaml

# Verify all middlewares are created
kubectl get middlewares -A
```

### 3.9 Verification checklist

- [ ] All Middleware CRDs created successfully (`kubectl get middlewares -A`)
- [ ] No errors in Traefik logs related to middleware parsing
- [ ] Existing nginx ingresses unaffected

### 3.10 Rollback

Middleware CRDs are inert until referenced. Simply delete them if needed:

```bash
kubectl delete middlewares --all -A
```

---

## 4. Phase 3: Migrate Simple Ingresses

**Goal:** Migrate ingresses that only use `ingressClassName: nginx` with `ssl-redirect: true` and `cert-manager.io/cluster-issuer`.

### 4.1 Identify simple ingresses

These are ingresses deployed via the generic-app Helm chart with default annotations, and any manually-created ingresses with only basic TLS. Expected list:

- test-app
- demo-app
- npm-registry
- simple static sites
- any chart-deployed app with default `values.yaml`

```bash
# Find ingresses with ONLY cert-manager and ssl-redirect annotations
kubectl get ingress -A -o json | jq -r '
  .items[] |
  select(
    ([.metadata.annotations // {} | keys[] | select(startswith("nginx"))] | length) <= 1
  ) |
  "\(.metadata.namespace)/\(.metadata.name)"
'
```

### 4.2 Conversion pattern for simple ingresses

**Before (nginx):**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  namespace: my-app
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - my-app.gmac.io
    secretName: my-app-tls
  rules:
  - host: my-app.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-app
            port:
              number: 80
```

**After (Traefik):**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  namespace: my-app
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
    # ssl-redirect is automatic in Traefik when TLS is configured
    # (web entrypoint redirects to websecure via HelmChartConfig)
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - my-app.gmac.io
    secretName: my-app-tls
  rules:
  - host: my-app.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-app
            port:
              number: 80
```

**Changes:**
1. `ingressClassName: nginx` -> `ingressClassName: traefik`
2. Remove `nginx.ingress.kubernetes.io/ssl-redirect: "true"` (Traefik does this automatically)
3. `cert-manager.io/cluster-issuer: letsencrypt-prod` -> `cert-manager.io/cluster-issuer: letsencrypt-prod-traefik`

### 4.3 Migration command pattern

For each simple ingress, the migration is a single `kubectl patch`:

```bash
# Template for each simple ingress
NAMESPACE="my-app"
INGRESS_NAME="my-app"

# Step 1: Patch ingressClassName and annotations
kubectl patch ingress "$INGRESS_NAME" -n "$NAMESPACE" --type=json -p='[
  {"op": "replace", "path": "/spec/ingressClassName", "value": "traefik"},
  {"op": "remove", "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1ssl-redirect"},
  {"op": "replace", "path": "/metadata/annotations/cert-manager.io~1cluster-issuer", "value": "letsencrypt-prod-traefik"}
]'

# Step 2: Verify
kubectl get ingress "$INGRESS_NAME" -n "$NAMESPACE" -o yaml
curl -sI "https://${INGRESS_NAME}.gmac.io" | head -5

# Step 3: If broken, rollback immediately
kubectl patch ingress "$INGRESS_NAME" -n "$NAMESPACE" --type=json -p='[
  {"op": "replace", "path": "/spec/ingressClassName", "value": "nginx"},
  {"op": "add", "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1ssl-redirect", "value": "true"},
  {"op": "replace", "path": "/metadata/annotations/cert-manager.io~1cluster-issuer", "value": "letsencrypt-prod"}
]'
```

### 4.4 For Helm-deployed apps (generic-app-chart)

Update the Helm values to use Traefik:

```yaml
# values-traefik.yaml override for each app
ingress:
  className: "traefik"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
    # Remove all nginx.ingress.kubernetes.io/* annotations
```

```bash
# Upgrade each Helm release
helm upgrade my-app ./deployment-system/generic-app-chart \
  -n my-app \
  -f values.yaml \
  -f values-traefik.yaml
```

### 4.5 Verification checklist

For each migrated ingress:

- [ ] `curl -sI https://<host>` returns HTTP 200 with valid TLS
- [ ] `curl -sI http://<host>` returns HTTP 301/302 redirect to HTTPS
- [ ] Certificate is valid (check `curl -v` output for cert details)
- [ ] Application functions correctly (not just the index page)

### 4.6 Rollback

Per-ingress rollback (patch back to nginx) shown above. For Helm-deployed apps:

```bash
helm upgrade my-app ./deployment-system/generic-app-chart \
  -n my-app \
  -f values.yaml  # original values with className: nginx
```

---

## 5. Phase 4: Migrate Medium-Complexity Ingresses

**Goal:** Migrate ingresses with proxy timeouts, body size limits, and backend protocol annotations.

### 5.1 Ingresses in this tier

| Ingress | Namespace | Nginx Annotations |
|---------|-----------|-------------------|
| control-panel-ingress | control-panel | ssl-redirect, force-ssl-redirect, proxy-body-size: 10m, proxy-*-timeout: 60, configuration-snippet (security headers), rate-limit: 100 |
| control-panel (deployment) | control-panel | ssl-redirect, proxy-body-size: 50m, proxy-read-timeout: 300, proxy-connect-timeout: 300 |
| control-panel-webhooks | control-panel | proxy-body-size: 10m, proxy-read-timeout: 600, proxy-send-timeout: 600 |
| control-panel-internal | control-panel | ssl-redirect: false, proxy-body-size: 10m |
| Any app with `backend-protocol: HTTPS` | various | backend-protocol: HTTPS |

### 5.2 Control Panel Ingress (main)

**Before (nginx):**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: control-panel-ingress
  namespace: control-panel
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-XSS-Protection: 1; mode=block";
      more_set_headers "Referrer-Policy: strict-origin-when-cross-origin";
      more_set_headers "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload";
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - control.gmac.io
    secretName: control-panel-tls
  rules:
  - host: control.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: control-panel-service
            port:
              number: 80
```

**After (Traefik):**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: control-panel-ingress
  namespace: control-panel
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod-traefik"
    # Reference middlewares: <namespace>-<name>@kubernetescrd
    traefik.ingress.kubernetes.io/router.middlewares: >-
      control-panel-security-headers@kubernetescrd,
      control-panel-rate-limit-100@kubernetescrd,
      control-panel-body-size-10m@kubernetescrd
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - control.gmac.io
    secretName: control-panel-tls
  rules:
  - host: control.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: control-panel-service
            port:
              number: 80
```

Create the namespace-local middleware copies:

```yaml
# File: k8s/traefik/control-panel-middlewares.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: body-size-10m
  namespace: control-panel
spec:
  buffering:
    maxRequestBodyBytes: 10485760
---
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: body-size-50m
  namespace: control-panel
spec:
  buffering:
    maxRequestBodyBytes: 52428800
```

**Notes:**
- `proxy-*-timeout` annotations: Traefik uses default timeouts of 30s. For custom timeouts, use a `ServersTransport`:

```yaml
# File: k8s/traefik/servers-transport-long-timeout.yaml
apiVersion: traefik.io/v1alpha1
kind: ServersTransport
metadata:
  name: long-timeout
  namespace: control-panel
spec:
  forwardingTimeouts:
    dialTimeout: 60s
    responseHeaderTimeout: 60s
    idleConnTimeout: 90s
```

Then reference on the ingress:

```yaml
traefik.ingress.kubernetes.io/service.serversTransport: control-panel-long-timeout@kubernetescrd
```

### 5.3 Control Panel Webhooks Ingress

**After (Traefik):**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: control-panel-webhooks
  namespace: control-panel
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: >-
      control-panel-body-size-10m@kubernetescrd
    traefik.ingress.kubernetes.io/service.serversTransport: >-
      control-panel-webhook-timeout@kubernetescrd
spec:
  ingressClassName: traefik
  rules:
  - host: control.gmac.io
    http:
      paths:
      - path: /api/webhooks
        pathType: Prefix
        backend:
          service:
            name: control-panel-webhooks
            port:
              number: 8080
```

With corresponding ServersTransport:

```yaml
apiVersion: traefik.io/v1alpha1
kind: ServersTransport
metadata:
  name: webhook-timeout
  namespace: control-panel
spec:
  forwardingTimeouts:
    dialTimeout: 30s
    responseHeaderTimeout: 600s
    idleConnTimeout: 600s
```

### 5.4 Control Panel Internal Ingress (no TLS)

**After (Traefik):**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: control-panel-internal-ingress
  namespace: control-panel
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: >-
      control-panel-body-size-10m@kubernetescrd
    # Disable HTTPS redirect for internal access
    traefik.ingress.kubernetes.io/router.entrypoints: web
spec:
  ingressClassName: traefik
  rules:
  - host: control-panel.internal
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: control-panel-service
            port:
              number: 80
```

### 5.5 Backend Protocol HTTPS

For any ingress using `nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"`:

**Before:**
```yaml
nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
```

**After:**
```yaml
traefik.ingress.kubernetes.io/service.serversscheme: https
```

### 5.6 Migration commands

```bash
# Apply control-panel middlewares and ServersTransports first
kubectl apply -f k8s/traefik/control-panel-middlewares.yaml
kubectl apply -f k8s/traefik/servers-transport-long-timeout.yaml

# Migrate control-panel-ingress
kubectl apply -f k8s/traefik/control-panel-ingress-traefik.yaml

# Verify
curl -sI https://control.gmac.io
curl -sI http://control.gmac.io  # should redirect to HTTPS

# Migrate control-panel-webhooks
kubectl apply -f k8s/traefik/control-panel-webhooks-traefik.yaml

# Verify webhooks endpoint
curl -s -X POST https://control.gmac.io/api/webhooks/health

# Migrate internal ingress
kubectl apply -f k8s/traefik/control-panel-internal-traefik.yaml
```

### 5.7 Verification checklist

- [ ] Security headers present in response (`curl -sI https://control.gmac.io | grep -i "x-frame-options"`)
- [ ] Rate limiting functional (send >100 requests in 1 minute, expect 429)
- [ ] Webhook endpoint accepts large payloads up to 10MB
- [ ] Webhook endpoint does not time out for long-running requests (up to 600s)
- [ ] Internal ingress accessible without TLS
- [ ] All backend-protocol: HTTPS services still reachable

### 5.8 Rollback

```bash
# Re-apply the original nginx ingress manifests from backup
kubectl apply -f /root/backup-ingresses-YYYYMMDD.yaml
# Or patch each one individually back to ingressClassName: nginx
```

---

## 6. Phase 5: Migrate Complex Ingresses

### 6.1 OAuth2 Forward Auth Ingresses

**Services:** ArgoCD, Kubernetes Dashboard, Longhorn UI, Grafana, Prometheus, Alertmanager

**Before (nginx):**

```yaml
annotations:
  nginx.ingress.kubernetes.io/auth-url: "https://auth.gmac.io/oauth2/auth"
  nginx.ingress.kubernetes.io/auth-signin: "https://auth.gmac.io/oauth2/start?rd=$escaped_request_uri"
  nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User, X-Auth-Request-Email"
```

**After (Traefik):**

```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
  traefik.ingress.kubernetes.io/router.middlewares: >-
    oauth2-proxy-oauth2-forward-auth@kubernetescrd
spec:
  ingressClassName: traefik
```

The ForwardAuth middleware (created in Phase 2, section 3.3) handles everything. The key mapping:

| nginx annotation | Traefik ForwardAuth field |
|------------------|--------------------------|
| `auth-url` | `address` |
| `auth-response-headers` | `authResponseHeaders` |
| `auth-signin` | Handled by oauth2-proxy itself (redirects on 401) |

#### ArgoCD Ingress

ArgoCD often needs `backend-protocol: HTTPS` and `ssl-passthrough`:

**Before:**
```yaml
annotations:
  nginx.ingress.kubernetes.io/ssl-passthrough: "true"
  nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
```

**After (using IngressRouteTCP for ssl-passthrough):**

```yaml
# ArgoCD requires IngressRouteTCP for SSL passthrough
apiVersion: traefik.io/v1alpha1
kind: IngressRouteTCP
metadata:
  name: argocd-server
  namespace: argocd
spec:
  entryPoints:
    - websecure
  routes:
  - match: HostSNI(`argocd.gmac.io`)
    services:
    - name: argocd-server
      port: 443
  tls:
    passthrough: true
```

If ArgoCD does NOT need ssl-passthrough (just backend HTTPS + OAuth2):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server
  namespace: argocd
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
    traefik.ingress.kubernetes.io/service.serversscheme: https
    traefik.ingress.kubernetes.io/router.middlewares: >-
      oauth2-proxy-oauth2-forward-auth@kubernetescrd
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - argocd.gmac.io
    secretName: argocd-tls
  rules:
  - host: argocd.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 443
```

#### Kubernetes Dashboard, Longhorn, Grafana, Prometheus, Alertmanager

All follow the same pattern -- replace nginx auth annotations with the ForwardAuth middleware reference:

```bash
# For each OAuth2-protected ingress:
for ITEM in \
  "kubernetes-dashboard/kubernetes-dashboard" \
  "longhorn-system/longhorn-ingress" \
  "monitoring/grafana" \
  "monitoring/prometheus" \
  "monitoring/alertmanager"; do

  NS=$(echo $ITEM | cut -d/ -f1)
  NAME=$(echo $ITEM | cut -d/ -f2)

  kubectl patch ingress "$NAME" -n "$NS" --type=json -p='[
    {"op": "replace", "path": "/spec/ingressClassName", "value": "traefik"},
    {"op": "remove", "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1auth-url"},
    {"op": "remove", "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1auth-signin"},
    {"op": "remove", "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1auth-response-headers"},
    {"op": "add", "path": "/metadata/annotations/traefik.ingress.kubernetes.io~1router.middlewares", "value": "oauth2-proxy-oauth2-forward-auth@kubernetescrd"},
    {"op": "replace", "path": "/metadata/annotations/cert-manager.io~1cluster-issuer", "value": "letsencrypt-prod-traefik"}
  ]'

  echo "Migrated $NS/$NAME. Testing..."
  HOST=$(kubectl get ingress "$NAME" -n "$NS" -o jsonpath='{.spec.rules[0].host}')
  curl -sI "https://$HOST" | head -5
  echo "---"
done
```

### 6.2 Session Affinity / Sticky Sessions

**Services:** habit, linear-clone, playpath

**Before (nginx):**

```yaml
annotations:
  nginx.ingress.kubernetes.io/affinity: "cookie"
  nginx.ingress.kubernetes.io/session-cookie-name: "SERVERID"
  nginx.ingress.kubernetes.io/session-cookie-max-age: "172800"
  nginx.ingress.kubernetes.io/session-cookie-change-on-failure: "true"
```

**After (Traefik):**

```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
  traefik.ingress.kubernetes.io/service.sticky.cookie: "true"
  traefik.ingress.kubernetes.io/service.sticky.cookie.name: "SERVERID"
  traefik.ingress.kubernetes.io/service.sticky.cookie.secure: "true"
  traefik.ingress.kubernetes.io/service.sticky.cookie.httpOnly: "true"
  traefik.ingress.kubernetes.io/service.sticky.cookie.sameSite: "lax"
spec:
  ingressClassName: traefik
```

> **Note:** Traefik does not have a direct equivalent of `session-cookie-max-age`. The cookie is a session cookie by default. If you need max-age, use an IngressRoute with a weighted service that specifies cookie options.

#### Example: habit ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: habit
  namespace: habit
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
    traefik.ingress.kubernetes.io/service.sticky.cookie: "true"
    traefik.ingress.kubernetes.io/service.sticky.cookie.name: "SERVERID"
    traefik.ingress.kubernetes.io/service.sticky.cookie.secure: "true"
    traefik.ingress.kubernetes.io/service.sticky.cookie.httpOnly: "true"
    # Also needs X-Forwarded-Proto header (was in configuration-snippet)
    traefik.ingress.kubernetes.io/router.middlewares: >-
      habit-forwarded-proto@kubernetescrd
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - habit.gmac.io
    secretName: habit-tls
  rules:
  - host: habit.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: habit
            port:
              number: 80
```

With middleware for X-Forwarded-Proto:

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: forwarded-proto
  namespace: habit
spec:
  headers:
    customRequestHeaders:
      X-Forwarded-Proto: "https"
```

### 6.3 CORS Headers (turntable-bot)

**Before (nginx):**

```yaml
annotations:
  nginx.ingress.kubernetes.io/enable-cors: "true"
  nginx.ingress.kubernetes.io/cors-allow-origin: "*"
  nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
  nginx.ingress.kubernetes.io/cors-allow-headers: "Content-Type, Authorization"
  # OR via configuration-snippet:
  nginx.ingress.kubernetes.io/configuration-snippet: |
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization";
```

**After (Traefik):**

```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
  traefik.ingress.kubernetes.io/router.middlewares: >-
    turntable-bot-cors-permissive@kubernetescrd
spec:
  ingressClassName: traefik
```

The `cors-permissive` middleware was created in Phase 2 (section 3.5).

### 6.4 SSE / Proxy Buffering Off (linear-clone)

**Before (nginx):**

```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-buffering: "off"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
```

**After (Traefik):**

Traefik streams responses by default when `Content-Type: text/event-stream` is detected. No special annotation is typically needed. However, you may want a long timeout ServersTransport:

```yaml
apiVersion: traefik.io/v1alpha1
kind: ServersTransport
metadata:
  name: sse-transport
  namespace: linear-clone
spec:
  forwardingTimeouts:
    dialTimeout: 30s
    responseHeaderTimeout: 0s   # 0 = no timeout (streaming)
    idleConnTimeout: 3600s
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: linear-clone
  namespace: linear-clone
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
    traefik.ingress.kubernetes.io/service.serversTransport: >-
      linear-clone-sse-transport@kubernetescrd
    traefik.ingress.kubernetes.io/service.sticky.cookie: "true"
    traefik.ingress.kubernetes.io/service.sticky.cookie.name: "SERVERID"
    traefik.ingress.kubernetes.io/service.sticky.cookie.secure: "true"
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - linear-clone.gmac.io
    secretName: linear-clone-tls
  rules:
  - host: linear-clone.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: linear-clone
            port:
              number: 80
```

### 6.5 WebSocket Services (canvas)

**Before (nginx):**

```yaml
annotations:
  nginx.ingress.kubernetes.io/websocket-services: "canvas"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

**After (Traefik):**

Traefik handles WebSocket upgrade automatically. No special annotation needed. Just ensure timeouts are sufficient:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: canvas
  namespace: canvas
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
    traefik.ingress.kubernetes.io/service.serversTransport: >-
      canvas-ws-transport@kubernetescrd
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - canvas.gmac.io
    secretName: canvas-tls
  rules:
  - host: canvas.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: canvas
            port:
              number: 80
```

```yaml
apiVersion: traefik.io/v1alpha1
kind: ServersTransport
metadata:
  name: ws-transport
  namespace: canvas
spec:
  forwardingTimeouts:
    dialTimeout: 30s
    responseHeaderTimeout: 0s
    idleConnTimeout: 3600s
```

### 6.6 Verification checklist

- [ ] **OAuth2 services:** Navigate to each URL in browser, get redirected to OAuth2 login, authenticate, access the service
- [ ] **Sticky sessions:** Open multiple browser tabs, verify they hit the same backend pod (check response headers or logs)
- [ ] **CORS:** `curl -H "Origin: https://example.com" -I https://turntable-bot.gmac.io` returns correct CORS headers
- [ ] **SSE:** Open SSE endpoint in browser, verify events stream without buffering delays
- [ ] **WebSocket:** Open canvas, verify real-time collaboration works

### 6.7 Rollback

Per-ingress: patch `ingressClassName` back to `nginx` and restore original annotations from backup.

```bash
# Quick rollback for any single ingress
NS="linear-clone"
NAME="linear-clone"
kubectl get ingress "$NAME" -n "$NS" -o yaml > /tmp/traefik-version.yaml
kubectl apply -f /root/backup-ingresses-YYYYMMDD.yaml -l "metadata.name=$NAME"
# Or manually patch back
```

---

## 7. Phase 6: Migrate Harbor Ingress

**Goal:** Migrate the Harbor container registry ingress with zero downtime. This is the most critical migration step because a broken registry blocks all deployments.

### 7.1 Pre-migration checks

```bash
# Verify Harbor is healthy
kubectl get pods -n harbor
curl -s https://harbor.gmac.io/api/v2.0/health | jq .

# Document current Harbor ingress
kubectl get ingress -n harbor -o yaml > /root/backup-harbor-ingress.yaml

# Test a docker pull to establish baseline
docker pull harbor.gmac.io/library/test-image:latest
```

### 7.2 Harbor ingress conversion

Harbor typically has two ingresses: core and notary (if enabled).

**Before (nginx) -- Harbor Core:**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-ingress
  namespace: harbor
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "0"  # unlimited for image pushes
    nginx.ingress.kubernetes.io/proxy-read-timeout: "900"
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - harbor.gmac.io
    secretName: harbor-tls
  rules:
  - host: harbor.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: harbor-core
            port:
              number: 80
```

**After (Traefik) -- Harbor Core:**

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: harbor-body-unlimited
  namespace: harbor
spec:
  buffering:
    maxRequestBodyBytes: 0  # 0 = unlimited
    maxResponseBodyBytes: 0
---
apiVersion: traefik.io/v1alpha1
kind: ServersTransport
metadata:
  name: harbor-transport
  namespace: harbor
spec:
  forwardingTimeouts:
    dialTimeout: 30s
    responseHeaderTimeout: 900s
    idleConnTimeout: 900s
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-ingress
  namespace: harbor
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik
    traefik.ingress.kubernetes.io/router.middlewares: >-
      harbor-harbor-body-unlimited@kubernetescrd
    traefik.ingress.kubernetes.io/service.serversTransport: >-
      harbor-harbor-transport@kubernetescrd
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - harbor.gmac.io
    secretName: harbor-tls
  rules:
  - host: harbor.gmac.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: harbor-core
            port:
              number: 80
```

> **CRITICAL NOTE on `maxRequestBodyBytes: 0`:** Traefik's buffering middleware with `maxRequestBodyBytes: 0` means "do not limit." However, verify this behavior in your Traefik version. If `0` means "disallow all bodies," omit the buffering middleware entirely (Traefik has no body size limit by default).

### 7.3 Migration procedure

```bash
# Step 1: Apply Harbor middleware and ServersTransport
kubectl apply -f k8s/traefik/harbor-middlewares.yaml

# Step 2: Migrate during a low-traffic window
# Switch the ingress
kubectl apply -f k8s/traefik/harbor-ingress-traefik.yaml

# Step 3: Immediate verification
# Health check
curl -s https://harbor.gmac.io/api/v2.0/health | jq .

# Docker login
docker login harbor.gmac.io

# Docker pull (read test)
docker pull harbor.gmac.io/library/test-image:latest

# Docker push (write test -- use a small test image)
docker tag alpine:latest harbor.gmac.io/library/alpine:migration-test
docker push harbor.gmac.io/library/alpine:migration-test

# Large image push test (exercises body size / timeout)
docker pull nginx:latest
docker tag nginx:latest harbor.gmac.io/library/nginx:migration-test
docker push harbor.gmac.io/library/nginx:migration-test

# Step 4: Verify CI/CD pipeline can push
# Trigger a test build in Gitea that pushes to Harbor
```

### 7.4 Verification checklist

- [ ] Harbor UI accessible at https://harbor.gmac.io
- [ ] `docker login` works
- [ ] `docker pull` works for existing images
- [ ] `docker push` works for small images (<10MB)
- [ ] `docker push` works for large images (>100MB)
- [ ] Gitea CI can push images to Harbor
- [ ] Harbor health API returns healthy
- [ ] TLS certificate is valid

### 7.5 Rollback

```bash
# Immediately restore nginx ingress from backup
kubectl apply -f /root/backup-harbor-ingress.yaml
# Verify
curl -s https://harbor.gmac.io/api/v2.0/health | jq .
docker pull harbor.gmac.io/library/test-image:latest
```

---

## 8. Phase 7: Cleanup and Remove Nginx

**Goal:** After all 35 ingresses are verified on Traefik, remove nginx-ingress controller.

### 8.1 Final audit

```bash
# Confirm zero ingresses still reference nginx
kubectl get ingress -A -o json | jq -r '
  .items[] |
  select(.spec.ingressClassName == "nginx" or
         (.metadata.annotations // {} | keys[] | select(startswith("nginx")))) |
  "\(.metadata.namespace)/\(.metadata.name)"
'
# Expected: empty output

# Double-check with a broader search
kubectl get ingress -A -o yaml | grep -c "nginx"
# Expected: 0
```

### 8.2 Update the letsencrypt-prod ClusterIssuer

Now that nginx is gone, update the original ClusterIssuer to use Traefik (so existing cert-manager references don't break):

```bash
kubectl patch clusterissuer letsencrypt-prod --type=json -p='[
  {"op": "replace", "path": "/spec/acme/solvers/0/http01/ingress/class", "value": "traefik"}
]'

# Now both letsencrypt-prod and letsencrypt-prod-traefik point to Traefik.
# Optionally migrate all ingresses to use letsencrypt-prod and delete letsencrypt-prod-traefik.
```

### 8.3 Remove nginx-ingress controller

```bash
# Check how nginx was installed
kubectl get ns ingress-nginx
helm list -n ingress-nginx  # if Helm-installed

# If installed via Helm:
helm uninstall ingress-nginx -n ingress-nginx

# If installed via manifests:
kubectl delete namespace ingress-nginx

# Clean up IngressClass
kubectl delete ingressclass nginx

# Verify nginx is fully removed
kubectl get pods -A | grep nginx-ingress
kubectl get svc -A | grep nginx-ingress
# Expected: no results
```

### 8.4 Clean up the test namespace

```bash
kubectl delete namespace traefik-test
```

### 8.5 Update the generic-app Helm chart defaults

Update the default `ingressClassName` in the Helm chart so new deployments use Traefik:

```yaml
# deployment-system/generic-app-chart/values.yaml
ingress:
  enabled: true
  className: "traefik"                            # was: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    # Remove: nginx.ingress.kubernetes.io/ssl-redirect: "true"
```

### 8.6 Update control-panel k8s manifests

Update all checked-in manifests:

- `k8s/06-ingress.yaml` -- change `ingressClassName: nginx` to `traefik`, replace annotations
- `k8s/tls-ingress.yaml` -- update ClusterIssuer solver class and ingress class
- `k8s/integrations-full.yaml` -- update webhooks ingress
- `deployment/control-panel-deployment.yaml` -- update ingress section

### 8.7 Update Traefik HelmChartConfig

Now that Traefik is the only controller, make it the default IngressClass:

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    ingressClass:
      enabled: true
      isDefaultClass: true
    providers:
      kubernetesIngress:
        publishedService:
          enabled: true
      kubernetesCRD:
        enabled: true
        allowCrossNamespace: true
    ports:
      web:
        port: 8000
        exposedPort: 80
        redirectTo:
          port: websecure
      websecure:
        port: 8443
        exposedPort: 443
    logs:
      access:
        enabled: true
EOF
```

### 8.8 Final verification checklist

- [ ] All 35 ingresses responding correctly on Traefik
- [ ] No nginx resources remain in the cluster
- [ ] cert-manager issuing certs via Traefik
- [ ] Traefik is the default IngressClass
- [ ] Docker push/pull to Harbor working
- [ ] OAuth2 forward auth working for all protected services
- [ ] Sticky sessions working for habit, linear-clone, playpath
- [ ] SSE streaming working for linear-clone
- [ ] WebSocket working for canvas
- [ ] CORS headers correct for turntable-bot
- [ ] Gitea CI/CD pipelines deploying successfully
- [ ] All checked-in YAML manifests updated
- [ ] Generic-app Helm chart defaults updated

---

## 9. Annotation Conversion Reference

Complete mapping of every nginx annotation used in this cluster to its Traefik equivalent:

| # | Nginx Annotation | Traefik Equivalent | Notes |
|---|---|---|---|
| 1 | `nginx.ingress.kubernetes.io/ssl-redirect: "true"` | (automatic) | Traefik redirects HTTP to HTTPS when `web.redirectTo: websecure` is set in HelmChartConfig |
| 2 | `nginx.ingress.kubernetes.io/force-ssl-redirect: "true"` | (automatic) | Same as above |
| 3 | `nginx.ingress.kubernetes.io/proxy-body-size: "NNm"` | Middleware CRD: `buffering.maxRequestBodyBytes` | Create a `Middleware` of type `buffering`. Reference via `traefik.ingress.kubernetes.io/router.middlewares` |
| 4 | `nginx.ingress.kubernetes.io/proxy-read-timeout: "N"` | ServersTransport: `forwardingTimeouts.responseHeaderTimeout` | Create a `ServersTransport` CRD. Reference via `traefik.ingress.kubernetes.io/service.serversTransport` |
| 5 | `nginx.ingress.kubernetes.io/proxy-send-timeout: "N"` | ServersTransport: `forwardingTimeouts.idleConnTimeout` | Closest equivalent; Traefik doesn't have a direct send timeout |
| 6 | `nginx.ingress.kubernetes.io/proxy-connect-timeout: "N"` | ServersTransport: `forwardingTimeouts.dialTimeout` | Direct equivalent |
| 7 | `nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"` | `traefik.ingress.kubernetes.io/service.serversscheme: https` | Direct annotation equivalent |
| 8 | `nginx.ingress.kubernetes.io/ssl-passthrough: "true"` | IngressRouteTCP with `tls.passthrough: true` | Requires switching from Ingress to IngressRouteTCP CRD |
| 9 | `nginx.ingress.kubernetes.io/auth-url` | Middleware CRD: `forwardAuth.address` | Create a `Middleware` of type `forwardAuth` |
| 10 | `nginx.ingress.kubernetes.io/auth-signin` | (handled by oauth2-proxy) | oauth2-proxy handles the redirect itself on 401 |
| 11 | `nginx.ingress.kubernetes.io/auth-response-headers` | Middleware CRD: `forwardAuth.authResponseHeaders` | Part of the `forwardAuth` Middleware |
| 12 | `nginx.ingress.kubernetes.io/affinity: "cookie"` | `traefik.ingress.kubernetes.io/service.sticky.cookie: "true"` | Direct annotation |
| 13 | `nginx.ingress.kubernetes.io/session-cookie-name` | `traefik.ingress.kubernetes.io/service.sticky.cookie.name` | Direct annotation |
| 14 | `nginx.ingress.kubernetes.io/session-cookie-max-age` | (no direct equivalent) | Use IngressRoute with weighted service for max-age control |
| 15 | `nginx.ingress.kubernetes.io/configuration-snippet` | Middleware CRD: `headers` | Create a `Middleware` with `headers.customResponseHeaders` or specific header fields |
| 16 | `nginx.ingress.kubernetes.io/enable-cors: "true"` | Middleware CRD: `headers` with CORS fields | Use `accessControlAllowOriginList`, `accessControlAllowMethods`, etc. |
| 17 | `nginx.ingress.kubernetes.io/proxy-buffering: "off"` | (automatic for SSE) | Traefik streams `text/event-stream` by default. For other content types, use `ServersTransport` with `responseHeaderTimeout: 0` |
| 18 | `nginx.ingress.kubernetes.io/websocket-services` | (automatic) | Traefik handles WebSocket upgrade automatically |
| 19 | `nginx.ingress.kubernetes.io/rate-limit` | Middleware CRD: `rateLimit` | Create a `Middleware` of type `rateLimit` with `average` and `period` |
| 20 | `kubernetes.io/ingress.class: nginx` | `ingressClassName: traefik` in spec | Use spec field, not annotation |

---

## 10. Generic App Helm Chart Update

The `deployment-system/generic-app-chart/` needs updates to support both controllers during migration and default to Traefik afterward.

### 10.1 Updated `values.yaml`

```yaml
ingress:
  enabled: true
  className: "traefik"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: chart-example-tls
      hosts:
        - chart-example.local
```

### 10.2 No template changes needed

The existing `templates/ingress.yaml` already uses `{{ .Values.ingress.className }}` and `{{ toYaml .Values.ingress.annotations }}`, so it works with any ingress controller. No template changes are required.

---

## Timeline Estimate

| Phase | Duration | Risk Level |
|-------|----------|------------|
| Phase 1: Enable Traefik alongside nginx | 1 hour | Low |
| Phase 2: Create Middleware CRDs | 30 min | None (inert resources) |
| Phase 3: Migrate simple ingresses (~12) | 2 hours | Low |
| Phase 4: Migrate medium-complexity (~10) | 2 hours | Medium |
| Phase 5: Migrate complex ingresses (~12) | 4 hours | High |
| Phase 6: Migrate Harbor | 1 hour (during maintenance window) | Critical |
| Phase 7: Cleanup nginx | 30 min | Low |
| **Total** | **~11 hours** (spread across 2-3 days) | |

Recommended schedule:
- **Day 1:** Phases 1-3 (enable Traefik, create CRDs, migrate simple ingresses)
- **Day 2:** Phases 4-5 (medium and complex ingresses)
- **Day 3:** Phase 6 (Harbor, during low-traffic window) and Phase 7 (cleanup)

---

## Emergency Rollback (Any Phase)

If something goes catastrophically wrong and you need all traffic back on nginx immediately:

```bash
# Restore ALL ingresses from the pre-migration backup
kubectl apply -f /root/backup-ingresses-YYYYMMDD.yaml

# Verify nginx is still running
kubectl get pods -n ingress-nginx

# If nginx was already removed, reinstall it:
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.ingressClassResource.default=true

# Restore the original ClusterIssuer
kubectl patch clusterissuer letsencrypt-prod --type=json -p='[
  {"op": "replace", "path": "/spec/acme/solvers/0/http01/ingress/class", "value": "nginx"}
]'
```
