"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAppDeployments, useAppImages } from "@/hooks/use-app-data";
import { PipelineStepper } from "@/components/pipeline/pipeline-stepper";
import { DeploymentDetailDrawer } from "@/components/pipeline/deployment-detail-drawer";
import type { PipelineStep, DeploymentJourney } from "@/types/pipeline";

const environments = ["all", "production", "staging", "development"] as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Build pipeline steps from deployment status for the stepper */
function deploymentToSteps(status: string): PipelineStep[] {
  const stages = ["commit", "build", "test", "deploy", "verify"] as const;
  const statusMap: Record<string, number> = {
    succeeded: 5, healthy: 5, deployed: 5,
    verifying: 4, deploying: 3, testing: 2, building: 1,
    failed: -1, cancelled: -1, canceled: -1,
    pending: 0, queued: 0, running: 3,
  };
  const progress = statusMap[status] ?? 0;
  const isFailed = progress === -1;

  return stages.map((stage, i) => ({
    stage,
    status: isFailed
      ? (i < 3 ? "success" : i === 3 ? "failed" : "skipped")
      : progress > i
        ? "success"
        : progress === i
          ? "running"
          : "pending",
  }));
}

export function DeploymentsTab({ appId }: { appId: string }) {
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [showRegistry, setShowRegistry] = useState(false);
  const [selectedDeploy, setSelectedDeploy] = useState<DeploymentJourney | null>(null);
  const handleCloseDrawer = useCallback(() => setSelectedDeploy(null), []);
  const { data: app } = trpc.applications.bySlug.useQuery(appId);
  const { data: deployments, isLoading } = trpc.deployments.list.useQuery(
    {
      appId: app?.id,
      limit: 20,
      ...(envFilter !== "all"
        ? { environment: envFilter as "production" | "staging" | "development" }
        : {}),
    },
    { enabled: !!app?.id }
  );

  const k8sNamespace = app?.k8sNamespace || undefined;
  const k8sDeploymentName = app?.k8sDeploymentName || app?.slug || undefined;

  const { data: k8sDeployments, isLoading: k8sLoading } = useAppDeployments(
    k8sNamespace,
    k8sDeploymentName
  );

  // Registry data
  const harborProject = "library";
  const harborRepo = app?.slug || appId;
  const { data: artifacts } = useAppImages(harborProject, harborRepo);

  return (
    <div className="space-y-6">
      {/* Live K8s Status */}
      {app?.deployProvider === "kubernetes" && (
        <Card className="p-4 border-dashed">
          <h3 className="font-display text-sm font-semibold mb-3">Live K8s Status</h3>
          {k8sLoading ? (
            <div className="h-12 rounded bg-muted/30 animate-pulse" />
          ) : !k8sDeployments?.length ? (
            <p className="text-sm text-muted-foreground">No K8s deployments found.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {k8sDeployments.map((dep) => (
                <div key={`${dep.clusterId}-${dep.name}`} className="rounded-md border border-border/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{dep.clusterName}</span>
                    <span className={cn(
                      "font-mono text-[11px] font-medium px-2 py-0.5 rounded-full",
                      dep.readyReplicas === dep.replicas && dep.replicas > 0
                        ? "bg-green-500/10 text-green-500"
                        : dep.readyReplicas > 0
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-red-500/10 text-red-500"
                    )}>
                      {dep.readyReplicas === dep.replicas && dep.replicas > 0 ? "Healthy" : dep.readyReplicas > 0 ? "Degraded" : "Unavailable"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Replicas:</span> <span className={cn("font-mono text-[13px] tabular-nums", dep.readyReplicas === dep.replicas ? "text-green-500" : "text-yellow-500")}>{dep.readyReplicas}/{dep.replicas}</span></div>
                    <div><span className="text-muted-foreground">Strategy:</span> <span className="font-mono text-[13px]">{dep.strategy}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Environment filter + registry toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {environments.map((env) => (
            <Button key={env} variant={envFilter === env ? "default" : "outline"} size="sm" onClick={() => setEnvFilter(env)} className="capitalize">
              {env}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowRegistry(!showRegistry)}>
          {showRegistry ? "Hide Registry" : "Show Registry"}
        </Button>
      </div>

      {/* Deployment list with pipeline steppers */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : !deployments?.length ? (
        <p className="text-muted-foreground">No deployments found.</p>
      ) : (
        <div className="space-y-2">
          {deployments.map((d) => (
            <Card
              key={d.id}
              className="p-4 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => {
                setSelectedDeploy({
                  id: d.id,
                  appId: app?.id ?? appId,
                  appName: app?.name ?? appId,
                  appSlug: app?.slug ?? appId,
                  environment: d.environment,
                  commitSha: d.commitSha ?? "",
                  commitMessage: "",
                  branch: "main",
                  triggeredBy: d.triggeredBy ?? "unknown",
                  startedAt: d.startedAt ?? new Date().toISOString(),
                  completedAt: d.completedAt ?? undefined,
                  status: d.status,
                  currentStage: "deploy",
                  steps: deploymentToSteps(d.status),
                });
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", {
                    "bg-green-500": d.status === "succeeded",
                    "bg-red-500": d.status === "failed",
                    "bg-yellow-500": d.status === "running" || d.status === "pending",
                    "bg-neutral-400": d.status === "cancelled",
                  })} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{d.version || d.imageTag || "\u2014"}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {d.environment} &bull; {d.commitSha?.slice(0, 7)} &bull; {d.triggeredBy ?? "unknown"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <PipelineStepper steps={deploymentToSteps(d.status)} compact />
                  <div className="text-right">
                    <div className="font-mono text-[11px] capitalize text-muted-foreground">{d.status}</div>
                    <div className="font-mono text-[13px] text-muted-foreground">
                      {d.startedAt ? formatDistanceToNow(new Date(d.startedAt), { addSuffix: true }) : "\u2014"}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Registry images (collapsible) */}
      {showRegistry && (
        <section>
          <h3 className="font-display text-sm font-semibold mb-3">
            Container Images {artifacts?.length ? `(${artifacts.length})` : ""}
          </h3>
          {!artifacts?.length ? (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">No container images found.</p>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Tags</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Digest</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Size</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Pushed</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.map((artifact) => (
                    <tr key={artifact.digest} className="border-b border-border/50 last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {artifact.tags.length > 0 ? artifact.tags.map((tag) => (
                            <Badge key={tag} variant={tag === "latest" ? "default" : "secondary"} className="font-mono text-[11px]">{tag}</Badge>
                          )) : (
                            <span className="text-muted-foreground font-mono text-[11px]">untagged</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-muted-foreground">{artifact.shortDigest}</code></td>
                      <td className="px-4 py-2.5 font-mono text-[13px] tabular-nums text-muted-foreground">{formatBytes(artifact.size)}</td>
                      <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">
                        {artifact.pushedAt ? formatDistanceToNow(new Date(artifact.pushedAt), { addSuffix: true }) : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <DeploymentDetailDrawer
        deployment={selectedDeploy}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
