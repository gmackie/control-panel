"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAppDeployments } from "@/hooks/use-app-data";

const environments = ["all", "production", "staging", "development"] as const;

export function DeploymentsTab({ appId }: { appId: string }) {
  const [envFilter, setEnvFilter] = useState<string>("all");
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

  return (
    <div className="space-y-4">
      {/* Live K8s Status */}
      {app?.deployProvider === "kubernetes" && (
        <Card className="p-4 border-dashed">
          <h3 className="text-sm font-medium mb-3">Live K8s Status</h3>
          {k8sLoading ? (
            <div className="h-12 rounded bg-muted/30 animate-pulse" />
          ) : !k8sDeployments?.length ? (
            <p className="text-sm text-muted-foreground">
              No K8s deployments found.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {k8sDeployments.map((dep) => (
                <div
                  key={`${dep.clusterId}-${dep.name}`}
                  className="rounded-md border border-border/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {dep.clusterName}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        dep.readyReplicas === dep.replicas && dep.replicas > 0
                          ? "bg-green-500/10 text-green-500"
                          : dep.readyReplicas > 0
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-red-500/10 text-red-500"
                      )}
                    >
                      {dep.readyReplicas === dep.replicas && dep.replicas > 0
                        ? "Healthy"
                        : dep.readyReplicas > 0
                          ? "Degraded"
                          : "Unavailable"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">Deployment:</span>{" "}
                      {dep.namespace}/{dep.name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Strategy:</span>{" "}
                      {dep.strategy}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Desired:</span>{" "}
                      {dep.replicas}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ready:</span>{" "}
                      <span
                        className={cn(
                          dep.readyReplicas === dep.replicas
                            ? "text-green-500"
                            : "text-yellow-500"
                        )}
                      >
                        {dep.readyReplicas}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Updated:</span>{" "}
                      {dep.updatedReplicas}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Available:</span>{" "}
                      {dep.availableReplicas}
                    </div>
                  </div>
                  {dep.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      Created{" "}
                      {formatDistanceToNow(new Date(dep.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Environment filter */}
      <div className="flex items-center gap-2">
        {environments.map((env) => (
          <Button
            key={env}
            variant={envFilter === env ? "default" : "outline"}
            size="sm"
            onClick={() => setEnvFilter(env)}
            className="capitalize"
          >
            {env}
          </Button>
        ))}
      </div>

      {/* Deployment list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : !deployments?.length ? (
        <p className="text-muted-foreground">No deployments found.</p>
      ) : (
        <div className="space-y-2">
          {deployments.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn("h-2.5 w-2.5 rounded-full", {
                      "bg-green-500": d.status === "succeeded",
                      "bg-red-500": d.status === "failed",
                      "bg-yellow-500":
                        d.status === "running" || d.status === "pending",
                      "bg-zinc-500": d.status === "cancelled",
                    })}
                  />
                  <div>
                    <div className="text-sm font-medium">
                      {d.version || d.imageTag || "\u2014"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.environment} &bull; {d.commitSha?.slice(0, 7)} &bull;{" "}
                      {d.triggeredBy ?? "unknown"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs capitalize text-muted-foreground">
                    {d.status}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.startedAt
                      ? formatDistanceToNow(new Date(d.startedAt), {
                          addSuffix: true,
                        })
                      : "\u2014"}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
