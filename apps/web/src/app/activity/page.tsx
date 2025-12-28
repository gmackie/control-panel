"use client";

import MainLayout from "@/components/layout/main-layout";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export default function ActivityPage() {
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Activity Feed</h1>
        <p className="mt-2 text-muted-foreground">
          Real-time stream of events across all your applications and integrations
        </p>
      </div>

      <ActivityFeed showFilters={true} showStats={true} />
    </MainLayout>
  );
}
