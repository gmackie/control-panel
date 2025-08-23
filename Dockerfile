# Multi-stage Dockerfile for Control Panel

# Frontend build stage
FROM node:20-alpine AS frontend-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build the application
RUN npm run build

FROM node:20-alpine AS frontend
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "server.js"]

# Backend API stage
FROM python:3.11-slim AS backend-deps
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim AS backend
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies from deps stage
COPY --from=backend-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-deps /usr/local/bin /usr/local/bin

# Copy application code
COPY src/ ./src/
COPY requirements.txt .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
USER app

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

# AI Services base image
FROM python:3.11-slim AS ai-base
WORKDIR /app

# Install system dependencies for ML libraries
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy AI requirements
COPY ai-services/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN useradd --create-home --shell /bin/bash aiuser
USER aiuser

EXPOSE 8001

# Individual AI service stages
FROM ai-base AS incident-prediction
COPY ai-operations/incident-prediction.py ./
CMD ["python", "-m", "uvicorn", "incident-prediction:app", "--host", "0.0.0.0", "--port", "8001"]

FROM ai-base AS capacity-planning
COPY ai-operations/capacity-planning.py ./
CMD ["python", "-m", "uvicorn", "capacity-planning:app", "--host", "0.0.0.0", "--port", "8001"]

FROM ai-base AS root-cause-analysis
COPY ai-operations/root-cause-analysis.py ./
CMD ["python", "-m", "uvicorn", "root-cause-analysis:app", "--host", "0.0.0.0", "--port", "8001"]

FROM ai-base AS resource-optimization
COPY ai-operations/resource-optimization.py ./
CMD ["python", "-m", "uvicorn", "resource-optimization:app", "--host", "0.0.0.0", "--port", "8001"]

FROM ai-base AS anomaly-detection
COPY ai-operations/anomaly-detection-forecasting.py ./
CMD ["python", "-m", "uvicorn", "anomaly-detection-forecasting:app", "--host", "0.0.0.0", "--port", "8001"]
