"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const severities = ["all", "critical", "warning", "info"] as const;

export function AlertsTab({ appId }: { appId: string }) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const { data: app } = trpc.applications.bySlug.useQuery(appId);
  const {
    data: alerts,
    isLoading,
    refetch,
  } = trpc.monitoring.alerts.useQuery(
    {
      appId: app?.id,
      ...(severityFilter !== "all"
        ? { severity: severityFilter as "critical" | "warning" | "info" }
        : {}),
    },
    { enabled: !!app?.id }
  );

  const acknowledge = trpc.monitoring.acknowledgeAlert.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  return (
    <div className="space-y-4">
      {/* Severity filter */}
      <div className="flex items-center gap-2">
        {severities.map((sev) => (
          <Button
            key={sev}
            variant={severityFilter === sev ? "default" : "outline"}
            size="sm"
            onClick={() => setSeverityFilter(sev)}
            className="capitalize"
          >
            {sev}
          </Button>
        ))}
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : !alerts?.length ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            No alerts found{severityFilter !== "all" ? ` with severity "${severityFilter}"` : ""}.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Card key={alert.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn("h-2.5 w-2.5 rounded-full mt-1.5 shrink-0", {
                      "bg-red-500": alert.severity === "critical",
                      "bg-yellow-500": alert.severity === "warning",
                      "bg-blue-500": alert.severity === "info",
                    })}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={
                          alert.severity === "critical"
                            ? "error"
                            : alert.severity === "warning"
                              ? "warning"
                              : "secondary"
                        }
                        className="font-mono text-[11px]"
                      >
                        {alert.severity}
                      </Badge>
                      <Badge
                        variant={
                          alert.status === "firing"
                            ? "error"
                            : alert.status === "acknowledged"
                              ? "warning"
                              : "success"
                        }
                        className="font-mono text-[11px]"
                      >
                        {alert.status}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {alert.source}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground mt-1">
                      Started{" "}
                      {formatDistanceToNow(new Date(alert.startsAt), {
                        addSuffix: true,
                      })}
                      {alert.acknowledgedBy && (
                        <>
                          {" "}
                          &bull; Acked by {alert.acknowledgedBy}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {alert.status === "firing" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      acknowledge.mutate({ alertId: alert.id })
                    }
                    disabled={acknowledge.isPending}
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
