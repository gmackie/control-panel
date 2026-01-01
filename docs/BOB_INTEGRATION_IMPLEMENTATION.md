# Bob + Control Panel Integration Implementation Guide

## Overview

This document describes the implementation work needed on both **Bob** and **Control Panel** sides to enable the "Fix with AI" feature.

---

## Current State

### Control Panel (Ready - Pending Bob API)

| Component | Status | Location |
|-----------|--------|----------|
| Database Schema | ✅ Complete | `packages/db/src/schema.ts` |
| tRPC Router | ✅ Complete | `packages/api/src/routers/ai-dev.ts` |
| REST API | ✅ Complete | `apps/web/src/app/api/ai-dev/route.ts` |
| Bob Client | ⚠️ Needs Updates | `apps/web/src/lib/bob/client.ts` |
| Mobile IssuesScreen | ✅ Complete | `apps/mobile/src/screens/IssuesScreen.tsx` |
| Mobile AISessionsList | ✅ Complete | `apps/mobile/src/screens/AISessionsListScreen.tsx` |
| Mobile AISessionDetail | ✅ Complete | `apps/mobile/src/screens/AISessionDetailScreen.tsx` |
| Navigation | ✅ Complete | `apps/mobile/App.tsx` |

### Bob (Needs Implementation)

| Component | Status | Priority |
|-----------|--------|----------|
| Fix Sessions API | ❌ Not Started | P0 |
| Issue Context Injection | ❌ Not Started | P0 |
| Webhook Support | ❌ Not Started | P1 |
| Authentication | ❌ Not Started | P1 |
| Gitea PR Support | ❌ Not Started | P2 |

---

## Bob Implementation Tasks

### P0: Core Fix Sessions API

#### Task 1: Create Fix Sessions Router

**File:** `backend/src/routes/fix-sessions.ts`

```typescript
// Endpoints to implement:
// POST   /api/fix-sessions              - Create new fix session
// GET    /api/fix-sessions              - List sessions (with filters)
// GET    /api/fix-sessions/:id          - Get session details
// GET    /api/fix-sessions/:id/analysis - Get analysis results
// POST   /api/fix-sessions/:id/approve  - Approve fix, create PR
// POST   /api/fix-sessions/:id/reject   - Reject with feedback
// POST   /api/fix-sessions/:id/cancel   - Cancel session
// DELETE /api/fix-sessions/:id          - Cleanup resources
```

**Key Responsibilities:**
1. Accept issue context (title, description, stack trace, source)
2. Clone/update repository if needed
3. Create worktree with branch name based on issue ID
4. Start AI agent instance
5. Inject issue context into agent prompt
6. Track session status through lifecycle
7. Return structured analysis results
8. Handle fix application and PR creation

#### Task 2: Fix Session Service

**File:** `backend/src/services/fix-session.ts`

```typescript
interface FixSessionConfig {
  repository: {
    url: string;
    branch: string;
    provider: 'github' | 'gitea' | 'gitlab';
  };
  issue: {
    source: 'sentry' | 'posthog' | 'manual';
    externalId: string;
    title: string;
    description?: string;
    stackTrace?: string;
    severity?: string;
    affectedFile?: string;
    affectedLine?: number;
    url?: string;
  };
  config: {
    agentType: 'claude' | 'kiro' | 'codex' | 'gemini';
    autoAnalyze: boolean;
    baseBranch?: string;
    branchPrefix?: string;
  };
  webhook?: {
    url: string;
    secret: string;
    events: string[];
  };
}

interface FixSession {
  id: string;
  status: FixSessionStatus;
  phase: string;
  progress: number;
  repositoryId: string;
  worktreeId: string;
  instanceId?: string;
  branch: string;
  issue: IssueContext;
  analysis?: AnalysisResult;
  pullRequest?: PRInfo;
  error?: string;
  logs: SessionLog[];
  createdAt: Date;
  updatedAt: Date;
}

type FixSessionStatus = 
  | 'initializing'
  | 'cloning'
  | 'analyzing' 
  | 'review'
  | 'applying'
  | 'committing'
  | 'pushing'
  | 'pr_created'
  | 'completed'
  | 'failed'
  | 'cancelled';
```

**Methods to implement:**
- `createSession(config: FixSessionConfig): Promise<FixSession>`
- `getSession(sessionId: string): Promise<FixSession>`
- `listSessions(filters?: SessionFilters): Promise<FixSession[]>`
- `runAnalysis(sessionId: string): Promise<AnalysisResult>`
- `approveAndCreatePR(sessionId: string, options: ApproveOptions): Promise<PRInfo>`
- `rejectSession(sessionId: string, reason: string): Promise<void>`
- `cancelSession(sessionId: string): Promise<void>`
- `cleanupSession(sessionId: string): Promise<void>`

#### Task 3: Issue Context Injection

**File:** `backend/src/services/agent.ts` (modify existing)

When starting an agent for a fix session, inject the issue context into the initial prompt:

```typescript
async startInstanceForFixSession(
  worktreeId: string, 
  agentType: string,
  issueContext: IssueContext
): Promise<Instance> {
  const contextPrompt = this.buildIssuePrompt(issueContext);
  
  // Start agent with issue context as initial input
  const instance = await this.startInstance(worktreeId, agentType);
  
  // Send issue context to agent's stdin
  await this.sendToAgent(instance.id, contextPrompt);
  
  return instance;
}

private buildIssuePrompt(issue: IssueContext): string {
  return `
## Issue to Fix

**Source:** ${issue.source} (${issue.externalId})
**Title:** ${issue.title}
**Severity:** ${issue.severity || 'unknown'}

### Description
${issue.description || 'No description provided'}

### Stack Trace
\`\`\`
${issue.stackTrace || 'No stack trace available'}
\`\`\`

${issue.affectedFile ? `**Affected File:** ${issue.affectedFile}:${issue.affectedLine || '?'}` : ''}

---

Please analyze this issue and:
1. Identify the root cause
2. Propose a fix with code changes
3. Explain why this fix addresses the issue
4. Note any potential side effects

Focus on making minimal, targeted changes that fix the issue without unnecessary refactoring.
`.trim();
}
```

#### Task 4: Database Schema Updates

**File:** `backend/src/database/migrations/XXX_fix_sessions.ts`

```sql
CREATE TABLE fix_sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'initializing',
  phase TEXT,
  progress INTEGER DEFAULT 0,
  
  -- Repository info
  repository_id TEXT,
  repository_url TEXT NOT NULL,
  repository_provider TEXT DEFAULT 'github',
  
  -- Worktree/Instance
  worktree_id TEXT,
  instance_id TEXT,
  branch TEXT,
  base_branch TEXT DEFAULT 'main',
  
  -- Issue context
  issue_source TEXT NOT NULL,
  issue_external_id TEXT NOT NULL,
  issue_title TEXT NOT NULL,
  issue_description TEXT,
  issue_stack_trace TEXT,
  issue_severity TEXT,
  issue_affected_file TEXT,
  issue_affected_line INTEGER,
  issue_url TEXT,
  
  -- Analysis results (JSON)
  analysis_result TEXT,
  
  -- PR info
  pr_number INTEGER,
  pr_url TEXT,
  pr_title TEXT,
  pr_state TEXT,
  
  -- Config
  agent_type TEXT DEFAULT 'claude',
  
  -- Webhook config (JSON)
  webhook_config TEXT,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  
  FOREIGN KEY (repository_id) REFERENCES repositories(id),
  FOREIGN KEY (worktree_id) REFERENCES worktrees(id)
);

CREATE TABLE fix_session_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  level TEXT NOT NULL,
  phase TEXT,
  message TEXT NOT NULL,
  details TEXT,
  progress INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES fix_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_fix_sessions_status ON fix_sessions(status);
CREATE INDEX idx_fix_sessions_issue ON fix_sessions(issue_source, issue_external_id);
CREATE INDEX idx_fix_session_logs_session ON fix_session_logs(session_id);
```

---

### P1: Webhook Support

#### Task 5: Webhook Service

**File:** `backend/src/services/webhook.ts`

```typescript
interface WebhookConfig {
  url: string;
  secret: string;
  events: WebhookEvent[];
}

type WebhookEvent = 
  | 'session.started'
  | 'session.cloning'
  | 'session.analyzing'
  | 'analysis.complete'
  | 'fix.applying'
  | 'fix.applied'
  | 'commit.created'
  | 'pr.created'
  | 'session.completed'
  | 'session.failed'
  | 'session.cancelled';

interface WebhookPayload {
  event: WebhookEvent;
  sessionId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

class WebhookService {
  async emit(sessionId: string, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session.webhookConfig) return;
    
    const config = JSON.parse(session.webhookConfig) as WebhookConfig;
    if (!config.events.includes(event)) return;
    
    const payload: WebhookPayload = {
      event,
      sessionId,
      timestamp: new Date().toISOString(),
      data,
    };
    
    const signature = this.sign(payload, config.secret);
    
    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bob-Signature': signature,
        'X-Bob-Event': event,
      },
      body: JSON.stringify(payload),
    });
  }
  
  private sign(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }
}
```

#### Task 6: Integrate Webhooks into Fix Session Lifecycle

Emit webhooks at each status transition in FixSessionService:

```typescript
async transitionStatus(sessionId: string, newStatus: FixSessionStatus, data?: Record<string, unknown>) {
  await this.db.run(
    'UPDATE fix_sessions SET status = ?, updated_at = ? WHERE id = ?',
    [newStatus, new Date(), sessionId]
  );
  
  const eventMap: Record<FixSessionStatus, WebhookEvent> = {
    'initializing': 'session.started',
    'cloning': 'session.cloning',
    'analyzing': 'session.analyzing',
    'review': 'analysis.complete',
    'applying': 'fix.applying',
    'committing': 'commit.created',
    'pr_created': 'pr.created',
    'completed': 'session.completed',
    'failed': 'session.failed',
    'cancelled': 'session.cancelled',
  };
  
  await this.webhookService.emit(sessionId, eventMap[newStatus], data || {});
}
```

---

### P1: Authentication

#### Task 7: API Key Authentication Middleware

**File:** `backend/src/middleware/auth.ts`

```typescript
interface ApiKey {
  id: string;
  key: string;
  name: string;
  scopes: string[];
  createdAt: Date;
  lastUsedAt?: Date;
}

function apiKeyAuth(requiredScopes: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    
    const token = authHeader.slice(7);
    const apiKey = await validateApiKey(token);
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    if (requiredScopes.length > 0) {
      const hasScopes = requiredScopes.every(scope => apiKey.scopes.includes(scope));
      if (!hasScopes) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }
    
    req.apiKey = apiKey;
    await updateLastUsed(apiKey.id);
    next();
  };
}
```

#### Task 8: Apply Auth to Fix Sessions Routes

```typescript
// In server.ts or routes setup
app.use('/api/fix-sessions', apiKeyAuth(['sessions:read', 'sessions:write']));
```

---

### P2: Gitea Support

#### Task 9: Git Provider Abstraction

**File:** `backend/src/services/git-providers/index.ts`

```typescript
interface GitProvider {
  name: string;
  
  // Repository operations
  cloneRepository(url: string, path: string, credentials?: Credentials): Promise<void>;
  
  // PR operations
  createPullRequest(options: CreatePROptions): Promise<PRInfo>;
  getPullRequest(repo: string, number: number): Promise<PRInfo>;
  updatePullRequest(repo: string, number: number, updates: PRUpdates): Promise<PRInfo>;
  
  // Auth
  validateCredentials(credentials: Credentials): Promise<boolean>;
}

interface CreatePROptions {
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  reviewers?: string[];
  labels?: string[];
}
```

#### Task 10: Gitea Provider Implementation

**File:** `backend/src/services/git-providers/gitea.ts`

```typescript
class GiteaProvider implements GitProvider {
  name = 'gitea';
  
  constructor(private baseUrl: string, private token: string) {}
  
  async createPullRequest(options: CreatePROptions): Promise<PRInfo> {
    const [owner, repo] = options.repo.split('/');
    
    const response = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: options.title,
        body: options.body,
        head: options.head,
        base: options.base,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Gitea API error: ${response.status}`);
    }
    
    const pr = await response.json();
    
    return {
      number: pr.number,
      url: pr.html_url,
      title: pr.title,
      state: pr.state,
    };
  }
  
  // ... other methods
}
```

#### Task 11: Provider Factory

**File:** `backend/src/services/git-providers/factory.ts`

```typescript
function getGitProvider(provider: string, config: ProviderConfig): GitProvider {
  switch (provider) {
    case 'github':
      return new GitHubProvider(config.token);
    case 'gitea':
      return new GiteaProvider(config.baseUrl, config.token);
    case 'gitlab':
      return new GitLabProvider(config.baseUrl, config.token);
    default:
      throw new Error(`Unknown git provider: ${provider}`);
  }
}
```

---

## Control Panel Implementation Tasks

### After Bob API is Ready

#### Task 1: Update Bob Client

**File:** `apps/web/src/lib/bob/client.ts`

Replace current worktree-based methods with fix-session-based methods:

```typescript
// New methods to add
async createFixSession(config: FixSessionConfig): Promise<FixSession>;
async getFixSession(sessionId: string): Promise<FixSession>;
async getFixSessionAnalysis(sessionId: string): Promise<AnalysisResult>;
async approveFixSession(sessionId: string, options: ApproveOptions): Promise<PRInfo>;
async rejectFixSession(sessionId: string, reason: string): Promise<void>;
async cancelFixSession(sessionId: string): Promise<void>;
```

#### Task 2: Update REST API

**File:** `apps/web/src/app/api/ai-dev/route.ts`

Update actions to use new Bob fix-session endpoints:

```typescript
case "create": {
  // Call Bob's POST /api/fix-sessions
  const bobSession = await bobClient.createFixSession({
    repository: {
      url: input.repositoryUrl,
      branch: input.branch,
      provider: 'gitea', // or detect from URL
    },
    issue: {
      source: input.issueSource,
      externalId: input.issueId,
      title: input.issueTitle,
      // ... other fields
    },
    config: {
      agentType: input.agentType,
      autoAnalyze: true,
    },
    webhook: {
      url: `${process.env.NEXTAUTH_URL}/api/ai-dev/webhook`,
      secret: process.env.BOB_WEBHOOK_SECRET,
      events: ['analysis.complete', 'pr.created', 'session.failed'],
    },
  });
  
  // Store mapping in our DB
  await db.insert(aiDevSessions).values({
    bobSessionId: bobSession.id,
    // ... other fields
  });
}
```

#### Task 3: Add Webhook Endpoint

**File:** `apps/web/src/app/api/ai-dev/webhook/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const signature = request.headers.get('X-Bob-Signature');
  const event = request.headers.get('X-Bob-Event');
  const body = await request.json();
  
  // Verify signature
  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // Handle event
  switch (event) {
    case 'analysis.complete':
      await handleAnalysisComplete(body);
      break;
    case 'pr.created':
      await handlePRCreated(body);
      break;
    case 'session.failed':
      await handleSessionFailed(body);
      break;
  }
  
  return NextResponse.json({ received: true });
}
```

#### Task 4: Update Mobile Screens

Minor updates to use new response formats from Bob's fix-session API.

---

## Environment Configuration

### Bob (claude.gmac.io)

```env
# Authentication
BOB_API_KEY_SECRET=generate-secure-secret

# Repository Storage
BOB_REPOS_DIR=/data/bob-repos
BOB_WORKTREES_DIR=/data/worktrees

# Git Providers
GITHUB_TOKEN=ghp_xxx
GITEA_URL=https://gitea.gmac.io
GITEA_TOKEN=xxx

# Webhooks
BOB_WEBHOOK_TIMEOUT=30000

# Agent Config
BOB_DEFAULT_AGENT=claude
BOB_AGENT_TIMEOUT=300000
```

### Control Panel

```env
# Bob Integration
BOB_API_URL=https://claude.gmac.io
BOB_API_KEY=bob_live_xxx
BOB_WEBHOOK_SECRET=generate-secure-secret

# Sentry (for fetching issues)
SENTRY_AUTH_TOKEN=xxx
SENTRY_ORG=gmac

# PostHog (for fetching issues)
POSTHOG_API_KEY=xxx
POSTHOG_PROJECT_ID=xxx
```

---

## Testing Checklist

### Bob Side

- [ ] Create fix session with Sentry issue context
- [ ] Create fix session with PostHog issue context
- [ ] Create fix session with manual issue
- [ ] Verify agent receives issue context
- [ ] Verify analysis results structure
- [ ] Verify PR creation with GitHub
- [ ] Verify PR creation with Gitea
- [ ] Verify webhook delivery
- [ ] Verify webhook signature validation
- [ ] Test session cancellation/cleanup
- [ ] Test concurrent sessions
- [ ] Test error handling and retries

### Control Panel Side

- [ ] Create session from Sentry issue
- [ ] Poll for session status updates
- [ ] Receive webhook notifications
- [ ] Display analysis results
- [ ] Approve session and verify PR created
- [ ] Reject session with feedback
- [ ] Cancel in-progress session
- [ ] Mobile UI displays all states correctly
- [ ] Biometric auth for approve/reject actions

---

## Migration Path

### Phase 1: Temporary Polling (Current)
- Control Panel polls Bob's existing endpoints
- Limited functionality (no issue context injection)
- Works with existing Bob API

### Phase 2: Issue Context (Bob implements P0)
- Bob adds fix-sessions API
- Control Panel switches to new endpoints
- Full issue context support

### Phase 3: Webhooks (Bob implements P1)
- Bob adds webhook support
- Control Panel adds webhook endpoint
- Real-time updates instead of polling

### Phase 4: Full Integration (Bob implements P2)
- Gitea PR support
- Full authentication
- Production-ready
