"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function CostSummary() {
  const { data: health, isLoading: healthLoading } =
    trpc.infrastructure.health.useQuery();
  const { data: costs, isLoading: costsLoading } =
    trpc.clusters.costs.useQuery();

  const isLoading = healthLoading || costsLoading;

  return (
    <section>
      <h2 className="font-display text-lg font-semibold mb-4">Costs &amp; Capacity</h2>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">
              Hetzner Servers
            </p>
            <p className="text-2xl font-mono font-bold tabular-nums">
              {health?.hetzner?.serverCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {health?.hetzner?.runningServers ?? 0} running
              {health?.hetzner?.totalMonthlyCost != null && (
                <>
                  {" "}
                  &bull; <span className="font-mono tabular-nums">&euro;{health.hetzner.totalMonthlyCost.toFixed(2)}/mo</span>
                </>
              )}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">
              Harbor Registry
            </p>
            <p className="text-2xl font-mono font-bold tabular-nums">
              {health?.harbor?.imageCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              images &bull;{" "}
              <span className="font-mono tabular-nums">
                {health?.harbor?.storageUsed != null
                  ? formatBytes(health.harbor.storageUsed)
                  : "\u2014"}
              </span>{" "}
              used
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">
              Gitea Repositories
            </p>
            <p className="text-2xl font-mono font-bold tabular-nums">
              {health?.gitea?.repositoryCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">repositories</p>
          </Card>
        </div>
      )}
      {costs?.breakdown?.length ? (
        <div className="mt-4">
          <h3 className="font-display text-sm font-medium mb-2">Cost Breakdown</h3>
          <div className="space-y-1">
            {costs.breakdown.map((item) => (
              <div
                key={item.resource}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{item.resource}</span>
                <span className="font-mono tabular-nums">&euro;{item.cost?.toFixed(2)}/mo</span>
              </div>
            ))}
          </div>
          {costs.totalCost != null && (
            <div className="flex items-center justify-between text-sm font-medium mt-2 pt-2 border-t border-border">
              <span>Total</span>
              <span className="font-mono tabular-nums">
                &euro;{costs.totalCost.toFixed(2)}/mo
                {costs.trend?.change != null && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({costs.trend.change > 0 ? "+" : ""}
                    {costs.trend.change.toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
