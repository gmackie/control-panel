# Kubernetes Release Control Room Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `control-panel` into a candidate-centered release control room for supported app releases on staging and production by correlating ForgeGraph/JJ revisions, CI, Harbor images, GitOps promotion PRs, ArgoCD rollout state, Kubernetes verification, and incident signals into one trusted operator workflow.

**Architecture:** Build a normalized evidence ledger and release-candidate model in `packages/db`, ingest and reconcile signals in `apps/web`, expose candidate, policy, trust, and promotion state via tRPC in `packages/api`, and replace the current deployment dashboard with a release queue focused on readiness, blockers, inline promotion diff, audit trail, and assisted rollback.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC 11 RC, Drizzle ORM, Vitest, Playwright, existing ForgeGraph package, existing webhook event store, existing ArgoCD client, deployment repo Git integration

**Design doc:** `docs/plans/2026-03-17-k8s-cicd-coordination-design.md`

---

## Task 1: Add the release-control-room schema

**Files:**
- Create: `packages/db/drizzle/0013_release_control_room.sql`
- Modify: `packages/db/src/schema.ts`
- Create: `packages/shared/src/release-control.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/api/tests/release-queue-router.test.ts`

**Step 1: Write the failing test**

Create a router test that expects one queue item to include:

- candidate identity
- staging and production state
- blocker list
- promotion PR state
- trust flags

```typescript
import { describe, it, expect, vi } from "vitest";
import { appRouter } from "../src/routers";

describe("releaseQueue.list", () => {
  it("returns a candidate-centered queue item", async () => {
    const caller = appRouter.createCaller({
      db: { select: vi.fn() },
      userId: "user-1",
    } as any);

    await expect(caller.releaseQueue.list()).resolves.toEqual([
      expect.objectContaining({
        applicationSlug: "control-panel",
        forgeGraphRevId: "rev-123",
        queueState: "ready",
        blockers: expect.any(Array),
        promotionPrStatus: "open",
      }),
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/api test -- tests/release-queue-router.test.ts
```

Expected: FAIL because the release queue router and schema do not exist.

**Step 3: Write minimal implementation**

Add shared types in `packages/shared/src/release-control.ts`:

```typescript
export type ReleaseQueueState =
  | "building"
  | "ready"
  | "blocked"
  | "awaiting_approval"
  | "releasing"
  | "degraded";

export type BlockerSeverity = "hard" | "advisory";

export type PromotionPrStatus =
  | "requested"
  | "creating"
  | "open"
  | "merge_blocked"
  | "merged"
  | "failed"
  | "closed_unmerged"
  | "superseded";
```

Add these tables in `packages/db/src/schema.ts`:

- `releaseCandidates`
- `candidateEvidence`
- `environmentStates`
- `promotionPrs`
- `releasePolicies`
- `releaseOwners`
- `overrideRecords`
- `knownGoodReleases`
- `sourceHealth`

Minimum columns:

```typescript
export const releaseCandidates = pgTable("release_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  forgeGraphRepoId: varchar("forge_graph_repo_id", { length: 255 }).notNull(),
  forgeGraphRevId: varchar("forge_graph_rev_id", { length: 255 }).notNull(),
  jjChangeId: varchar("jj_change_id", { length: 255 }),
  gitSha: varchar("git_sha", { length: 255 }),
  branch: varchar("branch", { length: 255 }),
  ciRunId: varchar("ci_run_id", { length: 255 }),
  imageTag: text("image_tag"),
  imageDigest: text("image_digest"),
  queueState: varchar("queue_state", { length: 64 }).notNull().default("building"),
  readinessStatus: varchar("readiness_status", { length: 64 }).notNull().default("collecting"),
  supersedeStatus: varchar("supersede_status", { length: 64 }).notNull().default("current"),
  knownGoodStatus: varchar("known_good_status", { length: 64 }).notNull().default("unknown"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const promotionPrs = pgTable("promotion_prs", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").notNull().references(() => releaseCandidates.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  environment: varchar("environment", { length: 32 }).notNull(),
  repo: text("repo").notNull(),
  branch: varchar("branch", { length: 255 }).notNull(),
  prNumber: integer("pr_number"),
  headSha: varchar("head_sha", { length: 255 }),
  status: varchar("status", { length: 64 }).notNull().default("requested"),
  mergePolicy: varchar("merge_policy", { length: 64 }).notNull().default("human_gate"),
  openedBy: text("opened_by"),
  mergedBy: text("merged_by"),
  openedAt: timestamp("opened_at"),
  mergedAt: timestamp("merged_at"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Create the SQL migration with:

- unique candidate per `application_id + forge_graph_repo_id + forge_graph_rev_id`
- indexes on queue state, supersede state, known-good state, and promotion PR status

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/db db:generate
pnpm --filter @repo/db typecheck
pnpm --filter @repo/api test -- tests/release-queue-router.test.ts
```

Expected:

- Drizzle generates schema artifacts successfully
- `@repo/db` typecheck passes
- router test still fails until Task 5

**Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0013_release_control_room.sql packages/shared/src/release-control.ts packages/shared/src/index.ts packages/api/tests/release-queue-router.test.ts
git commit -m "feat(db): add release control room schema"
```

---

## Task 2: Build the evidence ledger and candidate assembler

**Files:**
- Create: `apps/web/src/lib/release-control/evidence-normalizer.ts`
- Create: `apps/web/src/lib/release-control/candidate-assembler.ts`
- Create: `apps/web/src/lib/release-control/evidence-ledger.ts`
- Test: `apps/web/tests/unit/release-candidate-assembler.test.ts`

**Step 1: Write the failing test**

Create a test that feeds ForgeGraph, Harbor, and staging ArgoCD evidence into the assembler and expects one candidate with complete identity and staging evidence.

```typescript
import { describe, it, expect } from "vitest";
import { assembleReleaseCandidate } from "@/lib/release-control/candidate-assembler";

describe("assembleReleaseCandidate", () => {
  it("builds a candidate from revision, image, and staging rollout evidence", () => {
    const candidate = assembleReleaseCandidate({
      forge: { repoId: "repo-1", revId: "rev-123" },
      artifact: { imageTag: "control-panel:rev-123", imageDigest: "sha256:test" },
      staging: { syncStatus: "Synced", healthStatus: "Healthy" },
    });

    expect(candidate.forgeGraphRevId).toBe("rev-123");
    expect(candidate.imageDigest).toBe("sha256:test");
    expect(candidate.queueState).toBe("ready");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/release-candidate-assembler.test.ts
```

Expected: FAIL because the assembler modules do not exist.

**Step 3: Write minimal implementation**

Create a normalized evidence shape:

```typescript
export interface CandidateEvidenceRecord {
  source: "forgegraph" | "gitea" | "harbor" | "argocd" | "prometheus" | "kubernetes";
  evidenceType: string;
  applicationId?: string;
  candidateId?: string;
  environment?: "staging" | "production";
  observedAt: Date;
  freshnessSeconds?: number;
  payload: Record<string, unknown>;
}
```

Create `candidate-assembler.ts` with:

- `assembleReleaseCandidate`
- `deriveCandidateQueueState`
- `deriveSupersedeStatus`
- `deriveKnownGoodStatus`

Important initial behavior:

- candidate is `building` if image is missing
- candidate is `ready` only when staging evidence is healthy and complete
- candidate is `blocked` when any hard blocker is attached

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/release-candidate-assembler.test.ts
pnpm --filter @repo/web typecheck
```

Expected: PASS and no type errors.

**Step 5: Commit**

```bash
git add apps/web/src/lib/release-control/evidence-normalizer.ts apps/web/src/lib/release-control/candidate-assembler.ts apps/web/src/lib/release-control/evidence-ledger.ts apps/web/tests/unit/release-candidate-assembler.test.ts
git commit -m "feat(web): add release candidate assembler and evidence ledger"
```

---

## Task 3: Add policy, blocker, and freshness evaluation

**Files:**
- Create: `apps/web/src/lib/release-control/policy-engine.ts`
- Create: `apps/web/src/lib/release-control/blocker-reasons.ts`
- Create: `apps/web/src/lib/release-control/source-trust.ts`
- Test: `apps/web/tests/unit/release-policy-engine.test.ts`

**Step 1: Write the failing test**

Create a test that expects stale ArgoCD evidence and an active production incident to produce one hard blocker and one advisory signal.

```typescript
import { describe, it, expect } from "vitest";
import { evaluateReleasePolicy } from "@/lib/release-control/policy-engine";

describe("evaluateReleasePolicy", () => {
  it("produces hard and advisory blockers with freshness rules", () => {
    const result = evaluateReleasePolicy({
      candidate: { queueState: "ready" } as any,
      sourceHealth: {
        argocd: { status: "stale", ageSeconds: 900 },
        prometheus: { status: "healthy", ageSeconds: 15 },
      },
      activeSignals: {
        hardIncidentCount: 1,
      },
    });

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "argocd_stale", severity: "hard" }),
        expect.objectContaining({ reason: "active_critical_incident", severity: "hard" }),
      ]),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/release-policy-engine.test.ts
```

Expected: FAIL because the policy engine does not exist.

**Step 3: Write minimal implementation**

Create structured blocker reasons:

```typescript
export type BlockerReason =
  | "missing_artifact"
  | "staging_unhealthy"
  | "argocd_stale"
  | "kubernetes_stale"
  | "active_critical_incident"
  | "promotion_pr_failed"
  | "verification_timeout"
  | "candidate_superseded";
```

Create `evaluateReleasePolicy()` that returns:

- `blockers`
- `advisories`
- `isPromotable`
- `requiresSecondApprover`
- `overrideEligibleReasons`

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/release-policy-engine.test.ts
pnpm --filter @repo/web typecheck
```

Expected: PASS and no type errors.

**Step 5: Commit**

```bash
git add apps/web/src/lib/release-control/policy-engine.ts apps/web/src/lib/release-control/blocker-reasons.ts apps/web/src/lib/release-control/source-trust.ts apps/web/tests/unit/release-policy-engine.test.ts
git commit -m "feat(web): add release policy and blocker evaluation"
```

---

## Task 4: Add built-in reconcilers and trust computation

**Files:**
- Create: `apps/web/src/lib/release-control/reconcilers/candidate-ingest-reconciler.ts`
- Create: `apps/web/src/lib/release-control/reconcilers/promotion-pr-reconciler.ts`
- Create: `apps/web/src/lib/release-control/reconcilers/argocd-rollout-reconciler.ts`
- Create: `apps/web/src/lib/release-control/reconcilers/source-freshness-reconciler.ts`
- Create: `apps/web/src/lib/release-control/reconcilers/known-good-evaluator.ts`
- Create: `apps/web/src/lib/release-control/reconcilers/rollback-suggestion-evaluator.ts`
- Test: `apps/web/tests/unit/source-trust-reconciler.test.ts`

**Step 1: Write the failing test**

Create a test that expects stale upstream evidence to flip the global trust banner into degraded mode.

```typescript
import { describe, it, expect } from "vitest";
import { computeControlRoomTrust } from "@/lib/release-control/reconcilers/source-freshness-reconciler";

describe("computeControlRoomTrust", () => {
  it("degrades trust when a critical source is stale", () => {
    const trust = computeControlRoomTrust({
      argocd: { status: "stale" },
      harbor: { status: "healthy" },
      prometheus: { status: "healthy" },
    } as any);

    expect(trust.overallStatus).toBe("degraded");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/source-trust-reconciler.test.ts
```

Expected: FAIL because the reconciler does not exist.

**Step 3: Write minimal implementation**

Implement the named reconcilers listed in the design doc.

All reconcilers should expose:

- `run()`
- `lastSuccessAt`
- `lastError`
- `metrics labels`

The first implementation can run in-process on an interval, but the plan must preserve a clean path to move them into workers later.

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/source-trust-reconciler.test.ts
pnpm --filter @repo/web typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/lib/release-control/reconcilers apps/web/tests/unit/source-trust-reconciler.test.ts
git commit -m "feat(web): add release control room reconcilers"
```

---

## Task 5: Expose the release queue, trust, policy, and audit routers

**Files:**
- Create: `packages/api/src/routers/release-queue.ts`
- Create: `packages/api/src/routers/release-candidates.ts`
- Create: `packages/api/src/routers/release-policies.ts`
- Create: `packages/api/src/routers/promotion-prs.ts`
- Create: `packages/api/src/routers/release-audit.ts`
- Create: `packages/api/src/routers/source-trust.ts`
- Modify: `packages/api/src/routers/index.ts`
- Test: `packages/api/tests/release-queue-router.test.ts`

**Step 1: Expand the failing test**

Extend the router test to cover:

- `releaseQueue.list()`
- `releaseCandidates.bySlug()`
- `promotionPrs.byCandidate()`
- `sourceTrust.summary()`
- `releaseAudit.byCandidate()`

```typescript
it("returns a trust summary alongside queue items", async () => {
  await expect(caller.sourceTrust.summary()).resolves.toEqual(
    expect.objectContaining({
      overallStatus: expect.stringMatching(/healthy|degraded|stale/),
    }),
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/api test -- tests/release-queue-router.test.ts
```

Expected: FAIL because the routers do not exist.

**Step 3: Write minimal implementation**

Create `release-queue.ts` to return candidate-centered queue rows:

- candidate identity
- queue state
- blocker cards
- staging and production summary
- promotion PR status
- latest known-good marker

Create `release-audit.ts` to return:

- approval snapshot
- override records
- blocker snapshot at approval time
- promotion PR timeline
- current live state

Register all routers in `packages/api/src/routers/index.ts`.

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/api test -- tests/release-queue-router.test.ts
pnpm --filter @repo/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api/src/routers/release-queue.ts packages/api/src/routers/release-candidates.ts packages/api/src/routers/release-policies.ts packages/api/src/routers/promotion-prs.ts packages/api/src/routers/release-audit.ts packages/api/src/routers/source-trust.ts packages/api/src/routers/index.ts packages/api/tests/release-queue-router.test.ts
git commit -m "feat(api): add release queue and audit routers"
```

---

## Task 6: Implement promotion PR generation and tracking

**Files:**
- Create: `apps/web/src/lib/release-control/promotion-pr-service.ts`
- Modify: `packages/api/src/routers/promotion-prs.ts`
- Test: `apps/web/tests/unit/promotion-pr-service.test.ts`

**Step 1: Write the failing test**

Create a test that expects approving a candidate to generate a deployment repo PR payload instead of directly mutating production state.

```typescript
import { describe, it, expect } from "vitest";
import { buildPromotionPullRequest } from "@/lib/release-control/promotion-pr-service";

describe("buildPromotionPullRequest", () => {
  it("creates a candidate-specific deployment repo diff request", () => {
    const pr = buildPromotionPullRequest({
      applicationSlug: "control-panel",
      environment: "production",
      imageDigest: "sha256:test",
      forgeGraphRevId: "rev-123",
    } as any);

    expect(pr.title).toContain("control-panel");
    expect(pr.body).toContain("rev-123");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/promotion-pr-service.test.ts
```

Expected: FAIL because the promotion PR service does not exist.

**Step 3: Write minimal implementation**

Create `promotion-pr-service.ts` with:

- `buildPromotionPullRequest()`
- `openPromotionPullRequest()`
- `syncPromotionPrStatus()`

Important initial behavior:

- one open production PR per candidate
- open PR marked `superseded` if a newer candidate is promoted
- candidate cannot auto-merge in v1 unless policy enables it later

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/promotion-pr-service.test.ts
pnpm --filter @repo/web typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/lib/release-control/promotion-pr-service.ts packages/api/src/routers/promotion-prs.ts apps/web/tests/unit/promotion-pr-service.test.ts
git commit -m "feat(web): add promotion pr generation and tracking"
```

---

## Task 7: Add release owner, approval, and override flows

**Files:**
- Modify: `packages/api/src/routers/release-policies.ts`
- Create: `apps/web/src/components/release-control/ApprovalPanel.tsx`
- Create: `apps/web/src/components/release-control/OverrideDialog.tsx`
- Create: `apps/web/tests/unit/release-approval-policy.test.ts`

**Step 1: Write the failing test**

Create a test that expects:

- one approver by default
- second approver requirement when policy says so
- override rejection when caller is not a release owner

```typescript
import { describe, it, expect } from "vitest";

describe("release approval policy", () => {
  it("requires an eligible override actor", async () => {
    await expect(
      requestOverride({
        candidateId: "candidate-1",
        blockerReason: "argocd_stale",
        userRole: "viewer",
      }),
    ).rejects.toThrow("override");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/release-approval-policy.test.ts
```

Expected: FAIL because policy-aware approval/override behavior is not implemented.

**Step 3: Write minimal implementation**

Add router mutations for:

- `approveCandidate`
- `requestSecondApproval`
- `requestOverride`
- `pinKnownGood`
- `unpinKnownGood`

Key validation rules:

- approver must belong to the app/environment release owner set
- override requires typed justification and ticket/incident link
- policy may require two distinct approvers
- approval snapshot must store the exact evidence seen at approval time

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/release-approval-policy.test.ts
pnpm --filter @repo/api typecheck
pnpm --filter @repo/web typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api/src/routers/release-policies.ts apps/web/src/components/release-control/ApprovalPanel.tsx apps/web/src/components/release-control/OverrideDialog.tsx apps/web/tests/unit/release-approval-policy.test.ts
git commit -m "feat(web): add release owner approval and override flows"
```

---

## Task 8: Replace the deployments dashboard with a candidate-centered release queue

**Files:**
- Modify: `apps/web/src/app/deployments/page.tsx`
- Create: `apps/web/src/components/release-control/ReleaseQueue.tsx`
- Create: `apps/web/src/components/release-control/ReleaseCandidateRow.tsx`
- Create: `apps/web/src/components/release-control/BlockerCards.tsx`
- Create: `apps/web/src/components/release-control/TrustBanner.tsx`
- Create: `apps/web/src/components/release-control/PromotionDiffPanel.tsx`
- Test: `apps/web/tests/e2e/release-queue.e2e.spec.ts`

**Step 1: Write the failing e2e test**

Create a Playwright test that expects:

- a queue of candidates
- global trust banner
- explicit blocker cards
- inline promotion diff

```typescript
import { test, expect } from "@playwright/test";

test("release queue shows candidate rows and trust banner", async ({ page }) => {
  await page.goto("/deployments");
  await expect(page.getByText(/Release Queue/i)).toBeVisible();
  await expect(page.getByText(/Trust/i)).toBeVisible();
  await expect(page.getByText(/ready|blocked|releasing/i)).toBeVisible();
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/web test:e2e -- tests/e2e/release-queue.e2e.spec.ts
```

Expected: FAIL because the page is still environment/dashboard-oriented.

**Step 3: Write minimal implementation**

Replace the old `AppOverviewCards`-centric layout with a release queue page that shows:

- queue filters by state
- candidate rows
- trust banner at top
- blocker cards on blocked rows
- inline promotion diff drawer
- next-action affordances

Preserve the current page shell where possible, but reframe the content around candidate rows rather than deployment statistics.

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/web test:e2e -- tests/e2e/release-queue.e2e.spec.ts
pnpm --filter @repo/web typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/deployments/page.tsx apps/web/src/components/release-control/ReleaseQueue.tsx apps/web/src/components/release-control/ReleaseCandidateRow.tsx apps/web/src/components/release-control/BlockerCards.tsx apps/web/src/components/release-control/TrustBanner.tsx apps/web/src/components/release-control/PromotionDiffPanel.tsx apps/web/tests/e2e/release-queue.e2e.spec.ts
git commit -m "feat(web): add candidate-centered release queue"
```

---

## Task 9: Add visible audit trail, probable-cause hints, and assisted rollback

**Files:**
- Create: `apps/web/src/components/release-control/ReleaseAuditTrail.tsx`
- Create: `apps/web/src/components/release-control/IncidentHints.tsx`
- Create: `apps/web/src/components/release-control/RollbackAssistant.tsx`
- Create: `apps/web/src/lib/release-control/rollback-service.ts`
- Create: `apps/web/tests/unit/rollback-service.test.ts`

**Step 1: Write the failing test**

Create a test that expects rollback assistance to suggest the last known-good candidate and require explicit human confirmation.

```typescript
import { describe, it, expect } from "vitest";
import { suggestRollbackTarget } from "@/lib/release-control/rollback-service";

describe("suggestRollbackTarget", () => {
  it("returns the last known-good production candidate", () => {
    const target = suggestRollbackTarget([
      { id: "c1", knownGoodStatus: "known_good", createdAt: new Date("2026-03-16") },
      { id: "c2", knownGoodStatus: "unknown", createdAt: new Date("2026-03-17") },
    ] as any);

    expect(target?.id).toBe("c1");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/rollback-service.test.ts
```

Expected: FAIL because the rollback service does not exist.

**Step 3: Write minimal implementation**

Create UI and service support for:

- visible approval and override snapshots
- current live state beside historical evidence
- probable-cause hints for degraded releases
- rollback suggestion panel
- rollback PR generation after confirmation

Important behavior:

- rollback remains human-confirmed in v1
- probable-cause hints are heuristic and clearly labeled as such

**Step 4: Run verification**

Run:

```bash
pnpm --filter @repo/web test -- tests/unit/rollback-service.test.ts
pnpm --filter @repo/web typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/release-control/ReleaseAuditTrail.tsx apps/web/src/components/release-control/IncidentHints.tsx apps/web/src/components/release-control/RollbackAssistant.tsx apps/web/src/lib/release-control/rollback-service.ts apps/web/tests/unit/rollback-service.test.ts
git commit -m "feat(web): add audit trail and assisted rollback"
```

---

## Task 10: Add role-aware notifications and operational docs

**Files:**
- Create: `apps/web/src/lib/release-control/notification-triggers.ts`
- Create: `docs/ops/release-control-room-onboarding.md`
- Create: `docs/ops/release-control-room-operations.md`
- Create: `docs/ops/release-control-room-debugging.md`
- Modify: `DEPLOYMENT.md`

**Step 1: Write the docs checklist**

Document:

- how to onboard one app into the release control room
- required app metadata and deployment repo wiring
- release owner and policy setup
- promotion flow
- supersede behavior
- rollback flow
- source trust degradation and stale evidence handling

**Step 2: Implement role-aware notification triggers**

Add notification hooks for:

- candidate becomes ready
- candidate becomes blocked
- candidate awaits approval
- promotion PR merged
- release degraded
- candidate superseded

Notifications should deep-link into the exact control-room view, not execute remote actions.

**Step 3: Run verification**

Run:

```bash
rg -n "TODO|TBD" docs/ops/release-control-room-onboarding.md docs/ops/release-control-room-operations.md docs/ops/release-control-room-debugging.md DEPLOYMENT.md
pnpm --filter @repo/web typecheck
```

Expected: no placeholder docs text and no type errors from new notification trigger wiring.

**Step 4: Commit**

```bash
git add apps/web/src/lib/release-control/notification-triggers.ts docs/ops/release-control-room-onboarding.md docs/ops/release-control-room-operations.md docs/ops/release-control-room-debugging.md DEPLOYMENT.md
git commit -m "docs: add release control room operations and onboarding"
```

---

## Delivery Phases

### Phase 1: Control-room backbone

Complete Tasks 1 through 5 first.

Outcome:

- release candidates exist
- blockers and trust are modeled
- queue API exists

### Phase 2: Promotion and governance

Complete Tasks 6 and 7 next.

Outcome:

- promotion PRs are first-class
- approvals, overrides, and known-good records are real

### Phase 3: Operator experience

Complete Tasks 8 through 10.

Outcome:

- release queue is live
- audit trail and rollback guidance exist
- notifications and runbooks are in place

## Verification Checklist

Run this before calling the control room ready:

```bash
pnpm --filter @repo/db typecheck
pnpm --filter @repo/api test -- tests/release-queue-router.test.ts
pnpm --filter @repo/api typecheck
pnpm --filter @repo/web test -- tests/unit/release-candidate-assembler.test.ts tests/unit/release-policy-engine.test.ts tests/unit/source-trust-reconciler.test.ts tests/unit/promotion-pr-service.test.ts tests/unit/release-approval-policy.test.ts tests/unit/rollback-service.test.ts tests/unit/prometheus-webhook.test.ts
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web test:e2e -- tests/e2e/release-queue.e2e.spec.ts
```

Expected outcomes:

- queue items are candidate-centered and explainable
- blockers are explicit and policy-aware
- source trust degrades visibly when evidence is stale
- production promotion creates auditable deployment repo PRs
- rollback suggestions point to known-good candidates
- releasers can drive the whole app-release flow from the control room

## Rollout Sequence

1. Seed one pilot app with release owners, policy, and deployment repo wiring.
2. Enable candidate assembly and trust computation in staging only.
3. Launch the release queue for that pilot app.
4. Enable promotion PR generation for staging and then production.
5. Add audit trail and rollback assistance.
6. Onboard the next supported apps one by one.

Plan complete and saved to `docs/plans/2026-03-17-k8s-cicd-coordination-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
