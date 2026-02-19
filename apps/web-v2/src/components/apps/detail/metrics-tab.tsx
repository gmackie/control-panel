"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";

export function MetricsTab({ appId }: { appId: string }) {
  const { data: app } = trpc.applications.bySlug.useQuery(appId);
  const { data: services } = trpc.monitoring.services.useQuery();

  // Try to find a service matching the app
  const appService = services?.find((s) =>
    s.name.toLowerCase().includes(appId.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {appService ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-lg font-bold capitalize">
                {appService.status}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Latency</p>
              <p className="text-lg font-bold">{appService.latency}ms</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-lg font-bold">{appService.uptime}%</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Last Check</p>
              <p className="text-sm font-medium">
                {appService.lastCheck
                  ? new Date(appService.lastCheck).toLocaleTimeString()
                  : "\u2014"}
              </p>
            </Card>
          </div>

          {appService.endpoints?.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">Endpoints</h3>
              <div className="space-y-2">
                {appService.endpoints.map((ep) => (
                  <div
                    key={ep.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${ep.status === "up" ? "bg-green-500" : "bg-red-500"}`}
                      />
                      <span>{ep.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {ep.responseTime}ms
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Prometheus charts for CPU, memory, latency, and error rate will be
            displayed here.
            {app?.deployProvider === "kubernetes" &&
              " Metrics will be sourced from the Prometheus instance monitoring your K8s cluster."}
          </p>
        </Card>
      )}
    </div>
  );
}
