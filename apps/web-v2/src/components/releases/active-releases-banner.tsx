"use client";

import { Button } from "@/components/ui/button";
import { PipelineStepper } from "@/components/pipeline/pipeline-stepper";
import { cn } from "@/lib/utils";
import type { ActiveRelease } from "@/types/release";

interface ActiveReleasesBannerProps {
  releases: ActiveRelease[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onRollback?: (id: string) => void;
  onClick?: (release: ActiveRelease) => void;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function ActiveReleasesBanner({
  releases,
  onApprove,
  onReject,
  onRollback,
  onClick,
}: ActiveReleasesBannerProps) {
  if (releases.length === 0) return null;

  return (
    <div className="space-y-2">
      {releases.map((release) => (
        <div
          key={release.id}
          className={cn(
            "flex items-center gap-4 px-4 py-3 rounded-lg border bg-card transition-colors",
            release.requiresApproval
              ? "border-secondary/40 bg-secondary/5"
              : "border-border",
            onClick && "cursor-pointer hover:border-primary/30"
          )}
          onClick={() => onClick?.(release)}
        >
          {/* App + version */}
          <div className="w-36 shrink-0">
            <p className="font-display font-semibold text-sm truncate">
              {release.appName}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {release.version}
            </p>
          </div>

          {/* Pipeline stepper */}
          <div className="flex-1 min-w-0">
            <PipelineStepper steps={release.steps} compact />
          </div>

          {/* Status */}
          <div className="w-48 shrink-0 text-right">
            <p className={cn(
              "text-sm",
              release.requiresApproval ? "text-secondary font-medium" : "text-muted-foreground"
            )}>
              {release.requiresApproval
                ? "Awaiting Approval"
                : `${release.status} to ${release.environment}`}
            </p>
            <p className="font-mono text-[11px] tabular-nums text-dim">
              {formatElapsed(release.elapsedMs)} elapsed
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {release.requiresApproval ? (
              <>
                <Button
                  size="sm"
                  onClick={() => onApprove?.(release.id)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReject?.(release.id)}
                >
                  Reject
                </Button>
              </>
            ) : release.environment === "production" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onRollback?.(release.id)}
              >
                Rollback
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
