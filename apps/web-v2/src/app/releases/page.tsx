"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ActiveReleasesBanner } from "@/components/releases/active-releases-banner";
import { ReleaseQueue } from "@/components/releases/release-queue";
import { ReleaseHistory } from "@/components/releases/release-history";
import { DeploymentDetailDrawer } from "@/components/pipeline/deployment-detail-drawer";
import { useActiveJourneys, useReleaseQueue, useReleases } from "@/hooks/use-release-data";
import { toDrawerJourney } from "@/hooks/use-deploy-correlation";
import type { DeploymentJourney } from "@/types/pipeline";
import type { ReleaseQueueItem, ActiveRelease } from "@/types/release";

export default function ReleasesPage() {
  const { data: session } = useSession();
  const { data: activeReleases } = useActiveJourneys();
  const { data: queueItems, isLoading: queueLoading } = useReleaseQueue(20);
  const { data: releaseItems } = useReleases(30);
  const [selectedDeploy, setSelectedDeploy] = useState<DeploymentJourney | null>(null);

  const activeStatuses = new Set([
    "pending", "queued", "running", "in_progress",
    "building", "testing", "deploying", "verifying",
    "pending_approval",
  ]);

  const currentQueue = queueItems?.filter((i) => activeStatuses.has(i.status)) ?? [];
  const recentCompleted = [
    ...(queueItems?.filter((i) => !activeStatuses.has(i.status)) ?? []),
    ...(releaseItems ?? []),
  ].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const handleRowClick = useCallback((item: ReleaseQueueItem) => {
    setSelectedDeploy(toDrawerJourney(item));
  }, []);

  const handleBannerClick = useCallback((release: ActiveRelease) => {
    setSelectedDeploy({
      id: release.id,
      appId: release.appSlug,
      appName: release.appName,
      appSlug: release.appSlug,
      environment: release.environment,
      commitSha: release.commitSha ?? release.version,
      commitMessage: "",
      branch: "main",
      triggeredBy: release.triggeredBy,
      startedAt: release.startedAt,
      status: release.status,
      currentStage: release.currentStage,
      steps: release.steps,
    });
  }, []);

  const handleClose = useCallback(() => setSelectedDeploy(null), []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Releases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Release control room — monitor and manage deployments across all applications
        </p>
      </div>

      <ActiveReleasesBanner
        releases={activeReleases ?? []}
        onClick={handleBannerClick}
      />

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Queue</h2>
        {queueLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <ReleaseQueue
            items={[...currentQueue, ...(queueItems?.filter((i) => !activeStatuses.has(i.status)).slice(0, 10) ?? [])]}
            onRowClick={handleRowClick}
          />
        )}
      </section>

      <section>
        <ReleaseHistory
          items={recentCompleted.slice(0, 30)}
          onRowClick={handleRowClick}
        />
      </section>

      <DeploymentDetailDrawer
        deployment={selectedDeploy}
        onClose={handleClose}
      />
    </div>
  );
}
