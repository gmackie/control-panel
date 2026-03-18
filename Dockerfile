# Control Panel v2 - Turborepo Monorepo Production Build
# ================================================
# This Dockerfile builds the web-v2 app from the monorepo structure

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

# Copy package.json files from all workspaces
COPY apps/web-v2/package.json ./apps/web-v2/
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/webhooks/package.json ./packages/webhooks/
COPY packages/forgegraph/package.json ./packages/forgegraph/
COPY tooling/eslint/package.json ./tooling/eslint/
COPY tooling/typescript/package.json ./tooling/typescript/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web-v2/node_modules ./apps/web-v2/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/webhooks/node_modules ./packages/webhooks/node_modules
COPY --from=deps /app/packages/forgegraph/node_modules ./packages/forgegraph/node_modules

# Copy source code
COPY . .

# Set build environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build args for NEXT_PUBLIC_* variables (baked into client bundle)
ARG NEXT_PUBLIC_AZURE_AD_CLIENT_ID
ARG NEXT_PUBLIC_AZURE_AD_TENANT_ID
ENV NEXT_PUBLIC_AZURE_AD_CLIENT_ID=$NEXT_PUBLIC_AZURE_AD_CLIENT_ID
ENV NEXT_PUBLIC_AZURE_AD_TENANT_ID=$NEXT_PUBLIC_AZURE_AD_TENANT_ID

# Build the web-v2 app with turbo
RUN pnpm build --filter=@repo/web-v2

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssh-client
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /home/nextjs nextjs
RUN mkdir -p /home/nextjs/.ssh && chown -R nextjs:nodejs /home/nextjs/.ssh && chmod 700 /home/nextjs/.ssh

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-v2/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-v2/.next/static ./apps/web-v2/.next/static

# Ensure static files are in the right place
RUN mkdir -p .next/static && cp -r apps/web-v2/.next/static/* .next/static/ 2>/dev/null || true

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js server
CMD ["node", "apps/web-v2/server.js"]
