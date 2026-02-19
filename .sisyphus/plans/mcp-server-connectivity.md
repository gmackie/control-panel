# MCP Server Connectivity Bring-up (control-panel)

## TL;DR

> **Quick Summary**: Bring up `packages/mcp-server` locally (stdio MCP server) and verify it can authenticate to the local control-panel API at `http://localhost:3000` using a bearer API key, then verify OpenCode can connect and list MCP tools.
>
> **Deliverables**:
> - Working local control-panel API at `http://localhost:3000`
> - Working API key (`cp_...`) verified via `GET /api/auth/verify`
> - `packages/mcp-server` builds to `packages/mcp-server/dist/index.js` and runs (stdio)
> - OpenCode `opencode mcp list` shows the MCP server and its tools
> - Optional: repeat verification against staging/prod by switching `CONTROL_PANEL_URL` and using a prod-scoped API key
>
> **Estimated Effort**: Medium (depends on local DB/auth readiness)
> **Parallel Execution**: YES (2–3 waves, once deps are installed)
> **Critical Path**: deps installed → control-panel running → API key works → MCP server runs → OpenCode lists tools

---

## Context

### Original Request
- Create a parallel task graph + TODOs to bring up MCP server connectivity.
- Scope:
  - Ensure `packages/mcp-server` builds and runs
  - Ensure MCP server can authenticate to the control-panel API
  - Ensure OpenCode can connect and list tools
- Must include discovery tasks first; implementation tasks only if missing/broken.
- Must include verification tasks with exact commands and expected outputs.
- Must include rollback/backout steps for any risky change.

### Known Repo Facts (verified)
- MCP server transport: stdio (spawns process, communicates via stdin/stdout).
  - Startup logs go to stderr:
    - `control-panel-mcp v0.1.0 starting...`
    - `Control panel: <url>`
    - `control-panel-mcp running on stdio`
  - References: `packages/mcp-server/src/server.ts`, `packages/mcp-server/src/index.ts`
- MCP server env vars:
  - `CONTROL_PANEL_API_KEY` (required)
  - `CONTROL_PANEL_URL` (optional; default `https://control.gmac.io`)
  - Reference: `packages/mcp-server/src/config.ts`
- MCP server uses bearer auth to call control-panel:
  - Sends `Authorization: Bearer <CONTROL_PANEL_API_KEY>` to `/api/trpc/*` and some `/api/integrations/*` routes
  - Reference: `packages/mcp-server/src/api-client.ts`
- Local API key verification endpoint:
  - `GET /api/auth/verify`
  - Success JSON includes: `{ valid: true, name, permissions, user }`
  - Reference: `apps/web/src/app/api/auth/verify/route.ts`
- Important mismatch to address:
  - Repo root has `opencode.json` (schema stub) but no `.opencode.json`
  - Root `README.md` claims `.opencode.json` already exists and suggests `opencode mcp list`
  - References: `opencode.json`, `README.md`

---

## Work Objectives

### Core Objective
Enable and verify end-to-end local MCP connectivity: OpenCode spawns the MCP server, MCP server authenticates to local control-panel, and tools are discoverable.

### Must Have
- `packages/mcp-server` builds successfully and produces `packages/mcp-server/dist/index.js`.
- Control panel dev server runs at `http://localhost:3000`.
- A valid `cp_...` API key exists in the same DB that the dev server uses.
- MCP server starts with local env and does not emit the connectivity warning from `packages/mcp-server/src/context.ts`.
- OpenCode can list MCP tools from this server.

### Must NOT Have (Guardrails)
- Do not commit any secrets (`CONTROL_PANEL_API_KEY`, prod keys, `.env.local`, etc.).
- Do not “fix” connectivity by weakening DB constraints or bypassing auth unless a blocker is proven.
- Do not expand scope into new MCP tools/features; the goal is connectivity and tool discovery.
- Staging/prod wave is verification-only (no deploy actions).

---

## Verification Strategy

### Primary Target
- Local dev only:
  - `CONTROL_PANEL_URL=http://localhost:3000`
  - Use a local-dev-scoped API key (or at minimum: non-prod, revocable key)

### Optional Follow-up
- Staging/prod verification wave:
  - Switch `CONTROL_PANEL_URL` to staging/prod
  - Use a prod-scoped API key (principle of least privilege)

### Evidence to Capture
- Terminal outputs for build/run commands
- HTTP status codes + response bodies for:
  - `/api/auth/verify`
  - at least one tRPC procedure used by MCP health check (`monitoring.healthSummary`)
- MCP server stderr startup log (must not contain the API key)
- Output of `opencode mcp list`

---

## Execution Strategy

### Parallel Execution Waves

Wave 0 (Preflight, required):
├── Task 0.1: Toolchain + deps installed
└── Task 0.2: Decide OpenCode config location/format (discovery)

Wave 1 (Can run in parallel after Wave 0):
├── Task 1.1: Build `packages/mcp-server`
└── Task 1.2: Start control-panel dev server and verify baseline routes

Wave 2 (After Wave 1):
├── Task 2.1: Obtain a valid local API key (cp_...) safely
└── Task 2.2: Verify bearer auth works against REST + tRPC

Wave 3 (After Wave 2):
├── Task 3.1: Run MCP server directly (stdio) and verify connectivity
└── Task 3.2: Configure OpenCode to spawn MCP server and list tools

Wave 4 (Optional follow-up, after Wave 3):
└── Task 4.1: Staging/prod verification (no deploy)

Critical Path: 0.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2

### Success Criteria Per Wave

Wave 0:
- `pnpm install` succeeds
- OpenCode MCP CLI shape is understood via `opencode mcp --help`

Wave 1:
- `pnpm mcp:build` succeeds and `packages/mcp-server/dist/index.js` exists
- `curl -i http://localhost:3000/api/auth/verify` returns 401 Missing authorization (route is reachable)

Wave 2:
- `/api/auth/verify` with bearer key returns JSON with `valid:true`
- `/api/trpc/monitoring.healthSummary` returns HTTP 200 with a `result` object

Wave 3:
- MCP server stderr shows it is targeting `http://localhost:3000` and does not emit the connectivity warning
- `opencode mcp list` shows the MCP server and tool discovery is non-empty

Wave 4 (optional):
- Remote `/api/auth/verify` returns `valid:true` for prod/staging URL with prod-scoped key
- MCP server starts cleanly against remote URL

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 0.1 | None | 1.1, 1.2 | 0.2 |
| 0.2 | None | 3.2 | 0.1 |
| 1.1 | 0.1 | 3.1, 3.2 | 1.2 |
| 1.2 | 0.1 | 2.1, 2.2, 3.1 | 1.1 |
| 2.1 | 1.2 | 2.2, 3.1, 3.2 | (none) |
| 2.2 | 2.1 | 3.1 | (none) |
| 3.1 | 1.1, 2.2 | 3.2 | (none) |
| 3.2 | 0.2, 3.1 | 4.1 | (none) |
| 4.1 | 3.2 | None | None |

---

## TODOs

### 0.1 Preflight: Toolchain + dependencies

**What to do**:
- Confirm Node and pnpm meet requirements.
- Install workspace dependencies.

**Commands + expected output**:
```bash
node -v
```
- Expected: prints a version `v20.x.x` or newer (MCP package requires Node >= 20).

```bash
pnpm -v
```
- Expected: prints a version; repo pins pnpm via `package.json#packageManager`.

```bash
pnpm install
```
- Expected: exit code 0; no dependency resolution fatal errors.

**Rollback / backout**:
- If install fails due to lockfile drift, do not regenerate lockfile unless explicitly requested; capture the error and stop.

**References**:
- `packages/mcp-server/package.json` (Node engine)
- `package.json` (pnpm workspace, scripts)

**Success criteria**:
- `pnpm install` completes successfully.

---

### 0.2 Discovery: Determine OpenCode MCP config file to use (and avoid committing secrets)

**What to do**:
- Determine which config file OpenCode actually reads in this environment.
- Reconcile repo mismatch: repo has `opencode.json` but README references `.opencode.json`.

**Commands + expected output**:
```bash
ls -la .opencode.json || true
```
- Expected: currently missing (repo mismatch).

```bash
opencode mcp list
```
- Expected: if no MCP servers configured globally, likely shows an empty list or “no servers configured”.
- If it errors, capture the exact error; it often indicates config filename/schema mismatch.

```bash
opencode mcp --help
```
- Expected: shows available `mcp` subcommands and confirms which subcommand to use for “list tools”.

**Decision / default**:
- Default for this repo: use a repo-local `./.opencode.json` for the server definition, but keep secrets out of git.

**Secrets hygiene (recommended approach)**:
- Keep `CONTROL_PANEL_API_KEY` out of `.opencode.json` and provide it via environment variables when launching OpenCode:
  - `export CONTROL_PANEL_API_KEY=cp_...`
- If you must place secrets into `.opencode.json` for local convenience, keep it untracked by adding it to `.git/info/exclude` (local-only):
  - add line: `.opencode.json`

**Rollback / backout**:
- Delete `./.opencode.json` (if created) and remove `.git/info/exclude` entry.
- Rotate/revoke the key if it was accidentally committed or pasted into logs.

**References**:
- `README.md` (claims `.opencode.json` exists; suggests `opencode mcp list`)
- `opencode.json` (schema stub; currently not the file OpenCode is documented to load)
- `packages/db/scripts/create-mcp-api-key.ts` (prints `.opencode.json` snippet)

**Success criteria**:
- You know the authoritative OpenCode config location and the correct CLI command to list MCP tools.

---

### 1.1 Discovery + Build: `packages/mcp-server`

**What to do**:
- Build MCP server package from repo root.

**Commands + expected output**:
```bash
pnpm mcp:build
```
- Expected: exit code 0.

```bash
ls -la packages/mcp-server/dist/index.js
```
- Expected: file exists.

Optional (extra signal, not required):
```bash
pnpm --filter @gmac/control-panel-mcp typecheck
```
- Expected: exit code 0.

**Rollback / backout**:
- None (build artifacts only). If the build is failing, treat as a blocker and capture error output.

**References**:
- `packages/mcp-server/package.json` (scripts: build/start)
- `packages/mcp-server/tsup.config.ts` (build output expectations)

**Success criteria**:
- `packages/mcp-server/dist/index.js` exists and is runnable.

---

### 1.2 Discovery + Run: Control-panel dev server baseline

**What to do**:
- Start the control-panel web server locally.
- Verify that required API routes are reachable.

**Commands + expected output**:
```bash
pnpm dev:web
```
- Expected: dev server starts; route reachable on `http://localhost:3000`.

In another terminal:
```bash
curl -sS -i http://localhost:3000/api/auth/verify
```
- Expected: `HTTP/1.1 401` and JSON body containing `{"error":"Missing authorization"}`.
- If DB is down/misconfigured, this endpoint may return `HTTP/1.1 500` with JSON `{"error":"Database not available"}`; treat that as a blocker for API key verification and MCP bring-up.

**Rollback / backout**:
- Stop dev server (Ctrl+C).

**References**:
- `apps/web/src/app/api/auth/verify/route.ts` (expected 401 error when no Authorization header)
- `package.json` (script `dev:web`)

**Success criteria**:
- Dev server is reachable and `/api/auth/verify` responds as expected.

---

### 2.1 Obtain a valid local API key (cp_...) safely

**What to do**:
- Get a `cp_...` API key that maps to a real `users.id` in the DB used by the dev server.

**Primary path (preferred, zero code changes): UI**
- Navigate to: `http://localhost:3000/settings` → API Keys → Create

**Fallback path (only if UI is blocked): DB/script**
- Known issue: `packages/db/scripts/create-mcp-api-key.ts` inserts `userId: "system"`, but `api_keys.user_id` has a FK to `users.id` (UUID). This is likely to fail unless a user with id `system` exists.
- If UI is blocked and there is no user seed path, treat this as a proven blocker and add an implementation task to update the script to select an existing user UUID (or create a dedicated dev user) and document rollback.

**Commands + expected output (UI path)**:
```bash
export CONTROL_PANEL_API_KEY="cp_your_key_here"
```
- Expected: env var set in current shell.

**Rollback / backout**:
- Revoke the created key in the UI if it was created only for local testing.

**Risk note (DB target mismatch)**:
- Ensure the key is created in the same database the dev server uses.
- If `/api/auth/verify` returns `Database not available` or always returns `Invalid API key` even for a newly created key, assume you are writing/reading different DBs until proven otherwise.

**References**:
- `apps/web/src/app/api/auth/verify/route.ts` (key verification)
- `packages/db/src/schema.ts` (FK constraint; shows why the script’s `userId: "system"` is risky)
- `packages/db/scripts/create-mcp-api-key.ts` (fallback script; currently suspect)

**Success criteria**:
- You have a `CONTROL_PANEL_API_KEY` value available in your shell.

---

### 2.2 Verify bearer auth against REST + tRPC

**What to do**:
- Verify the API key works via `/api/auth/verify`.
- Verify at least one real tRPC procedure used by MCP health check is callable.

**Commands + expected output**:
```bash
curl -sS -H "Authorization: Bearer $CONTROL_PANEL_API_KEY" \
  http://localhost:3000/api/auth/verify
```
- Expected: JSON contains `"valid":true`.

```bash
curl -sS -H "Authorization: Bearer $CONTROL_PANEL_API_KEY" \
  http://localhost:3000/api/trpc/monitoring.healthSummary
```
- Expected: HTTP 200 and JSON contains a top-level `result` object (tRPC response).

**Rollback / backout**:
- If key is invalid/expired: revoke and recreate via UI.
- If tRPC call fails but `/api/auth/verify` succeeds: capture HTTP status + body (likely router mismatch or auth context mismatch) before changing code.

**References**:
- `packages/mcp-server/src/context.ts` (health check calls `monitoring.healthSummary`)
- `packages/mcp-server/src/api-client.ts` (tRPC path conventions)

**Success criteria**:
- Both curl commands succeed with expected shapes.

---

### 3.1 Run MCP server directly (stdio) and verify local connectivity

**What to do**:
- Start MCP server with local env values.
- Confirm it starts and points at localhost.
- Confirm it does not print the warning about being unable to connect.

**Commands + expected output**:
```bash
CONTROL_PANEL_URL=http://localhost:3000 \
CONTROL_PANEL_API_KEY=$CONTROL_PANEL_API_KEY \
node packages/mcp-server/dist/index.js 2> /tmp/control-panel-mcp.log
```

In another terminal:
```bash
cat /tmp/control-panel-mcp.log
```
- Expected stderr contains (order may vary slightly):
  - `control-panel-mcp v0.1.0 starting...`
  - `Control panel: http://localhost:3000`
  - `control-panel-mcp running on stdio`
- Expected: no warning like:
  - `Warning: Unable to connect to control panel at ...`

**Rollback / backout**:
- Stop the process (Ctrl+C).
- If logs include the API key, treat as a security incident for that key: revoke/rotate.

**References**:
- `packages/mcp-server/src/server.ts` (stderr startup log strings)
- `packages/mcp-server/src/context.ts` (warning string + health check behavior)

**Success criteria**:
- MCP server starts and shows localhost control panel.

---

### 3.2 Configure OpenCode and verify tool listing

**What to do**:
- Create a repo-local `./.opencode.json` that defines the MCP stdio server.
- Keep secrets out of git.
- Verify OpenCode lists the MCP server and its tools.

**Implementation (only if required / proven blocker)**
- If `opencode mcp list` does not show the MCP server and you do not have global config, create `./.opencode.json`.

**Recommended `.opencode.json` content (no secrets)**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "control-panel": {
        "command": "node",
        "args": ["packages/mcp-server/dist/index.js"],
        "env": {
          "CONTROL_PANEL_URL": "http://localhost:3000"
        }
      }
    }
  }
}
```

**Commands + expected output**:
```bash
export CONTROL_PANEL_API_KEY="cp_your_key_here"
opencode mcp list
```
- Expected: output includes an MCP entry for `control-panel` (or similar) and indicates it is reachable.

If your OpenCode version supports it, also run the “list tools” subcommand discovered in Task 0.2:
```bash
opencode mcp --help
```
- Expected: shows which subcommand lists tools.

**Secrets hygiene**
- Prefer: API key in shell env (not in file).
- If you must put the key into `.opencode.json` locally:
  - Add `.opencode.json` to `.git/info/exclude` (local-only)
  - Never commit it

**Rollback / backout**
- Remove `./.opencode.json` and `.git/info/exclude` entry.
- Revoke key if exposed.

**References**
- `README.md` (documents `opencode mcp list`)
- `packages/db/scripts/create-mcp-api-key.ts` (prints `.opencode.json` snippet; do not commit secrets)

**Success criteria**
- `opencode mcp list` shows the server and a non-empty tool inventory is discoverable.

---

### 4.1 Optional follow-up: staging/prod verification (no deploy)

**What to do**:
- Re-run the auth + MCP startup checks against staging/prod by switching `CONTROL_PANEL_URL` and using a prod-scoped key.

**Commands + expected output**:
```bash
export CONTROL_PANEL_URL="https://control.gmac.io"  # or staging URL
export CONTROL_PANEL_API_KEY="cp_prod_scoped_key_here"

curl -sS -H "Authorization: Bearer $CONTROL_PANEL_API_KEY" \
  $CONTROL_PANEL_URL/api/auth/verify
```
- Expected: JSON includes `"valid":true`.

```bash
CONTROL_PANEL_URL=$CONTROL_PANEL_URL \
CONTROL_PANEL_API_KEY=$CONTROL_PANEL_API_KEY \
node packages/mcp-server/dist/index.js 2> /tmp/control-panel-mcp-remote.log
```
- Expected: stderr shows `Control panel: https://...` and no connectivity warning.

**Stop conditions (capture evidence, do not patch blindly)**
- 401/403 from `/api/auth/verify` (wrong key / wrong environment)
- TLS/DNS errors (URL misconfigured)
- MCP server starts but shows warning about inability to connect

**Rollback / backout**
- Revoke the prod-scoped key if any leak is suspected.
- Remove any remote URL/key exports from your shell.

**Success criteria**
- Remote `/api/auth/verify` returns `valid:true`.
- MCP server starts cleanly against remote URL.

---

## Proven Blockers / Known Mismatches (for conditional implementation tasks)

1) `.opencode.json` mismatch
- Repo has `opencode.json` but README and DB script reference `.opencode.json`.
- Fix options (in increasing invasiveness):
  - Local-only: create `./.opencode.json` and keep untracked via `.git/info/exclude`
  - Repo change: add a committed `.opencode.json` with no secrets (recommended for reproducibility)
  - Docs change: update `README.md` to match the actual config file/format

2) `create-mcp-api-key.ts` likely violates DB schema
- Script inserts `userId: "system"` but `api_keys.user_id` references `users.id` UUID.
- Prefer UI-based API key creation to avoid code changes.
- If UI is blocked (no OAuth config), add a targeted script fix as a proven-blocker implementation step.

---

## Success Criteria (Overall)

1) `pnpm mcp:build` succeeds and `packages/mcp-server/dist/index.js` exists.
2) Local dev server reachable:
   - `curl -i http://localhost:3000/api/auth/verify` → 401 Missing authorization
3) API key verified:
   - `curl -H "Authorization: Bearer $CONTROL_PANEL_API_KEY" http://localhost:3000/api/auth/verify` → JSON `valid:true`
4) tRPC procedure callable with bearer key:
   - `curl -H "Authorization: Bearer $CONTROL_PANEL_API_KEY" http://localhost:3000/api/trpc/monitoring.healthSummary` → HTTP 200 with `result`
5) MCP server starts cleanly with local env:
   - stderr includes startup lines and no connectivity warning
6) OpenCode lists MCP server and can enumerate tools:
   - `opencode mcp list` shows `control-panel` and tool discovery succeeds
