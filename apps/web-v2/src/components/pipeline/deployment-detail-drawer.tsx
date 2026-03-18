"use client";

import { useEffect } from "react";
import { X, RotateCcw, ScrollText, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineStepper } from "./pipeline-stepper";
import { DeployTimeline, type TimelineEvent } from "./deploy-timeline";
import { MetricDelta } from "@/components/monitoring/metric-delta";
import { cn } from "@/lib/utils";
import type { DeploymentJourney, PipelineStep } from "@/types/pipeline";

interface DeploymentDetailDrawerProps {
  deployment: DeploymentJourney | null;
  onClose: () => void;
  impact?: {
    errorRate?: { current: number; previous: number };
    latency?: { current: number; previous: number };
    cpu?: { current: number; previous: number };
  };
}

function stepsToTimelineEvents(
  journey: DeploymentJourney
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Commit event
  if (journey.commitSha) {
    events.push({
      id: "commit",
      timestamp: journey.startedAt,
      status: "success",
      title: "Commit pushed",
      detail: `${journey.commitSha.slice(0, 7)} "${journey.commitMessage}"`,
    });
  }

  // Pipeline step events
  for (const step of journey.steps) {
    if (step.stage === "commit") continue;

    const statusMap = {
      pending: "pending" as const,
      running: "running" as const,
      success: "success" as const,
      failed: "failed" as const,
      skipped: "pending" as const,
    };

    events.push({
      id: step.stage,
      timestamp: step.startedAt ?? journey.startedAt,
      status: statusMap[step.status],
      title: `${step.stage.charAt(0).toUpperCase() + step.stage.slice(1)} ${
        step.status === "running"
          ? "in progress"
          : step.status === "success"
            ? "succeeded"
            : step.status === "failed"
              ? "failed"
              : step.status === "skipped"
                ? "skipped"
                : "pending"
      }`,
      duration:
        step.durationMs != null
          ? step.durationMs < 1000
            ? `${step.durationMs}ms`
            : step.durationMs < 60000
              ? `${Math.floor(step.durationMs / 1000)}s`
              : `${Math.floor(step.durationMs / 60000)}m ${Math.floor((step.durationMs % 60000) / 1000)}s`
          : undefined,
      detail: step.message,
      expandable: step.status === "failed" && !!step.message,
      expandedContent: step.status === "failed" ? step.message : undefined,
    });
  }

  return events;
}

const statusBadgeVariant = {
  pending: "secondary" as const,
  queued: "secondary" as const,
  building: "secondary" as const,
  testing: "secondary" as const,
  deploying: "secondary" as const,
  verifying: "secondary" as const,
  healthy: "success" as const,
  succeeded: "success" as const,
  unhealthy: "error" as const,
  failed: "error" as const,
  rolled_back: "warning" as const,
  canceled: "secondary" as const,
  superseded: "secondary" as const,
};

export function DeploymentDetailDrawer({
  deployment,
  onClose,
  impact,
}: DeploymentDetailDrawerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const timelineEvents = deployment
    ? stepsToTimelineEvents(deployment)
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          deployment ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[520px] bg-card border-l border-border shadow-2xl transition-transform duration-200",
          deployment ? "translate-x-0" : "translate-x-full"
        )}
      >
        {deployment && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-semibold text-lg">
                    {deployment.appName}
                  </h2>
                  {deployment.status && (
                    <Badge
                      variant={
                        statusBadgeVariant[
                          deployment.status as keyof typeof statusBadgeVariant
                        ] ?? "secondary"
                      }
                      className="font-mono text-[11px]"
                    >
                      {deployment.status}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span>{deployment.environment}</span>
                <span>&bull;</span>
                <span>{deployment.commitSha.slice(0, 7)}</span>
                <span>&bull;</span>
                <span>{deployment.branch}</span>
                <span>&bull;</span>
                <span>{deployment.triggeredBy}</span>
              </div>

              {/* Pipeline stepper */}
              <PipelineStepper steps={deployment.steps} />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Timeline */}
              <section>
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">
                  Timeline
                </h3>
                <DeployTimeline events={timelineEvents} />
              </section>

              {/* Deploy Impact */}
              {impact && (
                <section>
                  <h3 className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">
                    Impact Since Deploy
                  </h3>
                  <div className="space-y-2">
                    {impact.errorRate && (
                      <MetricDelta
                        label="Error Rate"
                        current={impact.errorRate.current}
                        previous={impact.errorRate.previous}
                        unit="%"
                      />
                    )}
                    {impact.latency && (
                      <MetricDelta
                        label="P95 Latency"
                        current={impact.latency.current}
                        previous={impact.latency.previous}
                        unit="ms"
                      />
                    )}
                    {impact.cpu && (
                      <MetricDelta
                        label="CPU Usage"
                        current={impact.cpu.current}
                        previous={impact.cpu.previous}
                        unit="%"
                      />
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Action bar */}
            <div className="border-t border-border p-4 flex items-center gap-2">
              <Button variant="destructive" size="sm">
                <RotateCcw className="h-3 w-3 mr-1" />
                Rollback
              </Button>
              <Button variant="outline" size="sm">
                <ScrollText className="h-3 w-3 mr-1" />
                View Logs
              </Button>
              {deployment.environment === "staging" && (
                <Button size="sm">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Promote
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
