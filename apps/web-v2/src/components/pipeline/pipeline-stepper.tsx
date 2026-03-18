"use client";

import { cn } from "@/lib/utils";
import type { PipelineStep, PipelineStage } from "@/types/pipeline";
import { STAGE_LABELS, PIPELINE_STAGES } from "@/types/pipeline";

interface PipelineStepperProps {
  steps: PipelineStep[];
  compact?: boolean;
  onStepClick?: (step: PipelineStep) => void;
  className?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function getElapsedMs(startedAt?: string): number | null {
  if (!startedAt) return null;
  return Date.now() - new Date(startedAt).getTime();
}

const statusColors = {
  pending: "bg-muted-foreground/30",
  running: "bg-primary",
  success: "bg-green-500",
  failed: "bg-red-500",
  skipped: "bg-muted-foreground/20",
} as const;

const statusRingColors = {
  pending: "",
  running: "ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
  success: "",
  failed: "ring-2 ring-red-500/30 ring-offset-1 ring-offset-background",
  skipped: "",
} as const;

export function PipelineStepper({
  steps,
  compact = false,
  onStepClick,
  className,
}: PipelineStepperProps) {
  // Build a map for quick lookup, fill in missing stages
  const stepMap = new Map(steps.map((s) => [s.stage, s]));
  const orderedSteps = PIPELINE_STAGES.map(
    (stage) =>
      stepMap.get(stage) ?? { stage, status: "pending" as const }
  );

  return (
    <div className={cn("flex items-center", className)}>
      {orderedSteps.map((step, index) => {
        const isLast = index === orderedSteps.length - 1;
        const nextStep = isLast ? null : orderedSteps[index + 1];
        const lineCompleted =
          step.status === "success" ||
          step.status === "running" ||
          step.status === "failed";

        return (
          <div key={step.stage} className="flex items-center">
            {/* Step node */}
            <div
              className={cn(
                "flex flex-col items-center",
                onStepClick && "cursor-pointer"
              )}
              onClick={() => onStepClick?.(step)}
              title={step.message ?? STAGE_LABELS[step.stage]}
            >
              {/* Dot */}
              <div
                className={cn(
                  "rounded-full transition-all",
                  compact ? "h-2.5 w-2.5" : "h-3 w-3",
                  statusColors[step.status],
                  statusRingColors[step.status],
                  step.status === "running" && "animate-pulse"
                )}
              />

              {/* Label + duration */}
              {!compact && (
                <div className="mt-1.5 text-center">
                  <p
                    className={cn(
                      "font-mono text-[11px] leading-none",
                      step.status === "running"
                        ? "text-primary"
                        : step.status === "failed"
                          ? "text-red-400"
                          : step.status === "success"
                            ? "text-foreground"
                            : "text-dim"
                    )}
                  >
                    {STAGE_LABELS[step.stage]}
                  </p>
                  {step.status === "success" && step.durationMs != null && (
                    <p className="font-mono text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {formatDuration(step.durationMs)}
                    </p>
                  )}
                  {step.status === "running" && (
                    <p className="font-mono text-[10px] text-primary/70 tabular-nums mt-0.5">
                      {step.startedAt
                        ? formatDuration(getElapsedMs(step.startedAt) ?? 0)
                        : "..."}
                    </p>
                  )}
                  {step.status === "failed" && (
                    <p className="font-mono text-[10px] text-red-400/70 mt-0.5">
                      failed
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Connecting line */}
            {!isLast && (
              <div
                className={cn(
                  "h-px transition-colors",
                  compact ? "w-4 mx-1" : "w-8 mx-2",
                  lineCompleted && nextStep?.status !== "pending"
                    ? "bg-green-500/50"
                    : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
