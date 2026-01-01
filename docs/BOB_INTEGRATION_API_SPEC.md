# Bob API Integration Spec for GMAC Control Panel

## Overview

The GMAC Control Panel needs to integrate with Bob (hosted at `claude.gmac.io`) to provide "Fix with AI" functionality. Users can select Sentry/PostHog errors from the mobile app and trigger AI-assisted bug fixing sessions.

## Current Gap Analysis

### What Bob Currently Provides

Bob is designed as an **interactive desktop tool** with:
- Repository management (local paths)
- Worktree creation for branch isolation
- AI agent instance management (Claude, Kiro, Codex, etc.)
- Terminal access (WebSocket-based PTY)
- Git operations (diff, commit, PR creation)
- Code analysis via `analyze-diff` endpoint

### What Control Panel Needs

Control Panel needs Bob to act as a **headless CI/CD-style service** that:
1. Accepts issue context (error details, stack traces)
2. Automatically clones/updates repositories
3. Creates isolated worktrees for fixes
4. Runs AI analysis with issue context injected
5. Proposes fixes and returns results via API
6. Applies fixes and creates PRs programmatically
7. Reports progress via webhooks/polling

---

## Proposed New API Endpoints

### 1. Issue-Based Fix Sessions

#### `POST /api/fix-sessions`

Start an automated fix session for a specific issue.

**Request:**
```json
{
  "repository": {
    "url": "https://github.com/gmackie/my-app.git",
    "branch": "main",
    "provider": "github"
  },
  "issue": {
    "source": "sentry",
    "externalId": "SENTRY-12345",
    "title": "TypeError: Cannot read property 'map' of undefined",
    "description": "Error occurs when user list is empty",
    "stackTrace": "TypeError: Cannot read property 'map' of undefined\n    at UserList (src/components/UserList.tsx:42:18)\n    at renderWithHooks...",
    "severity": "error",
    "affectedFile": "src/components/UserList.tsx",
    "affectedLine": 42,
    "url": "https://sentry.io/issues/12345"
  },
  "config": {
    "agentType": "claude",
    "autoAnalyze": true,
    "autoFix": false,
    "baseBranch": "main",
    "branchPrefix": "ai-fix"
  },
  "webhook": {
    "url": "https://control.gmac.io/api/ai-dev/webhook",
    "secret": "webhook-secret-here",
    "events": ["analysis.complete", "fix.applied", "pr.created", "session.failed"]
  }
}
```

**Response:**
```json
{
  "sessionId": "fix-session-uuid",
  "status": "initializing",
  "worktreeId": "worktree-uuid",
  "instanceId": "instance-uuid",
  "branch": "ai-fix/sentry-12345",
  "createdAt": "2025-12-30T15:00:00Z",
  "estimatedDuration": 120
}
```

---

#### `GET /api/fix-sessions/:sessionId`

Get current status of a fix session.

**Response:**
```json
{
  "sessionId": "fix-session-uuid",
  "status": "analyzing",
  "phase": "code_analysis",
  "progress": 45,
  "worktreeId": "worktree-uuid",
  "instanceId": "instance-uuid",
  "branch": "ai-fix/sentry-12345",
  "repository": {
    "name": "my-app",
    "url": "https://github.com/gmackie/my-app.git"
  },
  "issue": {
    "source": "sentry",
    "externalId": "SENTRY-12345",
    "title": "TypeError: Cannot read property 'map' of undefined"
  },
  "analysis": null,
  "logs": [
    {"timestamp": "2025-12-30T15:00:00Z", "level": "info", "message": "Session started"},
    {"timestamp": "2025-12-30T15:00:05Z", "level": "info", "message": "Repository cloned"},
    {"timestamp": "2025-12-30T15:00:10Z", "level": "info", "message": "Worktree created: ai-fix/sentry-12345"},
    {"timestamp": "2025-12-30T15:00:15Z", "level": "info", "message": "Claude agent started"},
    {"timestamp": "2025-12-30T15:00:20Z", "level": "info", "message": "Analyzing issue context..."}
  ],
  "createdAt": "2025-12-30T15:00:00Z",
  "updatedAt": "2025-12-30T15:00:45Z"
}
```

**Status Values:**
- `initializing` - Cloning repo, creating worktree
- `analyzing` - AI is analyzing the issue and codebase
- `review` - Analysis complete, awaiting approval
- `applying` - Applying fixes to code
- `committing` - Creating commit
- `pushing` - Pushing to remote
- `pr_created` - PR created successfully
- `completed` - Session finished successfully
- `failed` - Session failed (see `error` field)
- `cancelled` - Session cancelled by user

---

#### `GET /api/fix-sessions/:sessionId/analysis`

Get the AI's analysis and proposed fixes.

**Response:**
```json
{
  "sessionId": "fix-session-uuid",
  "status": "complete",
  "summary": "The error occurs because the `users` prop can be undefined when the API call hasn't completed. The code attempts to call `.map()` on an undefined value.",
  "rootCause": {
    "file": "src/components/UserList.tsx",
    "line": 42,
    "code": "users.map(user => <UserCard key={user.id} user={user} />)",
    "explanation": "No null check before calling .map() on users prop"
  },
  "proposedFixes": [
    {
      "id": "fix-1",
      "description": "Add optional chaining and fallback to empty array",
      "confidence": 0.95,
      "changes": [
        {
          "file": "src/components/UserList.tsx",
          "line": 42,
          "original": "users.map(user => <UserCard key={user.id} user={user} />)",
          "replacement": "(users ?? []).map(user => <UserCard key={user.id} user={user} />)",
          "diff": "@@ -40,3 +40,3 @@\n-  users.map(user => <UserCard key={user.id} user={user} />)\n+  (users ?? []).map(user => <UserCard key={user.id} user={user} />)"
        }
      ]
    },
    {
      "id": "fix-2", 
      "description": "Add early return with loading state when users is undefined",
      "confidence": 0.85,
      "changes": [
        {
          "file": "src/components/UserList.tsx",
          "line": 38,
          "original": "export function UserList({ users }) {",
          "replacement": "export function UserList({ users }) {\n  if (!users) return <LoadingSpinner />;",
          "diff": "..."
        }
      ]
    }
  ],
  "additionalNotes": [
    "Consider adding TypeScript types to catch this at compile time",
    "The parent component should handle loading state before rendering UserList"
  ],
  "testsRequired": false,
  "breakingChange": false
}
```

---

#### `POST /api/fix-sessions/:sessionId/approve`

Approve the proposed fix and create a PR.

**Request:**
```json
{
  "fixId": "fix-1",
  "commitMessage": "fix: add null check for users array in UserList\n\nFixes SENTRY-12345",
  "prTitle": "fix: handle undefined users in UserList component",
  "prBody": "## Summary\nFixes TypeError when users prop is undefined.\n\n## Changes\n- Added nullish coalescing to handle undefined users\n\n## Issue\nCloses SENTRY-12345",
  "reviewers": ["gmackie"],
  "labels": ["bug", "ai-fix"]
}
```

**Response:**
```json
{
  "sessionId": "fix-session-uuid",
  "status": "pr_created",
  "commit": {
    "sha": "abc123def456",
    "message": "fix: add null check for users array in UserList"
  },
  "pullRequest": {
    "number": 42,
    "url": "https://github.com/gmackie/my-app/pull/42",
    "title": "fix: handle undefined users in UserList component",
    "state": "open",
    "branch": "ai-fix/sentry-12345",
    "baseBranch": "main"
  },
  "filesChanged": ["src/components/UserList.tsx"],
  "completedAt": "2025-12-30T15:05:00Z"
}
```

---

#### `POST /api/fix-sessions/:sessionId/reject`

Reject the proposed fix with feedback.

**Request:**
```json
{
  "reason": "The fix doesn't address the root cause - we should fix the API call instead",
  "feedback": "Please analyze the data fetching logic in useUsers hook"
}
```

---

#### `POST /api/fix-sessions/:sessionId/cancel`

Cancel an in-progress session.

---

#### `DELETE /api/fix-sessions/:sessionId`

Clean up session resources (worktree, instance).

---

### 2. Webhook Events

Bob should POST to the configured webhook URL when events occur.

**Webhook Payload:**
```json
{
  "event": "analysis.complete",
  "sessionId": "fix-session-uuid",
  "timestamp": "2025-12-30T15:02:00Z",
  "data": {
    "status": "review",
    "analysisId": "analysis-uuid",
    "fixCount": 2,
    "confidence": 0.95
  },
  "signature": "sha256=..."
}
```

**Event Types:**
- `session.started` - Session initialized
- `session.cloned` - Repository cloned
- `session.analyzing` - AI analysis started
- `analysis.complete` - Analysis finished, ready for review
- `fix.applying` - Applying selected fix
- `fix.applied` - Fix applied successfully
- `commit.created` - Commit created
- `pr.created` - Pull request created
- `session.completed` - Session finished successfully
- `session.failed` - Session failed with error
- `session.cancelled` - Session cancelled

---

### 3. Repository Management (Cloud-Ready)

#### `POST /api/repositories/clone`

Clone a repository for use in fix sessions. Bob should maintain a cache of cloned repos.

**Request:**
```json
{
  "url": "https://github.com/gmackie/my-app.git",
  "provider": "github",
  "credentials": {
    "type": "token",
    "token": "ghp_xxxx"
  }
}
```

**Response:**
```json
{
  "repositoryId": "repo-uuid",
  "name": "my-app",
  "url": "https://github.com/gmackie/my-app.git",
  "defaultBranch": "main",
  "lastUpdated": "2025-12-30T15:00:00Z",
  "status": "ready"
}
```

---

### 4. Authentication

For cloud deployment, Bob needs proper authentication:

#### Option A: API Keys
```
Authorization: Bearer bob_live_xxxxxxxxxxxx
```

#### Option B: JWT with scopes
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Required Scopes:**
- `sessions:read` - View sessions
- `sessions:write` - Create/manage sessions
- `repositories:read` - List repositories
- `repositories:write` - Clone/manage repositories

---

## Implementation Priority

### Phase 1: Core Fix Session API (High Priority)
1. `POST /api/fix-sessions` - Create session with issue context
2. `GET /api/fix-sessions/:id` - Get session status
3. `GET /api/fix-sessions/:id/analysis` - Get analysis results
4. `POST /api/fix-sessions/:id/approve` - Approve and create PR
5. `POST /api/fix-sessions/:id/cancel` - Cancel session

### Phase 2: Webhooks (Medium Priority)
1. Webhook registration in session creation
2. Event emission for all status changes
3. Signature verification

### Phase 3: Enhanced Features (Lower Priority)
1. Session history/listing
2. Repository caching and management
3. Multi-fix application
4. Custom agent prompts
5. Team/organization support

---

## Integration Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Control Panel  │     │       Bob        │     │     GitHub      │
│    (Mobile)     │     │ (claude.gmac.io) │     │                 │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │  1. POST /fix-sessions│                        │
         │  (issue context)      │                        │
         │──────────────────────>│                        │
         │                       │                        │
         │  2. Session created   │  3. Clone repo         │
         │<──────────────────────│───────────────────────>│
         │                       │                        │
         │                       │  4. Create worktree    │
         │                       │  5. Start AI agent     │
         │                       │  6. Inject issue ctx   │
         │                       │  7. Run analysis       │
         │                       │                        │
         │  8. Webhook: analysis.complete                 │
         │<──────────────────────│                        │
         │                       │                        │
         │  9. GET /analysis     │                        │
         │──────────────────────>│                        │
         │                       │                        │
         │  10. Analysis results │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │  [User reviews on     │                        │
         │   mobile app]         │                        │
         │                       │                        │
         │  11. POST /approve    │                        │
         │──────────────────────>│                        │
         │                       │  12. Apply fix         │
         │                       │  13. Commit            │
         │                       │  14. Push branch       │
         │                       │───────────────────────>│
         │                       │                        │
         │                       │  15. Create PR         │
         │                       │───────────────────────>│
         │                       │                        │
         │  16. PR URL           │<───────────────────────│
         │<──────────────────────│                        │
         │                       │                        │
         │  17. Webhook: pr.created                       │
         │<──────────────────────│                        │
         │                       │                        │
```

---

## Environment Variables (Bob Side)

```env
# Authentication
BOB_API_KEY_SECRET=xxx              # For API key validation
BOB_JWT_SECRET=xxx                  # For JWT validation

# Repository Storage
BOB_REPOS_DIR=/data/bob-repos       # Where to clone repos
BOB_WORKTREES_DIR=/data/worktrees   # Where to create worktrees

# GitHub Integration
GITHUB_APP_ID=xxx                   # For PR creation
GITHUB_APP_PRIVATE_KEY=xxx
GITHUB_APP_INSTALLATION_ID=xxx

# Webhooks
BOB_WEBHOOK_TIMEOUT=30000           # Webhook delivery timeout

# Agent Configuration
BOB_DEFAULT_AGENT=claude            # Default AI agent
BOB_AGENT_TIMEOUT=300000            # Analysis timeout (5 min)
```

---

## Questions for Bob Team

1. **Repository Caching**: How should Bob handle repository caching for cloud deployment? Shallow clones? TTL-based cleanup?

2. **Concurrent Sessions**: What's the expected concurrency? Should there be limits per repository or globally?

3. **Agent Orchestration**: For issue-based sessions, how should the AI agent be prompted? Should Bob inject the issue context into the agent's initial prompt?

4. **Error Recovery**: If an agent crashes mid-analysis, should Bob auto-retry or fail the session?

5. **Gitea Support**: Control Panel primarily uses Gitea (gitea.gmac.io). Does Bob need Gitea-specific PR creation support?

---

## Contact

For questions about this integration:
- Control Panel: @gmackie
- Bob: [Bob team contact]
