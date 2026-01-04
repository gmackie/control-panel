# Unified Task & Release Tracking Implementation Plan

> **Goal:** Build a unified task management board and release tracking system with bi-directional sync across GitHub, Gitea, Linear, and Notion. Control Panel is the source of truth.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     CONTROL PANEL (Source of Truth)                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Unified Task Board                         │  │
│  │   Per-application Kanban: Backlog → In Progress → Done        │  │
│  │   Create, edit, assign, label, link to releases               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↕ Sync Engine                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │   GitHub   │ │   Gitea    │ │   Linear   │ │   Notion   │      │
│  │  Issues    │ │  Issues    │ │   Issues   │ │   Tasks    │      │
│  │  Releases  │ │  Releases  │ │            │ │            │      │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Release Management                          │  │
│  │   Semantic versioning • Changelog generation • Deploy status  │  │
│  │   Create releases on GitHub/Gitea from Control Panel          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

## Data Model

### New Tables

```
┌─────────────────────────────────────────────────────────────────────┐
│ tasks (unified task/issue table - source of truth)                  │
├─────────────────────────────────────────────────────────────────────┤
│ id, applicationId, title, description, status, priority            │
│ assignee, labels[], dueDate, estimate, releaseId                   │
│ externalLinks: { github?, gitea?, linear?, notion? }               │
│ syncStatus, lastSyncAt, createdAt, updatedAt                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ releases (version/release tracking)                                 │
├─────────────────────────────────────────────────────────────────────┤
│ id, applicationId, version (semver), name, description             │
│ changelog (markdown), status (draft/published/deployed)            │
│ publishedAt, publishedTo: { github?, gitea? }                      │
│ commitSha, compareUrl, tasks[]                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ task_sync_configs (per-app sync configuration)                      │
├─────────────────────────────────────────────────────────────────────┤
│ id, applicationId, provider (github|gitea|linear|notion)           │
│ enabled, config (JSON), lastSyncAt, syncDirection                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation & Schema (Day 1)
**Estimated: 2-3 hours**

| Task | Files | Description |
|------|-------|-------------|
| 1.1 | `packages/db/src/schema.ts` | Add `tasks`, `releases`, `taskSyncConfigs` tables |
| 1.2 | `packages/db/src/schema.ts` | Add type exports |
| 1.3 | Terminal | Run `pnpm db:generate && pnpm db:migrate` |
| 1.4 | Commit | `feat(db): add unified task and release tracking schema` |

---

### Phase 2: Provider Clients (Day 1-2)
**Estimated: 4-5 hours**

| Task | Files | Description |
|------|-------|-------------|
| 2.1 | `apps/web/src/lib/linear/client.ts` | Create Linear API client (issues, projects, labels) |
| 2.2 | `apps/web/src/lib/github/client.ts` | Extend: Issues CRUD, Releases CRUD, Labels |
| 2.3 | `apps/web/src/lib/gitea/client.ts` | Extend: Issues CRUD, Releases CRUD, Labels |
| 2.4 | `apps/web/src/lib/notion/client.ts` | Verify existing client supports task CRUD |
| 2.5 | `packages/shared/src/types/tasks.ts` | Shared task/release types |
| 2.6 | Commit | `feat(integrations): add Linear client, extend GitHub/Gitea for issues and releases` |

**Linear Client Methods:**
```typescript
- getIssues(teamId, filters)
- getIssue(id)
- createIssue(input)
- updateIssue(id, input)
- getProjects(teamId)
- getLabels(teamId)
- getTeams()
```

**GitHub/Gitea Extensions:**
```typescript
- listIssues(owner, repo, filters)
- getIssue(owner, repo, number)
- createIssue(owner, repo, input)
- updateIssue(owner, repo, number, input)
- closeIssue(owner, repo, number)
- listReleases(owner, repo)
- getRelease(owner, repo, id)
- createRelease(owner, repo, input) // tag, name, body, draft
- listLabels(owner, repo)
- createLabel(owner, repo, input)
```

---

### Phase 3: Sync Engine (Day 2-3)
**Estimated: 5-6 hours**

| Task | Files | Description |
|------|-------|-------------|
| 3.1 | `apps/web/src/lib/sync/task-sync-engine.ts` | Core sync orchestrator |
| 3.2 | `apps/web/src/lib/sync/providers/github.ts` | GitHub sync adapter |
| 3.3 | `apps/web/src/lib/sync/providers/gitea.ts` | Gitea sync adapter |
| 3.4 | `apps/web/src/lib/sync/providers/linear.ts` | Linear sync adapter |
| 3.5 | `apps/web/src/lib/sync/providers/notion.ts` | Notion sync adapter |
| 3.6 | `apps/web/src/lib/sync/conflict-resolver.ts` | Conflict resolution (Control Panel wins) |
| 3.7 | Commit | `feat(sync): add bi-directional task sync engine` |

**Sync Engine Design:**
```typescript
class TaskSyncEngine {
  // Pull changes from external provider → update local
  async pullFromProvider(appId: string, provider: Provider): Promise<SyncResult>
  
  // Push local changes → external provider
  async pushToProvider(appId: string, provider: Provider, taskId: string): Promise<SyncResult>
  
  // Full bi-directional sync
  async syncAll(appId: string): Promise<SyncResult[]>
  
  // Webhook handler for real-time updates
  async handleWebhook(provider: Provider, payload: unknown): Promise<void>
}
```

---

### Phase 4: tRPC Routers (Day 3)
**Estimated: 3-4 hours**

| Task | Files | Description |
|------|-------|-------------|
| 4.1 | `packages/api/src/routers/tasks.ts` | CRUD for unified tasks |
| 4.2 | `packages/api/src/routers/releases.ts` | CRUD for releases |
| 4.3 | `packages/api/src/routers/sync.ts` | Sync control endpoints |
| 4.4 | `packages/api/src/root.ts` | Register new routers |
| 4.5 | Commit | `feat(api): add tasks, releases, and sync routers` |

**Task Router:**
```typescript
- tasks.list(appId, filters)
- tasks.get(id)
- tasks.create(input)
- tasks.update(id, input)
- tasks.delete(id)
- tasks.move(id, status) // Kanban drag-drop
- tasks.linkToRelease(taskId, releaseId)
```

**Release Router:**
```typescript
- releases.list(appId)
- releases.get(id)
- releases.create(input) // Auto-generates semver
- releases.update(id, input)
- releases.publish(id, targets[]) // Publish to GitHub/Gitea
- releases.generateChangelog(id) // From linked tasks
```

---

### Phase 5: Web UI - Task Board (Day 4-5)
**Estimated: 6-8 hours**

| Task | Files | Description |
|------|-------|-------------|
| 5.1 | `apps/web/src/components/tasks/TaskBoard.tsx` | Kanban board with drag-drop |
| 5.2 | `apps/web/src/components/tasks/TaskCard.tsx` | Task card component |
| 5.3 | `apps/web/src/components/tasks/TaskModal.tsx` | Create/edit task modal |
| 5.4 | `apps/web/src/components/tasks/TaskFilters.tsx` | Filter by status, assignee, label |
| 5.5 | `apps/web/src/components/tasks/SyncStatus.tsx` | Show sync status per provider |
| 5.6 | `apps/web/src/app/applications/[id]/tasks/page.tsx` | Tasks page per application |
| 5.7 | Commit | `feat(web): add task board with Kanban view` |

**Kanban Columns:**
- Backlog
- To Do
- In Progress
- In Review
- Done

---

### Phase 6: Web UI - Release Management (Day 5-6)
**Estimated: 4-5 hours**

| Task | Files | Description |
|------|-------|-------------|
| 6.1 | `apps/web/src/components/releases/ReleaseList.tsx` | List of releases with status |
| 6.2 | `apps/web/src/components/releases/ReleaseModal.tsx` | Create release with semver picker |
| 6.3 | `apps/web/src/components/releases/ChangelogEditor.tsx` | Markdown changelog editor |
| 6.4 | `apps/web/src/components/releases/PublishDialog.tsx` | Publish to GitHub/Gitea |
| 6.5 | `apps/web/src/app/applications/[id]/releases/page.tsx` | Releases page per application |
| 6.6 | Commit | `feat(web): add release management with semantic versioning` |

**Release Creation Flow:**
1. Select version type (major/minor/patch) → auto-increment
2. Select tasks to include → auto-generate changelog
3. Edit changelog if needed
4. Save as draft or publish directly
5. Publish to GitHub/Gitea creates tag + release

---

### Phase 7: Webhooks & Real-time Sync (Day 6)
**Estimated: 3-4 hours**

| Task | Files | Description |
|------|-------|-------------|
| 7.1 | `apps/web/src/app/api/webhooks/github/route.ts` | GitHub issue/release webhooks |
| 7.2 | `apps/web/src/app/api/webhooks/gitea/route.ts` | Gitea issue/release webhooks |
| 7.3 | `apps/web/src/app/api/webhooks/linear/route.ts` | Linear webhooks |
| 7.4 | Commit | `feat(webhooks): add real-time sync for GitHub, Gitea, Linear` |

---

### Phase 8: Mobile (Future - Week 2)
**Estimated: 6-8 hours**

| Task | Files | Description |
|------|-------|-------------|
| 8.1 | `apps/mobile/src/screens/TaskBoardScreen.tsx` | Mobile task board |
| 8.2 | `apps/mobile/src/screens/TaskDetailScreen.tsx` | Task detail view |
| 8.3 | `apps/mobile/src/screens/ReleasesScreen.tsx` | Release list |
| 8.4 | `apps/mobile/App.tsx` | Add navigation |

---

## Environment Variables Required

```bash
# Already configured
GITEA_URL=***
GITEA_TOKEN=***
GITHUB_TOKEN=***

# Added this session
LINEAR_API_KEY=***

# Already have (from previous Notion work)
NOTION_API_KEY=***
```

---

## Sync Rules (Control Panel = Source of Truth)

| Scenario | Resolution |
|----------|------------|
| Task created in Control Panel | Push to all configured providers |
| Task created externally | Pull to Control Panel, mark as synced |
| Task updated in Control Panel | Push changes to all providers |
| Task updated externally | Pull if no local changes; else, Control Panel wins |
| Conflict (both changed) | Control Panel version wins, log conflict |
| Task deleted in Control Panel | Close/delete on external providers |
| Task deleted externally | Mark as "externally deleted", keep in Control Panel |

---

## Semver Auto-Increment Logic

```typescript
function getNextVersion(current: string, type: 'major' | 'minor' | 'patch'): string {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
  }
}
```

---

## Estimated Timeline

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Schema & Foundation | 2-3 hours |
| 2 | Provider Clients | 4-5 hours |
| 3 | Sync Engine | 5-6 hours |
| 4 | tRPC Routers | 3-4 hours |
| 5 | Task Board UI | 6-8 hours |
| 6 | Release UI | 4-5 hours |
| 7 | Webhooks | 3-4 hours |
| **Total Web** | | **~28-35 hours** |
| 8 | Mobile (future) | 6-8 hours |

---

## Questions Before Starting

1. **Default sync providers?** Should new apps auto-enable sync with all providers, or require manual setup?

2. **Task statuses?** Proposed: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled`. Add more?

3. **Priority levels?** Proposed: `urgent`, `high`, `medium`, `low`. Match Linear's priority system?

4. **Start with Phase 1-3?** Get foundation + sync engine working before UI?
