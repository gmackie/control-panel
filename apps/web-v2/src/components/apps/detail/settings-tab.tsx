"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";

export function SettingsTab({ appId }: { appId: string }) {
  const { data: app, isLoading } =
    trpc.applications.bySlug.useQuery(appId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">General</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{app?.name ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slug</span>
            <span className="font-mono">{app?.slug ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Description</span>
            <span>{app?.description || "No description"}</span>
          </div>
          {app?.repositoryUrl && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Repository</span>
              <a
                href={app.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {app.repositoryUrl}
              </a>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Providers</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Git Provider</span>
            <span className="capitalize">{app?.gitProvider ?? "\u2014"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deploy Provider</span>
            <span className="capitalize">
              {app?.deployProvider ?? "\u2014"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Database Provider</span>
            <span className="capitalize">{app?.dbProvider ?? "\u2014"}</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Environment Variables</h3>
        <p className="text-sm text-muted-foreground">
          Environment variable management will be wired here.
        </p>
      </Card>
    </div>
  );
}
