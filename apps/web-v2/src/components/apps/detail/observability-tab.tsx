"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppMetrics, useAppPods, usePodLogs } from "@/hooks/use-app-data";
import { Cpu, HardDrive, Activity, AlertTriangle, Timer } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ClusterId } from "@/types/k8s";

export function ObservabilityTab({ appId }: { appId: string }) {
  const { data: app } = trpc.applications.bySlug.useQuery(appId);
  const k8sNamespace = app?.k8sNamespace || undefined;
  const k8sDeploymentName = app?.k8sDeploymentName || app?.slug || undefined;
  const { data: metrics } = useAppMetrics(k8sNamespace, k8sDeploymentName);
  const { data: alerts } = trpc.monitoring.alerts.useQuery(
    { appId: app?.id, limit: 10 },
    { enabled: !!app?.id }
  );

  // Log viewer state
  const [clusterId, setClusterId] = useState<ClusterId>("production");
  const [selectedPod, setSelectedPod] = useState<string>("");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [showLogs, setShowLogs] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: pods } = useAppPods(k8sNamespace, k8sDeploymentName, clusterId);

  useEffect(() => {
    if (pods?.length && !selectedPod) setSelectedPod(pods[0].name);
  }, [pods, selectedPod]);

  const currentPod = pods?.find((p) => p.name === selectedPod);
  useEffect(() => {
    if (currentPod?.containers?.length) setSelectedContainer(currentPod.containers[0].name);
    else setSelectedContainer("");
  }, [currentPod]);

  const logOptions = showLogs && selectedPod && k8sNamespace
    ? { clusterId, namespace: k8sNamespace, pod: selectedPod, container: selectedContainer || undefined, tail: 100, follow: false }
    : null;
  const { lines, error: logError } = usePodLogs(logOptions);

  const stats = metrics
    ? [
        { label: "CPU Usage", value: `${metrics.cpu ?? 0}%`, icon: Cpu, color: (metrics.cpu ?? 0) > 80 ? "text-red-500" : (metrics.cpu ?? 0) > 50 ? "text-yellow-500" : "text-green-500" },
        { label: "Memory", value: `${metrics.memory ?? 0} MB`, icon: HardDrive, color: (metrics.memory ?? 0) > 1024 ? "text-yellow-500" : "text-green-500" },
        { label: "Requests/s", value: `${metrics.requests ?? 0}`, icon: Activity, color: "text-blue-500" },
        { label: "Error Rate", value: `${metrics.errors ?? 0}%`, icon: AlertTriangle, color: (metrics.errors ?? 0) > 5 ? "text-red-500" : "text-green-500" },
        { label: "P95 Latency", value: `${metrics.latency ?? 0} ms`, icon: Timer, color: (metrics.latency ?? 0) > 500 ? "text-red-500" : "text-green-500" },
      ]
    : null;

  return (
    <div className="space-y-6">
      {/* Resource Metrics */}
      <section>
        <h3 className="font-display text-sm font-semibold mb-3">Metrics</h3>
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
                <p className={cn("text-lg font-mono font-bold tabular-nums", stat.color)}>{stat.value}</p>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}
        <p className="font-mono text-[11px] text-dim mt-2">
          Metrics sourced from Prometheus. Auto-refreshes every 30s.
        </p>
      </section>

      {/* Sentry / PostHog placeholder */}
      <section>
        <h3 className="font-display text-sm font-semibold mb-3">Error Tracking</h3>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Connect Sentry in <span className="text-primary">Integrations</span> to see error tracking data here.
          </p>
        </Card>
      </section>

      {/* Alert History */}
      <section>
        <h3 className="font-display text-sm font-semibold mb-3">
          Alerts {alerts?.length ? `(${alerts.length})` : ""}
        </h3>
        {!alerts?.length ? (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">No active alerts.</p>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", {
                    "bg-red-500": a.severity === "critical",
                    "bg-yellow-500": a.severity === "warning",
                    "bg-blue-400": a.severity === "info",
                  })} />
                  <span className="text-sm">{a.message}</span>
                  <Badge
                    variant={a.severity === "critical" ? "error" : a.severity === "warning" ? "warning" : "secondary"}
                    className="font-mono text-[11px]"
                  >
                    {a.severity}
                  </Badge>
                </div>
                <span className="font-mono text-[11px] text-dim">
                  {formatDistanceToNow(new Date(a.startsAt), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Logs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold">Logs</h3>
          <Button variant="outline" size="sm" onClick={() => setShowLogs(!showLogs)}>
            {showLogs ? "Hide Logs" : "Show Logs"}
          </Button>
        </div>

        {showLogs && app?.deployProvider === "kubernetes" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="font-mono text-[11px] uppercase tracking-wider text-dim">Cluster</label>
                <select
                  value={clusterId}
                  onChange={(e) => { setClusterId(e.target.value as ClusterId); setSelectedPod(""); }}
                  className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[11px] uppercase tracking-wider text-dim">Pod</label>
                <select
                  value={selectedPod}
                  onChange={(e) => setSelectedPod(e.target.value)}
                  className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono max-w-[280px]"
                >
                  {!pods?.length && <option value="">No pods found</option>}
                  {pods?.map((p) => (
                    <option key={p.name} value={p.name}>{p.name} ({p.status})</option>
                  ))}
                </select>
              </div>
            </div>

            <Card className="p-0 overflow-hidden">
              {logError && (
                <div className="px-4 py-2 bg-red-500/10 text-red-500 text-xs border-b border-border">Error: {logError}</div>
              )}
              <div className="bg-[hsl(264,8%,6%)] rounded-md max-h-[400px] overflow-auto p-4">
                {lines.length === 0 ? (
                  <p className="text-muted-foreground text-sm font-mono">
                    {!selectedPod ? "Select a pod to view logs." : "No log lines returned."}
                  </p>
                ) : (
                  <pre className="text-[13px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {lines.map((line, i) => (
                      <div key={i} className={cn(
                        "hover:bg-accent/50 px-1 -mx-1 rounded",
                        line.toLowerCase().includes("error") && "text-red-400",
                        line.toLowerCase().includes("warn") && "text-yellow-400"
                      )}>
                        {line}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </pre>
                )}
              </div>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
