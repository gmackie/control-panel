"use client";

import { cn } from "@/lib/utils";

type ClusterStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export function ClusterStatusIndicator({ status = "unknown" }: { status?: ClusterStatus }) {
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
    </div>
  );
}
