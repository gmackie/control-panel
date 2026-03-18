"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAppDeployments, useAppPods } from "@/hooks/use-app-data";
import { PipelineStepper } from "@/components/pipeline/pipeline-stepper";
import type { PipelineStep, PipelineStage } from "@/types/pipeline";

/** Infer pipeline steps from a deployment status string */
function inferSteps(status: string): PipelineStep[] {
  const stages: PipelineStage[] = ["commit", "build", "test", "deploy", "verify"];
  const progress: Record<string, number> = {
    succeeded: 5, healthy: 5, deploying: 3, verifying: 4,
    building: 1, testing: 2, running: 3, pending: 0, queued: 0,
    failed: -1, cancelled: -1, canceled: -1,
  };
  const p = progress[status] ?? 0;
  const isFailed = p < 0;
  return stages.map((stage, i) => ({
    stage,
    status: isFailed
      ? (i < 3 ? "success" : i === 3 ? "failed" : "skipped")
      : p > i ? "success" : p === i ? "running" : "pending",
  }));
}

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
  const { data: activity } = trpc.activity.recent.useQuery(
    { limit: 8 },
    { enabled: !!app?.id }
  );

  const k8sNamespace = app?.k8sNamespace || undefined;
  const k8sDeploymentName = app?.k8sDeploymentName || app?.slug || undefined;

  const { data: k8sDeployments } = useAppDeployments(
    k8sNamespace,
    k8sDeploymentName
  );
  const { data: k8sPods } = useAppPods(k8sNamespace, k8sDeploymentName);

  // Latest deployment for pipeline stepper
  const latestDeploy = deployments?.[0];

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
      {/* Current Pipeline */}
      {latestDeploy && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold">Latest Pipeline</h3>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                {latestDeploy.commitSha?.slice(0, 7)}
              </span>
              <Badge
                variant={latestDeploy.status === "succeeded" ? "success" : latestDeploy.status === "failed" ? "error" : "secondary"}
                className="font-mono text-[11px]"
              >
                {latestDeploy.status}
              </Badge>
            </div>
          </div>
          <PipelineStepper steps={inferSteps(latestDeploy.status)} />
          <p className="font-mono text-[11px] text-dim mt-3">
            {latestDeploy.environment} &bull; {latestDeploy.triggeredBy ?? "ci"} &bull;{" "}
            {latestDeploy.startedAt
              ? formatDistanceToNow(new Date(latestDeploy.startedAt), { addSuffix: true })
              : "—"}
          </p>
        </Card>
      )}

      {/* App Info */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Application Info</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span> {app?.name ?? "\u2014"}
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>{" "}
            <span className="font-mono text-[13px]">{app?.status ?? "\u2014"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Git:</span>{" "}
            <span className="font-mono text-[13px]">{app?.gitProvider ?? "\u2014"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Deploy:</span>{" "}
            <span className="font-mono text-[13px]">{app?.deployProvider ?? "\u2014"}</span>
          </div>
          {app?.repositoryUrl && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Repo:</span>{" "}
              <a
                href={app.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono text-[13px]"
              >
                {app.repositoryUrl}
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* K8s Status */}
      {app?.deployProvider === "kubernetes" && (
        <Card className="p-4">
          <h3 className="font-display text-sm font-semibold mb-3">K8s Status</h3>
          {!k8sDeployments?.length ? (
            <p className="text-sm text-muted-foreground">No K8s deployments found for this app.</p>
          ) : (
            <div className="space-y-3">
              {k8sDeployments.map((dep) => (
                <div key={`${dep.clusterId}-${dep.name}`} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{dep.clusterName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {dep.namespace}/{dep.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Replicas:</span>{" "}
                      <span className={cn("font-mono text-[13px] tabular-nums", dep.readyReplicas === dep.replicas ? "text-green-500" : "text-yellow-500")}>
                        {dep.readyReplicas}/{dep.replicas}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Updated:</span>{" "}
                      <span className="font-mono text-[13px] tabular-nums">{dep.updatedReplicas}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Strategy:</span>{" "}
                      <span className="font-mono text-[13px]">{dep.strategy}</span>
                    </div>
                  </div>
                </div>
              ))}
              {k8sPods && k8sPods.length > 0 && (
                <div className="border-t border-border/50 pt-2 mt-2">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-1">
                    Pods ({k8sPods.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {k8sPods.map((pod) => (
                      <div key={`${pod.clusterId}-${pod.name}`} className="flex items-center gap-1.5 text-xs">
                        <div className={cn("h-2 w-2 rounded-full", {
                          "bg-green-500": pod.status === "Running",
                          "bg-yellow-500": pod.status === "Pending",
                          "bg-red-500": pod.status === "Failed",
                          "bg-neutral-400": pod.status === "Succeeded" || pod.status === "Unknown",
                        })} />
                        <span className="font-mono text-[13px]">{pod.name}</span>
                        <span className="font-mono text-[13px] text-muted-foreground">{pod.ready}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Recent Activity</h3>
        {!activity?.length ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <div className="space-y-2">
            {activity.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", {
                    "bg-green-500": event.severity === "info",
                    "bg-yellow-500": event.severity === "warning",
                    "bg-red-500": event.severity === "critical",
                    "bg-neutral-400": !event.severity,
                  })} />
                  <span className="truncate">{event.title}</span>
                </div>
                <span className="font-mono text-[11px] text-dim shrink-0 ml-2">
                  {event.createdAt
                    ? formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Deployments */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Recent Deployments</h3>
        {!deployments?.length ? (
          <p className="text-sm text-muted-foreground">No deployments found.</p>
        ) : (
          <div className="space-y-2">
            {deployments.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", {
                    "bg-green-500": d.status === "succeeded",
                    "bg-red-500": d.status === "failed",
                    "bg-yellow-500": d.status === "running",
                    "bg-neutral-400": d.status === "pending" || d.status === "cancelled",
                  })} />
                  <span>{d.environment}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">{d.commitSha?.slice(0, 7)}</span>
                </div>
                <span className="font-mono text-[13px] text-muted-foreground">
                  {d.startedAt ? formatDistanceToNow(new Date(d.startedAt), { addSuffix: true }) : "\u2014"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Active Alerts */}
      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Active Alerts</h3>
        {!alerts?.length ? (
          <p className="text-sm text-muted-foreground">No active alerts.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", {
                    "bg-red-500": a.severity === "critical",
                    "bg-yellow-500": a.severity === "warning",
                    "bg-blue-500": a.severity === "info",
                  })} />
                  <span>{a.message}</span>
                </div>
                <span className={cn("font-mono text-[11px]", {
                  "text-red-400": a.severity === "critical",
                  "text-yellow-400": a.severity === "warning",
                  "text-blue-400": a.severity === "info",
                })}>
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
