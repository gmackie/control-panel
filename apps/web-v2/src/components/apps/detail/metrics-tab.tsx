"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppMetrics } from "@/hooks/use-app-data";
import { Cpu, HardDrive, Activity, AlertTriangle, Timer } from "lucide-react";

export function MetricsTab({ appId }: { appId: string }) {
  const { data: app } = trpc.applications.bySlug.useQuery(appId);
  const k8sNamespace = app?.k8sNamespace || undefined;
  const k8sDeploymentName = app?.k8sDeploymentName || app?.slug || undefined;

  const {
    data: metrics,
    isLoading,
    error,
  } = useAppMetrics(k8sNamespace, k8sDeploymentName);

  if (app && app.deployProvider !== "kubernetes") {
    // Fallback to service monitoring for non-k8s apps
    return <ServiceMetrics appId={appId} />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    const msg = error.message || "Unknown error";
    const isUnconfigured = msg.includes("PROMETHEUS_URL") || msg.includes("503");

    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Prometheus Metrics</h3>
        {isUnconfigured ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Prometheus is not currently available. To enable metrics, run:
            </p>
            <pre className="text-xs bg-muted/30 rounded px-3 py-2 font-mono">
              kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
            </pre>
            <p className="text-xs text-muted-foreground">
              Then set <code className="bg-muted/30 px-1 rounded">PROMETHEUS_URL=http://localhost:9090</code> in your environment.
            </p>
          </div>
        ) : (
          <p className="text-sm text-red-400">
            Failed to fetch metrics: {msg}
          </p>
        )}
      </Card>
    );
  }

  const stats = [
    {
      label: "CPU Usage",
      value: `${metrics?.cpu ?? 0}%`,
      icon: Cpu,
      color: (metrics?.cpu ?? 0) > 80 ? "text-red-500" : (metrics?.cpu ?? 0) > 50 ? "text-yellow-500" : "text-green-500",
    },
    {
      label: "Memory",
      value: `${metrics?.memory ?? 0} MB`,
      icon: HardDrive,
      color: (metrics?.memory ?? 0) > 1024 ? "text-yellow-500" : "text-green-500",
    },
    {
      label: "Requests/s",
      value: `${metrics?.requests ?? 0}`,
      icon: Activity,
      color: "text-blue-500",
    },
    {
      label: "Error Rate",
      value: `${metrics?.errors ?? 0}%`,
      icon: AlertTriangle,
      color: (metrics?.errors ?? 0) > 5 ? "text-red-500" : (metrics?.errors ?? 0) > 1 ? "text-yellow-500" : "text-green-500",
    },
    {
      label: "P95 Latency",
      value: `${metrics?.latency ?? 0} ms`,
      icon: Timer,
      color: (metrics?.latency ?? 0) > 500 ? "text-red-500" : (metrics?.latency ?? 0) > 200 ? "text-yellow-500" : "text-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
            <p className={cn("text-lg font-bold", stat.color)}>{stat.value}</p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Metrics sourced from Prometheus. Showing instant values with 5m rate window.
        Auto-refreshes every 30s.
      </p>
    </div>
  );
}

/** Fallback component for non-K8s apps using tRPC service monitoring */
function ServiceMetrics({ appId }: { appId: string }) {
  const { data: services } = trpc.monitoring.services.useQuery();
  const appService = services?.find((s) =>
    s.name.toLowerCase().includes(appId.toLowerCase())
  );

  if (!appService) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Metrics</h3>
        <p className="text-sm text-muted-foreground">
          No metrics available for this application.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-lg font-bold capitalize">{appService.status}</p>
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
    </div>
  );
}
