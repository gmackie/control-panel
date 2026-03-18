"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AppHealthItem {
  id: string;
  name: string;
  slug: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  errorRate?: number;
  latencyMs?: number;
  activeAlerts: number;
  lastDeploy?: {
    version: string;
    time: string;
  };
}

interface AppHealthGridProps {
  apps: AppHealthItem[];
  onAppClick?: (app: AppHealthItem) => void;
}

const statusDotColor = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  unhealthy: "bg-red-500",
  unknown: "bg-neutral-400",
} as const;

export function AppHealthGrid({ apps, onAppClick }: AppHealthGridProps) {
  // Sort: unhealthy first, then degraded, then healthy
  const sorted = [...apps].sort((a, b) => {
    const order = { unhealthy: 0, degraded: 1, unknown: 2, healthy: 3 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {sorted.map((app) => (
        <Card
          key={app.id}
          className={cn(
            "p-4 transition-all",
            app.status === "unhealthy" && "border-red-500/30",
            app.status === "degraded" && "border-yellow-500/30",
            onAppClick && "cursor-pointer hover:border-primary/30"
          )}
          onClick={() => onAppClick?.(app)}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn("h-2.5 w-2.5 rounded-full", statusDotColor[app.status])} />
              <span className="font-display font-semibold text-sm">{app.name}</span>
            </div>
            {app.activeAlerts > 0 && (
              <Badge variant="error" className="font-mono text-[11px]">
                {app.activeAlerts} alert{app.activeAlerts > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-4 font-mono text-[13px] tabular-nums text-muted-foreground">
            {app.errorRate != null && (
              <span className={app.errorRate > 1 ? "text-red-400" : ""}>
                ERR {app.errorRate}%
              </span>
            )}
            {app.latencyMs != null && (
              <span className={app.latencyMs > 500 ? "text-yellow-400" : ""}>
                P95 {app.latencyMs}ms
              </span>
            )}
          </div>

          {/* Last deploy */}
          {app.lastDeploy && (
            <p className="font-mono text-[11px] text-dim mt-2">
              {app.lastDeploy.version} &bull; {app.lastDeploy.time}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
