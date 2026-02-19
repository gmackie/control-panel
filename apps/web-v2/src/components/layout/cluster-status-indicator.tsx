"use client";

import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type ClusterStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

function deriveStatus(health: {
  totalClusters: number;
  healthyClusters: number;
  totalNodes: number;
  readyNodes: number;
} | undefined): ClusterStatus {
  if (!health) return "unknown";
  if (health.totalClusters === 0) return "unknown";
  if (health.healthyClusters === health.totalClusters && health.readyNodes === health.totalNodes) return "healthy";
  if (health.healthyClusters > 0 || health.readyNodes > 0) return "degraded";
  return "unhealthy";
}

export function ClusterStatusIndicator() {
  const { data: health } = trpc.clusters.health.useQuery(undefined, {
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const status = deriveStatus(health);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn("h-2.5 w-2.5 rounded-full", {
          "bg-green-500": status === "healthy",
          "bg-yellow-500": status === "degraded",
          "bg-red-500": status === "unhealthy",
          "bg-zinc-500": status === "unknown",
        })}
      />
      <span className="text-muted-foreground capitalize">{status}</span>
      {health && status !== "unknown" && (
        <span className="text-xs text-muted-foreground">
          ({health.readyNodes}/{health.totalNodes} nodes)
        </span>
      )}
    </div>
  );
}
