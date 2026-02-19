"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

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

  return (
    <div className="space-y-4">
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
