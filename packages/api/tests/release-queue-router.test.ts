import { describe, it, expect, vi } from "vitest";
import { appRouter } from "../src/routers/index.js";

function createMockDb(...resolvedValues: any[]) {
  const queue = [...resolvedValues];

  const createChain = (): any => ({
    select: vi.fn(() => createChain()),
    from: vi.fn(() => createChain()),
    leftJoin: vi.fn(() => createChain()),
    innerJoin: vi.fn(() => createChain()),
    where: vi.fn(() => createChain()),
    orderBy: vi.fn(() => createChain()),
    limit: vi.fn(() => createChain()),
    offset: vi.fn(() => createChain()),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? []).then(resolve),
  });

  return createChain();
}

describe("releaseQueue.list", () => {
  it("returns a candidate-centered queue item", async () => {
    const db = createMockDb([
      {
        candidateId: "candidate-1",
        applicationId: "app-1",
        applicationSlug: "control-panel",
        forgeGraphRepoId: "repo-1",
        forgeGraphRevId: "rev-123",
        queueState: "ready",
        imageTag: "control-panel:rev-123",
        imageDigest: "sha256:test",
        promotionPrStatus: "open",
        promotionPrNumber: 42,
        desiredEnvironment: "production",
        blockers: [],
      },
    ]);

    const caller = appRouter.createCaller({
      db,
      userId: "user-1",
      apiKeyId: null,
      permissions: [],
      headers: new Headers(),
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

  it("returns source trust summary for the global trust banner", async () => {
    const db = createMockDb([
      {
        source: "argocd",
        status: "stale",
        maxFreshnessSeconds: 300,
        ageSeconds: 900,
      },
      {
        source: "prometheus",
        status: "healthy",
        maxFreshnessSeconds: 60,
        ageSeconds: 15,
      },
    ]);

    const caller = appRouter.createCaller({
      db,
      userId: "user-1",
      apiKeyId: null,
      permissions: [],
      headers: new Headers(),
    } as any);

    await expect(caller.sourceTrust.summary()).resolves.toEqual(
      expect.objectContaining({
        status: "degraded",
        degradedSources: ["argocd"],
        sources: expect.objectContaining({
          argocd: expect.objectContaining({ status: "stale", ageSeconds: 900 }),
        }),
      }),
    );
  });
});
