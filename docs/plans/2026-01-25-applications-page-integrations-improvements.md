# Applications Page + Per-App Integrations Improvements

Date: 2026-01-25
Owner: GMAC Control Panel
Scope: `apps/web` (Next.js App Router)

## Why
The current `/applications` experience is card-only and lacks search/filter/grouping. Per-app integrations also have broken/duplicated flows due to API shape mismatches and missing components.

## Primary Goals

### A) Improve `/applications`
- Toggle between Card and List views.
- Group applications by Product (based on `applications.productId`).
- Filter by Product (and optionally status/providers if useful).
- Add a search bar that filters locally (name/slug/description, optionally repo fields).

### B) Fix per-application integrations (in app settings/details)
- Ensure the Integrations surface works reliably for a single app.
- Consolidate on a single source of truth for app integrations: `app_integrations` via `GET/POST/DELETE /api/applications/:id/integrations`.
- Remove or rewire legacy flows that do not map to the DB-backed integrations model.

## Non-goals
- No new major dependencies.
- No schema migrations unless absolutely required.
- No broad rewrite of the "unified app" data model (`/api/apps/...`) beyond fixing the Integrations tab behavior.

## Current State (Repo Evidence)

### Applications list
- UI: `apps/web/src/app/applications/page.tsx`
  - Fetches `/api/applications` and renders a card grid.
  - Assumes `Application` shape from `apps/web/src/types/applications.ts` (uses `app.settings.environment`, `app.apiKeys.length`, `app.secrets.length`).
- API: `apps/web/src/app/api/applications/route.ts`
  - DB-backed list returns a simplified array with hardcoded `settings.environment = 'development'` and empty arrays for apiKeys/secrets/integrations.
  - Does not currently include `productId` even though schema supports it.

### Products (grouping dimension)
- DB: `packages/db/src/schema.ts` has `applications.productId` and a `products` table.
- API: `apps/web/src/app/api/products/route.ts` supports `GET /api/products` and `GET /api/products?includeApps=true`.
- UI: `apps/web/src/app/products/page.tsx` uses `/api/products?includeApps=true` for product management.

### Per-app integrations (broken in app details)
- App details: `apps/web/src/app/applications/[id]/page.tsx`
  - Integrations tab uses `IntegrationsList`.
- Integrations tab component: `apps/web/src/components/applications/IntegrationsList.tsx`
  - Calls `/api/applications/:id` but does not unwrap `{ success, data }`.
  - Expects `application.integrations`, but `/api/applications/:id` does not include integrations.
  - Imports `./LinkIntegrationModal` and `./IntegrationDetailSheet`, but these files are not present under `apps/web/src/components/applications/`.
- App endpoint: `apps/web/src/app/api/applications/[id]/route.ts`
  - Returns `{ success, data }` with application row only.
- App integrations endpoint: `apps/web/src/app/api/applications/[id]/integrations/route.ts`
  - Correctly reads/writes `app_integrations` and returns a UI-ready array via `transformIntegrationForUI()`.
  - Provider allowlist (`APP_PROVIDERS`) is missing providers used by UI templates/pages (notably `neon`, `turso`).
- Dedicated per-app integrations page: `apps/web/src/app/applications/[id]/integrations/page.tsx`
  - Uses `/api/applications/:id/integrations` and already has provider-specific forms.

## Brainstorming (Options + Tradeoffs)

### `/applications` UX
1) "Toolbar" controls (recommended)
   - View toggle (cards/list), search input, filters dropdown, and applied filter chips.
   - Persist view mode in query params and/or localStorage.
2) "Left rail" grouping
   - Product list in a sidebar; main panel shows apps in selected group.
   - Heavier layout change; better for lots of products.

### `/applications` UX (Concrete interaction spec)

#### Toolbar layout (desktop)
- Left: page title + count (optional) + quick context (e.g., "X apps").
- Center: search input (primary control).
- Right: view toggle (cards/list), Filters dropdown, and any existing CTAs (Create/Import).

#### Toolbar layout (mobile)
- First row: search input full width.
- Second row: view toggle + Filters (and optionally a compact product chip selector).

#### Search behavior
- Filters locally (no network), applied to name/slug/description; optionally include repository fields.
- Debounce input updates (lightweight) to keep large lists smooth.
- `Esc` clears search when focused.
- Show a clear (X) affordance when query is non-empty.

#### View toggle behavior
- Two-state control: `cards` and `list`.
- Persist view mode (see Persistence).
- Must not change current filters/search when toggling.

#### Filtering behavior
- Minimum viable: Product filter with 3 modes:
  - All
  - Unassigned (apps with `productId == null`)
  - Specific Product (by id)
- Optional filters (only if we already display the fields reliably in `/api/applications` list response):
  - Status (active/inactive/archived)
  - Providers (git/deploy/db)
- Render active filters as removable chips + a single "Clear all" action.

#### Grouping behavior
- Default grouping: Group by Product name.
- Always include an "Unassigned" group when any apps have no product.
- Groups are collapsible; default expanded.
- Group header shows product name and count.
- Product filter and grouping must compose:
  - If a specific product filter is set, show only that group.
  - If "Unassigned" filter is set, show only Unassigned group.

#### Sorting rules
- Group order: products alpha by name, with Unassigned last (or first; pick one and keep consistent).
- Within group: alpha by app name (or existing ordering from API if meaningful).

#### Empty states
- No apps at all: existing "No applications" empty state.
- Has apps but no matches: distinct "No matches" state with actions:
  - Clear filters
  - Clear search

### Per-app integrations UX
1) Single source of truth UI (recommended)
   - Treat `apps/web/src/app/applications/[id]/integrations/page.tsx` as the editor.
   - Make the app-details Integrations tab reuse the same data contract and either:
     - embed the page-level component(s), or
     - link to the dedicated page.
2) Expand `/api/applications/:id` to inline integrations
   - Adds a second place to keep integration shape consistent.
   - Higher risk of divergence; only do if a single endpoint is required elsewhere.

Decision: Use a shared "ApplicationIntegrationsPanel" UI that powers BOTH:
- App details tab (inside `apps/web/src/app/applications/[id]/page.tsx`)
- Dedicated integrations editor page (`apps/web/src/app/applications/[id]/integrations/page.tsx`)

This keeps `/api/applications/:id/integrations` as the single data source while making "Integrations" work where users expect it (inside the application page/settings).

Implementation note:
- Do NOT implement `apps/web/src/components/applications/LinkIntegrationModal.tsx` or `apps/web/src/components/applications/IntegrationDetailSheet.tsx`.
- Replace/remove `apps/web/src/components/applications/IntegrationsList.tsx` (currently imports missing components and depends on the wrong API shape).
- Reuse the existing editor patterns already present in `apps/web/src/app/applications/[id]/integrations/page.tsx` and `apps/web/src/components/integrations/*`.

## Persistence (Proposed)
Decision: Use URL query params for all interactive state that materially changes the list, plus localStorage for the default view mode.

- URL params (shareable + back/forward correct)
  - `view`: `cards` | `list` (default derived from localStorage; if param present, it wins)
  - `q`: search query
  - `product`: `all` | `unassigned` | `<productId>`
  - (Optional later) `status`, `git`, `deploy`, `db`
- localStorage
  - `applications.view`: persisted default view when URL param is absent

Rules:
- Changing view/search/product updates the URL via router (no full reload).
- Clearing state removes params instead of leaving empty values.
- Opening `/applications` with no params uses the stored default view.

## Proposed Approach (Recommended)

### A) `/applications`: client-side view model + Product-based grouping
1) Extend `/api/applications` list items to include `productId` (additive).
2) Fetch `/api/products` (no apps; `includeApps=false`) on the page to build:
   - product filter dropdown
   - grouping labels
3) Compute derived list:
   - Apply search -> filters -> grouping -> render.
4) Implement List view as a compact row layout (reusing existing `Card` + utility classes; optionally `Table` components if already used).

### B) Integrations: consolidate on `/api/applications/:id/integrations`
1) Fix `IntegrationsList` to stop depending on `/api/applications/:id` for integrations.
2) Resolve missing components:
   - Either implement `LinkIntegrationModal` + `IntegrationDetailSheet`, or
   - Remove/replace `IntegrationsList` with a thin wrapper around the dedicated integrations page or a link-out.
3) Align provider allowlist with templates/forms:
   - Update `APP_PROVIDERS` in `apps/web/src/app/api/applications/[id]/integrations/route.ts` to include providers used in `apps/web/src/types/applications.ts` and the per-app integrations page.
4) Ensure all POST callers send `{ credentials }` (not `{ secrets }`).
   - Audit `apps/web/src/components/applications/AddIntegrationModal.tsx` and either rewire it or deprecate it.

## Detailed Task Breakdown (Implementation Order)

### Phase 0: Confirm scope + remove ambiguity
1) Decide whether the app-details Integrations tab should embed editor UI or link-out to `/applications/:id/integrations`.
2) Decide what to do with `apps/web/src/components/applications/AddIntegrationModal.tsx` (rewire to DB-backed credentials OR remove from user flow).
3) Decide whether view-mode persistence uses URL query params, localStorage, or both.

### Phase 1: Enable Product grouping data
4) Add `productId` to `/api/applications` response (`apps/web/src/app/api/applications/route.ts`).
5) Verify `/api/products` list provides enough info for grouping (`apps/web/src/app/api/products/route.ts`).

### Phase 2: `/applications` UI improvements
6) Add toolbar UI (search + view toggle + filters dropdown) in `apps/web/src/app/applications/page.tsx`.
   - Reuse patterns from:
     - `apps/web/src/components/monitoring/RealTimeMetrics.tsx` (view toggle)
     - `apps/web/src/components/monitoring/CustomDashboards.tsx` (search input + category filter)
     - `apps/web/src/components/tasks/TaskFilters.tsx` (search + clear + active filters)
7) Implement filtering:
   - Product filter: all/unassigned/specific product.
   - (Optional) provider filters: gitProvider/deployProvider/dbProvider.
8) Implement grouping:
   - Group by product name + include "Unassigned".
9) Implement List view renderer and ensure parity with Cards (name, slug, providers, links).
10) Add empty states:
   - "No applications yet" (existing)
   - "No matches" when filters/search are active.
11) Persist view mode and (optionally) filters.

### Phase 3: Integrations fix
12) Fix/replace `apps/web/src/components/applications/IntegrationsList.tsx`:
   - Use `/api/applications/:id/integrations` for integrations list.
   - Do not assume `Application` includes integrations.
13) Resolve missing imports:
   - Remove usage or implement missing `LinkIntegrationModal` and `IntegrationDetailSheet`.
14) Fix provider allowlist:
   - Update `APP_PROVIDERS` in `apps/web/src/app/api/applications/[id]/integrations/route.ts` to include providers used by UI (`neon`, `turso`, etc.).
15) Fix POST payload mismatch:
   - Ensure any UI that calls `/api/applications/:id/integrations` uses `{ credentials }`, not `{ secrets }`.
16) (Optional but recommended) Add a safe merge strategy for credentials updates:
   - Avoid wiping credentials if UI sends partial updates.
   - Keep API from ever returning secret values.

## Test Plan

### Commands
- `pnpm lint`
- `pnpm build`
- `pnpm dev`

### Manual verification

#### `/applications`
- Toggle cards/list; refresh; confirm persistence.
- Search by name/slug; confirm filtered results and "no matches" state.
- Filter by Product (including "Unassigned"); confirm grouping.
- Confirm create/import wizards still function.

#### Per-app integrations
- Open `/applications/:id` and verify Integrations tab loads without runtime errors.
- Open `/applications/:id/integrations` and verify GET/POST flows still work.
- Attempt to configure a provider that previously failed due to allowlist mismatch (e.g., `neon` or `turso`).

## Risks + Mitigations
- Risk: API contract drift between endpoints.
  - Mitigation: keep `/api/applications/:id/integrations` as the only integration source; avoid inlining integrations into `/api/applications/:id` unless necessary.
- Risk: Credentials update overwrites existing values.
  - Mitigation: implement merge semantics in API or require UI to submit full credentials set.
- Risk: Missing components cause build/runtime errors.
  - Mitigation: remove/replace broken imports before feature work.

## Agent Recommendations (for implementation)
- UI work: `delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"])`
- Data/API consistency and integration flows: `delegate_task(category="ultrabrain", load_skills=["frontend-ui-ux"])`
- Post-implementation review: `delegate_task(subagent_type="oracle", load_skills=["frontend-ui-ux"])`
