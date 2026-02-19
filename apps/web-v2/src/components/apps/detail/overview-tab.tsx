"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function OverviewTab({ appId }: { appId: string }) {
  const { data: app, isLoading: appLoading } =
    trpc.applications.bySlug.useQuery(appId);
  const { data: deployments } = trpc.deployments.list.useQuery(
    { appId: app?.id, limit: 5 },
    { enabled: !!app?.id }
  );
  const { data: alerts } = trpc.monitoring.alerts.useQuery(
    { appId: app?.id, limit: 5 },
    { enabled: !!app?.id }
  );

  if (appLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* App Info */}
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Application Info</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span> {app?.name ?? "\u2014"}
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>{" "}
            {app?.status ?? "\u2014"}
          </div>
          <div>
            <span className="text-muted-foreground">Git:</span>{" "}
            {app?.gitProvider ?? "\u2014"}
          </div>
          <div>
            <span className="text-muted-foreground">Deploy:</span>{" "}
            {app?.deployProvider ?? "\u2014"}
          </div>
          {app?.repositoryUrl && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Repo:</span>{" "}
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

      {/* Recent Deployments */}
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Recent Deployments</h3>
        {!deployments?.length ? (
          <p className="text-sm text-muted-foreground">
            No deployments found.
          </p>
        ) : (
          <div className="space-y-2">
            {deployments.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn("h-2 w-2 rounded-full", {
                      "bg-green-500": d.status === "succeeded",
                      "bg-red-500": d.status === "failed",
                      "bg-yellow-500": d.status === "running",
                      "bg-zinc-500":
                        d.status === "pending" || d.status === "cancelled",
                    })}
                  />
                  <span>{d.environment}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {d.commitSha?.slice(0, 7)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {d.startedAt
                    ? formatDistanceToNow(new Date(d.startedAt), {
                        addSuffix: true,
                      })
                    : "\u2014"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Active Alerts */}
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Active Alerts</h3>
        {!alerts?.length ? (
          <p className="text-sm text-muted-foreground">No active alerts.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn("h-2 w-2 rounded-full", {
                      "bg-red-500": a.severity === "critical",
                      "bg-yellow-500": a.severity === "warning",
                      "bg-blue-500": a.severity === "info",
                    })}
                  />
                  <span>{a.message}</span>
                </div>
                <span
                  className={cn("text-xs", {
                    "text-red-400": a.severity === "critical",
                    "text-yellow-400": a.severity === "warning",
                    "text-blue-400": a.severity === "info",
                  })}
                >
                  {a.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
