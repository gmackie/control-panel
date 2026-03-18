# Unified Secrets Management Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

The control panel becomes the single source of truth for all application secrets, with bidirectional sync to K8s clusters and Vercel deployments. Secrets are encrypted at rest in the database, synced on save to deployment targets, with drift detection when external changes occur.

## Design Decisions

- **Storage:** Hybrid — DB is source of truth, K8s/Vercel are kept in sync on write. Drift detection alerts on divergence.
- **Auth model:** Per-app OAuth/SAML config (each app owns its BetterAuth setup independently)
- **Database integration:** Connection string management with provider-aware dropdowns for Neon (provisioning deferred to future)
- **Sync timing:** Sync on save + restart prompt (immediate write to K8s/Vercel, explicit restart for pod pickup)

## Data Model

### New Table: `appSecrets`

```sql
CREATE TABLE app_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  environment VARCHAR(50) NOT NULL DEFAULT 'shared',
  category VARCHAR(50) NOT NULL DEFAULT 'custom',
  provider VARCHAR(100),
  sensitive BOOLEAN NOT NULL DEFAULT true,
  sync_targets TEXT NOT NULL DEFAULT '[]',
  last_synced_at TIMESTAMP,
  last_sync_status VARCHAR(50) DEFAULT 'pending',
  last_sync_error TEXT,
  created_by TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(application_id, key, environment)
);

CREATE INDEX idx_app_secrets_app ON app_secrets(application_id);
CREATE INDEX idx_app_secrets_category ON app_secrets(category);
CREATE INDEX idx_app_secrets_sync ON app_secrets(last_sync_status);
```

### Fields

| Field | Type | Purpose |
|-------|------|---------|
| key | varchar | ENV_VAR_NAME |
| encrypted_value | text | AES-256-GCM encrypted secret value |
| iv | text | Encryption initialization vector |
| environment | varchar | `production`, `staging`, or `shared` (applies to both) |
| category | varchar | `database`, `auth`, `email`, `monitoring`, `payments`, `analytics`, `custom` |
| provider | varchar | Links to integration provider (e.g., `neon`, `betterauth`, `sentry`) |
| sensitive | boolean | If true, value is masked in UI and never logged |
| sync_targets | JSON | Array of targets: `["k8s:production", "k8s:staging", "vercel:production"]` |
| last_sync_status | varchar | `synced`, `pending`, `failed`, `drift` |

### Encryption

Uses existing AES-256-GCM implementation from `apps/web/src/lib/crypto/secrets.ts`:
- Key: `SECRETS_ENCRYPTION_KEY` env var (base64-encoded 32 bytes)
- Random 16-byte IV per encryption
- 16-byte auth tag appended to ciphertext
- All values encrypted on write, decrypted only on explicit reveal or sync

## Integration Provider Templates

Templates define the set of env vars each integration needs. Defined in code, not DB.

### Database

**postgres:**
```
DATABASE_URL              required   connection string
DATABASE_URL_READONLY     optional   read replica
DATABASE_POOL_URL         optional   connection pooler
```

**neon** (extends postgres):
```
DATABASE_URL              required   pick from Neon API dropdown when NEON_API_KEY set
NEON_API_KEY              optional   enables project/branch listing
```

### Authentication

**betterauth:**
```
BETTER_AUTH_SECRET        required   signing key
BETTER_AUTH_URL           required   app base URL

OAuth Providers (each toggleable):
  github:
    AUTH_GITHUB_CLIENT_ID
    AUTH_GITHUB_CLIENT_SECRET
  google:
    AUTH_GOOGLE_CLIENT_ID
    AUTH_GOOGLE_CLIENT_SECRET
  azure_ad:
    AUTH_AZURE_AD_CLIENT_ID
    AUTH_AZURE_AD_CLIENT_SECRET
    AUTH_AZURE_AD_TENANT_ID
  apple:
    AUTH_APPLE_CLIENT_ID
    AUTH_APPLE_CLIENT_SECRET
    AUTH_APPLE_TEAM_ID
    AUTH_APPLE_KEY_ID

SAML:
  AUTH_SAML_ISSUER
  AUTH_SAML_SSO_URL
  AUTH_SAML_CERTIFICATE
  AUTH_SAML_CALLBACK_URL
```

### Monitoring

**sentry:**
```
SENTRY_DSN                required   error reporting
SENTRY_AUTH_TOKEN         optional   enables issue feed in Observability tab
SENTRY_ORG               optional
SENTRY_PROJECT            optional
```

**posthog:**
```
NEXT_PUBLIC_POSTHOG_KEY   required   client-side analytics
NEXT_PUBLIC_POSTHOG_HOST  required   default: https://us.i.posthog.com
POSTHOG_API_KEY           optional   enables analytics feed in Observability tab
```

### Email

**resend:**
```
RESEND_API_KEY            required
```

**sendgrid:**
```
SENDGRID_API_KEY          required
```

### Payments

**stripe:**
```
STRIPE_SECRET_KEY         required
STRIPE_PUBLISHABLE_KEY    required
STRIPE_WEBHOOK_SECRET     required
```

### Auth Services

**clerk:**
```
CLERK_SECRET_KEY                      required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY     required
```

## Sync Engine

### Sync Targets

Each secret has a `sync_targets` JSON array. Target format:
- `k8s:<cluster>` — Kubernetes secret in app's namespace (e.g., `k8s:production`, `k8s:staging`)
- `vercel:<environment>` — Vercel env var (e.g., `vercel:production`, `vercel:preview`)

### Write Flow

```
User clicks Save
  │
  ├─ 1. Encrypt value with AES-256-GCM
  │     Write to appSecrets table
  │     Set lastSyncStatus = 'pending'
  │
  ├─ 2. For each sync target:
  │     ├─ k8s:* → PATCH /api/v1/namespaces/{ns}/secrets/{name}
  │     │          via @kubernetes/client-node with kubeconfig
  │     │          Secret name: {app-slug}-secrets
  │     │          Key: env var name, Value: base64(plaintext)
  │     │
  │     └─ vercel:* → POST /v10/projects/{id}/env
  │                    via Vercel API with org token
  │                    Delete existing + recreate (Vercel immutable env vars)
  │
  ├─ 3. Per-target status update:
  │     ├─ Success → lastSyncStatus = 'synced', lastSyncedAt = now()
  │     ├─ Failure → lastSyncStatus = 'failed', lastSyncError = message
  │
  └─ 4. UI response:
        ├─ All synced → "Saved. Restart deployment to apply?" [Restart]
        ├─ Partial → "Saved. Failed to sync to staging: {error}" [Retry]
        └─ All failed → "Saved to DB. Sync failed. Retry?"
```

### Drift Detection

Runs every 5 minutes via polling hook:

```
For each app with sync targets:
  ├─ Read K8s secret via API → extract key/value pairs
  ├─ Read Vercel env vars via API
  ├─ Hash comparison against encrypted DB values
  ├─ If mismatch → set lastSyncStatus = 'drift'
  └─ Surface in SyncStatusBanner
```

Drift resolution is manual — user chooses:
- **Push** — Overwrite K8s/Vercel with DB value
- **Pull** — Update DB with external value (encrypts and stores)

### Restart Flow

After sync, the UI offers a "Restart Pods" button that triggers:
- K8s: `kubectl rollout restart deployment/{app-slug} -n {namespace}`
- Vercel: Triggers redeployment via API (optional, Vercel picks up env changes on next deploy)

## UI Components

### SecretEditor

The primary secret management component. Renders in the app detail Settings tab.

Secrets grouped by category. Each row shows:
- Key name (monospace)
- Masked value (first 4 + last 4 chars, middle masked)
- Sync status dot (green=synced, yellow=pending, red=failed, orange=drift)
- Edit button → inline input with Save/Cancel
- Reveal button → shows full value for 10 seconds, then re-masks

Footer actions: Sync All, Export .env, Export JSON

### IntegrationSetupWizard

Dialog for adding a new integration. Flow:
1. Pick provider from categorized grid
2. Template fields render with required/optional labels
3. For API-connected providers (Neon), entering the API key triggers resource discovery
4. For BetterAuth, toggleable OAuth provider sections with SAML config
5. Save writes all secrets to appSecrets with appropriate sync targets
6. Sync runs immediately

### SyncStatusBanner

Strip at top of Settings tab showing aggregate status:
```
● 12 secrets synced  ⚠ 1 drift detected  │ [Resolve Drift] [Restart Pods]
```

"Resolve Drift" opens a diff view: DB value vs K8s/Vercel value with push/pull per secret.

## Implementation Order

### Step 1: Schema & API
- Add `appSecrets` table + Drizzle schema + migration
- tRPC procedures: `secrets.list`, `secrets.set`, `secrets.delete`, `secrets.reveal`
- Encrypt on write, decrypt on reveal
- Provider templates as static config

### Step 2: K8s Sync
- `secrets.syncToK8s` mutation via @kubernetes/client-node
- Patches app-specific K8s secrets in target namespaces
- Status tracking per sync target

### Step 3: Vercel Sync
- `secrets.syncToVercel` mutation via Vercel API
- Delete + recreate pattern for immutable env vars
- Uses orgIntegrations[vercel] token

### Step 4: SecretEditor Component
- Grouped secret list with inline editing
- Masked values, sync status dots
- Save triggers set + sync
- "Restart Pods" button

### Step 5: IntegrationSetupWizard
- Template-driven dialog
- BetterAuth custom section (OAuth toggles, SAML)
- Neon resource dropdown
- Bulk save + sync

### Step 6: SyncStatusBanner + Drift Detection
- Polling hook comparing DB hashes vs K8s/Vercel
- Banner with resolve-drift UI (push/pull per secret)

### Step 7: Export
- `.env`, JSON, YAML export
- Decrypts values for local dev download
- Scoped by environment
