"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HealthDot } from "./health-dot";
import { ProviderBadge } from "./provider-badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Play, ScrollText, RotateCcw } from "lucide-react";
import type { AppSummary } from "@/types/app";

interface AppCardProps {
  app: AppSummary;
  onClick: () => void;
}

export function AppCard({ app, onClick }: AppCardProps) {
  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all hover:border-primary/30",
        {
          "border-yellow-600/30": app.status === "degraded",
          "border-red-600/30": app.status === "unhealthy",
        }
      )}
      onClick={onClick}
    >
      {/* Header: name + provider badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HealthDot status={app.status} />
          <span className="font-display font-semibold text-sm">{app.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <ProviderBadge provider={app.gitProvider} />
          {app.deployProviders.map((p) => (
            <ProviderBadge key={p} provider={p} />
          ))}
        </div>
      </div>

      {/* Git line */}
      {app.latestCommit && (
        <p className="text-xs text-muted-foreground truncate mb-3">
          {app.branch} &bull;{" "}
          <span className="font-mono text-[11px]">{app.latestCommit.sha.slice(0, 7)}</span>{" "}
          &ldquo;{app.latestCommit.message}&rdquo;
          <span className="ml-1">
            {formatDistanceToNow(new Date(app.latestCommit.timestamp), { addSuffix: true })}
          </span>
        </p>
      )}

      {/* Environment status rows */}
      <div className="space-y-1.5 mb-3">
        {app.environments.map((env) => (
          <div key={env.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HealthDot status={env.status} size="sm" />
              <span className="text-muted-foreground capitalize">
                {env.provider === "k8s" ? `K8s ${env.name}` : "Vercel"}
              </span>
            </div>
            <span className="font-mono text-[13px] text-muted-foreground">
              {env.podCount
                ? `${env.podCount.ready}/${env.podCount.total} pods`
                : env.vercelStatus ?? "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Metrics row */}
      {app.metrics && (
        <div className="flex items-center gap-3 font-mono text-[13px] tabular-nums text-muted-foreground mb-3 border-t border-border pt-2">
          <span>CPU {app.metrics.cpuPercent}%</span>
          <span>MEM {app.metrics.memPercent}%</span>
          <span className={app.metrics.errorRate > 1 ? "text-red-400" : ""}>
            ERR {app.metrics.errorRate}%
          </span>
          <span>P95 {app.metrics.p95Latency}ms</span>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); }}>
          <Play className="h-3 w-3 mr-1" /> Deploy
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); }}>
          <ScrollText className="h-3 w-3 mr-1" /> Logs
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); }}>
          <RotateCcw className="h-3 w-3 mr-1" /> Restart
        </Button>
      </div>
    </Card>
  );
}
