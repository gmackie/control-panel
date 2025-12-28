import { NextRequest, NextResponse } from "next/server";
import { ServiceTemplate } from "@/types";

const serviceTemplates: ServiceTemplate[] = [
  {
    id: "nextjs-web",
    name: "Next.js Web Application",
    description: "A modern React web application with Next.js framework",
    category: "web",
    framework: "nextjs",
    features: ["SSR", "API Routes", "TypeScript", "Tailwind CSS"],
    defaultConfig: {
      name: "",
      namespace: "default",
      replicas: 2,
      resources: {
        cpu: "200m",
        memory: "256Mi",
      },
      environment: "development",
      domains: [],
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: 3000,
          protocol: "TCP",
        },
      ],
      envVars: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      secrets: [],
      healthCheck: {
        path: "/api/health",
        initialDelaySeconds: 30,
        periodSeconds: 10,
        timeoutSeconds: 5,
        failureThreshold: 3,
      },
    },
    dockerfile: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]`,
    k8sManifests: [
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{.Name}}
  namespace: {{.Namespace}}
spec:
  replicas: {{.Replicas}}
  selector:
    matchLabels:
      app: {{.Name}}
  template:
    metadata:
      labels:
        app: {{.Name}}
    spec:
      containers:
      - name: {{.Name}}
        image: {{.Image}}
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: {{.Resources.CPU}}
            memory: {{.Resources.Memory}}
        livenessProbe:
          httpGet:
            path: {{.HealthCheck.Path}}
            port: 3000
          initialDelaySeconds: {{.HealthCheck.InitialDelaySeconds}}
          periodSeconds: {{.HealthCheck.PeriodSeconds}}
          timeoutSeconds: {{.HealthCheck.TimeoutSeconds}}
          failureThreshold: {{.HealthCheck.FailureThreshold}}`,
      `apiVersion: v1
kind: Service
metadata:
  name: {{.Name}}
  namespace: {{.Namespace}}
spec:
  selector:
    app: {{.Name}}
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP`,
    ],
    ciConfig: `name: Deploy to Kubernetes
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Build and push image
      run: |
        docker build -t \${{ github.repository }}:\${{ github.sha }} .
        docker push \${{ github.repository }}:\${{ github.sha }}
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/{{.Name}} {{.Name}}=\${{ github.repository }}:\${{ github.sha }}`,
  },
  {
    id: "go-api",
    name: "Go API Service",
    description: "High-performance API service built with Go",
    category: "api",
    framework: "go",
    features: ["REST API", "JWT Auth", "Database", "Swagger"],
    defaultConfig: {
      name: "",
      namespace: "default",
      replicas: 3,
      resources: {
        cpu: "100m",
        memory: "128Mi",
      },
      environment: "development",
      domains: [],
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: 8080,
          protocol: "TCP",
        },
      ],
      envVars: {
        PORT: "8080",
        ENV: "production",
      },
      secrets: ["database-url", "jwt-secret"],
      healthCheck: {
        path: "/health",
        initialDelaySeconds: 15,
        periodSeconds: 10,
        timeoutSeconds: 3,
        failureThreshold: 3,
      },
    },
    dockerfile: `FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]`,
    k8sManifests: [
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{.Name}}
  namespace: {{.Namespace}}
spec:
  replicas: {{.Replicas}}
  selector:
    matchLabels:
      app: {{.Name}}
  template:
    metadata:
      labels:
        app: {{.Name}}
    spec:
      containers:
      - name: {{.Name}}
        image: {{.Image}}
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: {{.Resources.CPU}}
            memory: {{.Resources.Memory}}
        env:
        - name: PORT
          value: "8080"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: {{.Name}}-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: {{.HealthCheck.Path}}
            port: 8080
          initialDelaySeconds: {{.HealthCheck.InitialDelaySeconds}}
          periodSeconds: {{.HealthCheck.PeriodSeconds}}
          timeoutSeconds: {{.HealthCheck.TimeoutSeconds}}
          failureThreshold: {{.HealthCheck.FailureThreshold}}`,
    ],
  },
  {
    id: "worker-service",
    name: "Background Worker",
    description: "Background job processor for handling async tasks",
    category: "worker",
    framework: "nodejs",
    features: ["Job Queue", "Redis", "Retry Logic", "Monitoring"],
    defaultConfig: {
      name: "",
      namespace: "default",
      replicas: 2,
      resources: {
        cpu: "150m",
        memory: "256Mi",
      },
      environment: "development",
      domains: [],
      ports: [
        {
          name: "metrics",
          port: 9090,
          targetPort: 9090,
          protocol: "TCP",
        },
      ],
      envVars: {
        NODE_ENV: "production",
        REDIS_URL: "redis://redis:6379",
      },
      secrets: ["redis-password", "api-keys"],
      healthCheck: {
        path: "/health",
        initialDelaySeconds: 30,
        periodSeconds: 15,
        timeoutSeconds: 5,
        failureThreshold: 3,
      },
    },
    dockerfile: `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 9090
CMD ["npm", "start"]`,
  },
  {
    id: "turso-database",
    name: "Turso Database",
    description: "SQLite database with Turso for edge computing",
    category: "database",
    framework: "custom",
    features: ["SQLite", "Edge Computing", "Replication", "Backups"],
    defaultConfig: {
      name: "",
      namespace: "default",
      replicas: 1,
      resources: {
        cpu: "100m",
        memory: "128Mi",
        storage: "1Gi",
      },
      environment: "development",
      domains: [],
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: 8080,
          protocol: "TCP",
        },
      ],
      envVars: {
        TURSO_DATABASE_URL: "",
        TURSO_AUTH_TOKEN: "",
      },
      secrets: ["turso-token"],
      healthCheck: {
        path: "/health",
        initialDelaySeconds: 30,
        periodSeconds: 10,
        timeoutSeconds: 5,
        failureThreshold: 3,
      },
    },
  },
];

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(serviceTemplates);
  } catch (error) {
    console.error("Failed to fetch service templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch service templates" },
      { status: 500 }
    );
  }
}
