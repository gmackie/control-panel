# Application Editing & Resource Management Design

**Date:** 2026-01-19
**Status:** Approved

## Overview

Enable full editing of applications including inline name/description editing, comprehensive resource linking, and application deletion with confirmation.

## 1. Inline Header Editing

The application header will support inline editing for name and description.

### Interaction
- Hover over name/description shows subtle pencil icon
- Click to switch to edit mode with auto-focused input
- Enter to save, Escape to cancel, click away to save
- Optimistic updates with rollback on error

### Implementation
- New `EditableText` component for the inline edit pattern
- Uses existing mutation pattern from ApplicationSettings
- Toast notifications for success/failure

### Visual States
- **Default:** Normal text with hover hint
- **Hover:** Pencil icon appears, subtle underline
- **Editing:** Input field with subtle border
- **Saving:** Brief loading indicator
- **Error:** Red border, error tooltip

## 2. Resource Linking in Settings Tab

Expand the Settings tab to link all resource types.

### Resource Sections (in order)
1. **Git Repository** - Gitea OR GitHub (mutually exclusive)
2. **Container Registry** - Harbor
3. **Kubernetes Deployment** - K8s/K3s
4. **Vercel Project** - For Vercel-deployed apps
5. **Expo Project** - For mobile apps
6. **Database: Neon** - PostgreSQL
7. **Database: Turso** - SQLite/LibSQL

### UI Pattern (consistent across all)
- Header with icon, resource type, "Link"/"Change" button
- Linked state: Resource name, details, external link, "Unlink" button
- Unlinked state: "No [resource] linked" placeholder

### Link Dialog
- Fetches available resources from respective API
- Searchable list for many items
- Click to select and link
- Loading state while fetching

### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /api/vercel/projects` | List Vercel projects |
| `GET /api/expo/projects` | List Expo projects |
| `GET /api/neon/projects` | List Neon databases |
| `GET /api/turso/databases` | List Turso databases |
| `GET /api/gitea/repos` | List Gitea repos (exists) |
| `GET /api/github/repos` | List GitHub repos |
| `GET /api/harbor/repos` | List Harbor repos (exists) |
| `GET /api/k8s/deployments` | List K8s deployments (exists) |

## 3. Delete Application

Hard delete with name confirmation.

### Delete Flow
1. Click "Delete" in Danger Zone section
2. Confirmation dialog opens:
   - Warning icon with red styling
   - Message explaining what will be deleted
   - Note that linked resources won't be deleted
   - Input: "Type **{app name}** to confirm"
   - Cancel and Delete buttons
3. Delete button disabled until name matches exactly
4. On confirm: Loading state, call DELETE endpoint
5. On success: Redirect to `/applications` with toast
6. On error: Show error in dialog

### What Gets Deleted (cascading)
- Application record
- Tasks, task comments, task activity
- Releases, release assets
- App integrations
- Secrets (DB records, not K8s secrets)
- Activity events

### What Does NOT Get Deleted
- Linked K8s deployments
- Linked Vercel/Expo projects
- Linked databases (Neon/Turso)
- Container registry images

## 4. API Layer

### New Route: `/api/applications/[id]/route.ts`

| Method | Purpose |
|--------|---------|
| GET | Fetch single application |
| PATCH | Update application fields |
| DELETE | Delete with cascading cleanup |

### PATCH Request Body Examples

```typescript
// Update name/description
{ name: "New Name", description: "Updated desc" }

// Link Vercel project
{ vercelProjectId: "prj_xxx" }

// Link Neon database
{ neonProjectId: "uuid-here" }

// Unlink resource
{ vercelProjectId: null }
```

### Database Considerations

**Direct columns on `applications` table:**
- `vercel_project_id`
- `expo_project_id`

**Linking via tracking tables (update `applicationId` FK):**
- `neonProjects.applicationId`
- `tursoDatabases.applicationId`
- `githubRepositories.applicationId`
- `giteaRepositories.applicationId`

### Validation
- Name: required, non-empty, max 100 chars
- Slug: must be unique, auto-generate or validate custom
- Resource IDs: must exist in respective tables

## Implementation Order

1. Create `/api/applications/[id]` route (PATCH, DELETE)
2. Create `EditableText` component
3. Add inline editing to application header
4. Wire up delete confirmation dialog
5. Add new resource sections to Settings tab (Vercel, Expo, Neon, Turso, GitHub)
6. Create missing API endpoints for resource listing

## Future Enhancements (Out of Scope)
- Delete with cleanup options (delete linked K8s deployments, etc.)
- Bulk resource linking
- Resource auto-discovery
