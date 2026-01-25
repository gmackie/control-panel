# Control Panel Genericization Plan

> **Project Start**: January 2026  
> **Target Completion**: March 2026 (12 weeks)  
> **Status**: Phase 1 & 2 Complete - Phase 3 In Progress  

## Overview

Transform the GMAC.IO Control Panel from a bespoke internal tool into a generic, self-hostable application lifecycle management platform.

### Goals

1. **Provider Agnostic**: Support GitHub/Gitea/GitLab, Vercel/K8s, Neon/Turso
2. **Template System**: Create apps from templates with modular integrations
3. **Clean UI/UX**: Generic dashboard suitable for any organization
4. **Self-Hostable**: Easy deployment for other developers/teams

### Related Documents

- [Design Document](./GENERICIZATION_DESIGN.md) - Architecture decisions, system design, UI/UX specs
- [Implementation Tasks](./IMPLEMENTATION_TASKS.md) - Detailed task breakdown with estimates

---

## Timeline

```
Week 1-3   [████████████████████████████████████] Phase 1: Foundation ✅ COMPLETE
Week 4-5   [████████████████████████████████████] Phase 2: Template ✅ COMPLETE
Week 6-8   [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Phase 3: UI/UX ← CURRENT
Week 9-10  [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Phase 4: Migration
```

---

## Phase 1: Foundation (Weeks 1-3)

**Goal**: Provider abstraction layer without breaking existing functionality

### Week 1: Provider Interfaces & Core Adapters

- [x] **1.1** Define provider interfaces (Git, Deploy, DB, Integration)
  - Files: `packages/api/src/providers/{git,deploy,database}/index.ts`
  - Estimate: 1 day

- [x] **1.2** Implement GitHub adapter
  - Files: `packages/api/src/providers/git/adapters/github.ts`
  - Estimate: 2 days
  - Dependencies: 1.1

- [x] **1.3** Implement Vercel adapter
  - Files: `packages/api/src/providers/deploy/adapters/vercel.ts`
  - Estimate: 2 days
  - Dependencies: 1.1

### Week 2: Existing Provider Refactoring

- [x] **1.4** Refactor Gitea into adapter
  - Files: `packages/api/src/providers/git/adapters/gitea.ts`
  - Move from: `apps/web/src/lib/gitea/`
  - Estimate: 2 days
  - Dependencies: 1.1

- [x] **1.5** Refactor K8s into adapter
  - Files: `packages/api/src/providers/deploy/adapters/kubernetes.ts`
  - Move from: `apps/web/src/lib/cluster/`
  - Estimate: 3 days
  - Dependencies: 1.1

- [x] **1.6** Implement Neon adapter
  - Files: `packages/api/src/providers/database/adapters/neon.ts`
  - Estimate: 1 day
  - Dependencies: 1.1

### Week 3: Integration & Testing

- [x] **1.7** Create provider registry
  - Files: `packages/api/src/providers/registry.ts`
  - Estimate: 1 day
  - Dependencies: 1.2-1.6

- [x] **1.8** Add provider fields to database schema
  - Files: `packages/db/src/schema.ts`
  - Add: `gitProvider`, `deployProvider`, `dbProvider` to applications
  - Estimate: 0.5 days
  - Dependencies: 1.7

- [x] **1.9** Update tRPC routers to use providers
  - Files: `packages/api/src/routers/{applications,deployments,integrations}.ts`
  - Estimate: 2 days
  - Dependencies: 1.7, 1.8

- [x] **1.10** Update MCP tools
  - Files: `packages/mcp-server/src/tools/*.ts`
  - Estimate: 1.5 days
  - Dependencies: 1.9

- [x] **1.11** End-to-end testing
  - Test GitHub+Vercel flow
  - Test Gitea+K8s flow (existing)
  - Estimate: 1 day
  - Dependencies: All above

**Phase 1 Total: 17 days**

---

## Phase 2: Template Enhancement (Weeks 4-5)

**Goal**: Modular template system with control panel integration

### Week 4: Template Metadata & Modules

- [x] **2.1** Create template metadata structure
  - Files (template repo): `.template/{config.json,placeholders.json}`
  - Estimate: 1 day

- [x] **2.2** Define placeholder convention
  - Files (template repo): `.template/placeholders.json`
  - Placeholders: `{{APP_NAME}}`, `{{APP_SLUG}}`, `{{PACKAGE_SCOPE}}`
  - Estimate: 0.5 days
  - Dependencies: 2.1

- [x] **2.3** Create integration module configs
  - Files (template repo): `.template/integrations/{clerk,stripe,posthog,sentry,neon}.json`
  - Estimate: 2 days
  - Dependencies: 2.1

- [x] **2.4** Enhance setup.sh script
  - Files (template repo): `scripts/setup.sh`
  - Add: module selection, placeholder engine, non-interactive mode
  - Estimate: 1 day
  - Dependencies: 2.1-2.3

### Week 5: Control Panel Integration

- [x] **2.5** Build template instantiation API
  - Files: `packages/api/src/routers/templates.ts`
  - Procedures: `list`, `get`, `instantiate`
  - Estimate: 2 days
  - Dependencies: 2.1-2.4

- [x] **2.6** Build integration provisioning service
  - Files: `packages/api/src/lib/provisioning/{index,neon,clerk,vercel,stripe}.ts`
  - Estimate: 2 days
  - Dependencies: 2.5

- [x] **2.7** Add control panel registration to template
  - Files (template repo): `scripts/register.sh`
  - Estimate: 1 day
  - Dependencies: 2.5

- [x] **2.8** End-to-end app creation testing
  - Test: CLI setup → control panel registration
  - Test: Control panel wizard → repo creation → deployment
  - Estimate: 1 day
  - Dependencies: All above

**Phase 2 Total: 10.5 days**

---

## Phase 3: UI/UX Overhaul (Weeks 6-8)

**Goal**: Clean, generic dashboard UI

### Week 6: Design System & Components

- [ ] **3.1** Design system audit & token definition
  - Files: `apps/web/src/styles/tokens.css`, `packages/ui/`
  - Define: colors, spacing, typography, shadows
  - Estimate: 1.5 days

- [ ] **3.2** Create core UI components
  - Files: `packages/ui/src/components/{Button,Card,Input,Badge,Skeleton,EmptyState}/*`
  - Estimate: 2 days
  - Dependencies: 3.1

- [ ] **3.3** Create data display components
  - Files: `packages/ui/src/components/{DataTable,StatCard,StatusIndicator,Timeline}/*`
  - Estimate: 1.5 days
  - Dependencies: 3.2

### Week 7: Core Pages

- [ ] **3.4** Implement Create App Wizard
  - Files: `apps/web/src/app/applications/new/*`
  - Steps: Basics → Integrations → Git/Deploy → Review
  - Estimate: 3 days
  - Dependencies: 2.5, 3.2

- [ ] **3.5** Redesign Applications List page
  - Files: `apps/web/src/app/applications/page.tsx`
  - Add: grid/list toggle, filters, health indicators
  - Estimate: 2 days
  - Dependencies: 3.2, 3.3

- [ ] **3.6** Redesign Application Detail page
  - Files: `apps/web/src/app/applications/[id]/*`
  - Tabs: Overview, Deployments, Integrations, Secrets, Settings
  - Estimate: 3 days
  - Dependencies: 3.2, 3.3

### Week 8: Supporting Pages & Polish

- [ ] **3.7** Environment variable management UI
  - Files: `apps/web/src/app/applications/[id]/secrets/*`
  - Features: add/edit/delete, bulk import, masking, sync status
  - Estimate: 2 days
  - Dependencies: 3.6

- [ ] **3.8** Resource linking UI
  - Files: `apps/web/src/app/applications/[id]/integrations/*`
  - Features: link modal, provider discovery, unlink
  - Estimate: 1.5 days
  - Dependencies: 3.6

- [ ] **3.9** Mobile responsiveness pass
  - All pages work on 375px viewport
  - Estimate: 1.5 days
  - Dependencies: 3.4-3.8

- [ ] **3.10** Accessibility audit & fixes
  - Run axe/lighthouse, fix issues
  - Estimate: 1.5 days
  - Dependencies: 3.4-3.8

- [ ] **3.11** Dashboard redesign
  - Files: `apps/web/src/app/page.tsx`
  - Simplified layout, key metrics, recent activity
  - Estimate: 1 day
  - Dependencies: 3.2, 3.3

**Phase 3 Total: 20.5 days**

---

## Phase 4: Migration & Documentation (Weeks 9-10)

**Goal**: Migrate existing apps, comprehensive documentation

### Week 9: Migration

- [ ] **4.1** Create migration script
  - Files: `scripts/migrate-existing-apps.ts`
  - Features: dry-run mode, rollback, report generation
  - Estimate: 2 days

- [ ] **4.2** Staging migration test
  - Run dry-run, test 2-3 apps
  - Estimate: 1 day
  - Dependencies: 4.1

- [ ] **4.3** Production migration
  - Migrate all 22 applications
  - Estimate: 1 day
  - Dependencies: 4.2

- [ ] **4.4** Provider data backfill
  - Sync GitHub repos, Vercel projects
  - Estimate: 1 day
  - Dependencies: 4.3

### Week 10: Documentation

- [ ] **4.5** User documentation
  - Files: `docs/{getting-started,creating-applications,managing-deployments,environment-variables}.md`
  - Estimate: 2 days

- [ ] **4.6** Deployment guide
  - Files: `docs/deployment/{vercel,kubernetes,docker,configuration}.md`
  - Estimate: 1.5 days

- [ ] **4.7** API documentation
  - Files: `docs/api/{overview,authentication,endpoints}.md`
  - Estimate: 1 day

- [ ] **4.8** Template documentation
  - Files (template repo): `docs/{customization,adding-integrations,deployment}.md`
  - Estimate: 1 day

- [ ] **4.9** Video walkthrough
  - 5-minute demo video
  - Estimate: 0.5 days

- [ ] **4.10** Final review & launch
  - Review all docs, update README, changelog
  - Estimate: 1 day
  - Dependencies: All above

**Phase 4 Total: 12 days**

---

## Total Effort

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Foundation | 17 days | Not Started |
| Phase 2: Template | 10.5 days | Not Started |
| Phase 3: UI/UX | 20.5 days | Not Started |
| Phase 4: Migration | 12 days | Not Started |
| **Total** | **60 days** | |

---

## Key Decisions Summary

| Area | Decision | Rationale |
|------|----------|-----------|
| **Default Git** | GitHub | Most users, best ecosystem |
| **Default Deploy** | Vercel | Zero-config, preview deployments |
| **Default Database** | Neon | Serverless Postgres, generous free tier |
| **Default Auth** | Clerk | Best UX, managed service |
| **Template Approach** | Modular | Enable/disable integrations as needed |
| **Migration Strategy** | Adapter pattern | Keep existing Gitea/K8s working |

---

## Getting Started

To begin implementation:

1. **Start with Task 1.1**: Define provider interfaces
   ```bash
   mkdir -p packages/api/src/providers/{git,deploy,database}
   ```

2. **Parallel track**: Start template metadata (Task 2.1) in template repo
   ```bash
   cd ../vercel-neon-expo-template
   mkdir -p .template/integrations
   ```

3. **Track progress**: Update checkboxes in this file as tasks complete

---

## Notes

- All estimates assume single developer working full-time
- Parallelization possible across phases (see Implementation Tasks doc)
- UI tasks can be delegated to frontend-ui-ux-engineer agent
- Migration has rollback plan if issues discovered
