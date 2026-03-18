"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SyncStatusBannerProps {
  total: number;
  synced: number;
  pending: number;
  failed: number;
  drift: number;
  onResolveDrift?: () => void;
  onRestartPods?: () => void;
}

export function SyncStatusBanner({
  total,
  synced,
  pending,
  failed,
  drift,
  onResolveDrift,
  onRestartPods,
}: SyncStatusBannerProps) {
  if (total === 0) return null;

  const hasIssues = failed > 0 || drift > 0;
  const allSynced = synced === total;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm",
        hasIssues
          ? "border-yellow-500/30 bg-yellow-500/5"
          : allSynced
            ? "border-green-500/20 bg-green-500/5"
            : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", allSynced ? "bg-green-500" : hasIssues ? "bg-yellow-500" : "bg-muted-foreground")} />
          <span className="font-mono text-[13px] tabular-nums">
            {synced} secret{synced !== 1 ? "s" : ""} synced
          </span>
        </div>

        {pending > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {pending} pending
          </span>
        )}

        {failed > 0 && (
          <span className="font-mono text-[11px] text-red-400">
            {failed} failed
          </span>
        )}

        {drift > 0 && (
          <span className="font-mono text-[11px] text-secondary">
            {drift} drift detected
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {drift > 0 && onResolveDrift && (
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={onResolveDrift}>
            Resolve Drift
          </Button>
        )}
        {onRestartPods && (
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={onRestartPods}>
            Restart Pods
          </Button>
        )}
      </div>
    </div>
  );
}
