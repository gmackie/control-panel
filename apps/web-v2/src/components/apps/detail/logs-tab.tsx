"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppPods, usePodLogs } from "@/hooks/use-app-data";
import type { ClusterId } from "@/types/k8s";

export function LogsTab({ appId }: { appId: string }) {
  const { data: app } = trpc.applications.bySlug.useQuery(appId);
  const k8sNamespace = app?.k8sNamespace || undefined;
  const k8sDeploymentName = app?.k8sDeploymentName || app?.slug || undefined;

  const [clusterId, setClusterId] = useState<ClusterId>("production");
  const [selectedPod, setSelectedPod] = useState<string>("");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [tail, setTail] = useState(100);
  const [follow, setFollow] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: pods, isLoading: podsLoading } = useAppPods(
    k8sNamespace,
    k8sDeploymentName,
    clusterId
  );

  // Auto-select first pod
  useEffect(() => {
    if (pods?.length && !selectedPod) {
      setSelectedPod(pods[0].name);
    }
  }, [pods, selectedPod]);

  // Auto-select first container when pod changes
  const currentPod = pods?.find((p) => p.name === selectedPod);
  useEffect(() => {
    if (currentPod?.containers?.length) {
      setSelectedContainer(currentPod.containers[0].name);
    } else {
      setSelectedContainer("");
    }
  }, [currentPod]);

  const logOptions =
    selectedPod && k8sNamespace
      ? {
          clusterId,
          namespace: k8sNamespace,
          pod: selectedPod,
          container: selectedContainer || undefined,
          tail,
          follow,
        }
      : null;

  const { lines, isStreaming, error, clear } = usePodLogs(logOptions);

  // Auto-scroll when following
  useEffect(() => {
    if (follow && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines.length, follow]);

  if (app?.deployProvider === "vercel") {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Pod Logs</h3>
        <p className="text-sm text-muted-foreground">
          For Vercel deployments, view logs in the{" "}
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Vercel Dashboard
          </a>
        </p>
      </Card>
    );
  }

  if (app && app.deployProvider !== "kubernetes") {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Pod Logs</h3>
        <p className="text-sm text-muted-foreground">
          Log streaming is only available for Kubernetes deployments.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Cluster */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cluster</label>
            <select
              value={clusterId}
              onChange={(e) => {
                setClusterId(e.target.value as ClusterId);
                setSelectedPod("");
              }}
              className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
            </select>
          </div>

          {/* Pod */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Pod</label>
            <select
              value={selectedPod}
              onChange={(e) => setSelectedPod(e.target.value)}
              className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm max-w-[280px]"
              disabled={podsLoading || !pods?.length}
            >
              {!pods?.length && <option value="">No pods found</option>}
              {pods?.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* Container */}
          {currentPod && currentPod.containers.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Container</label>
              <select
                value={selectedContainer}
                onChange={(e) => setSelectedContainer(e.target.value)}
                className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              >
                {currentPod.containers.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tail */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tail lines</label>
            <select
              value={tail}
              onChange={(e) => setTail(Number(e.target.value))}
              className="block rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>

          {/* Follow toggle */}
          <Button
            variant={follow ? "default" : "outline"}
            size="sm"
            onClick={() => setFollow(!follow)}
            className="min-w-[80px]"
          >
            {follow ? (isStreaming ? "Streaming..." : "Following") : "Follow"}
          </Button>

          {/* Clear */}
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
        </div>
      </Card>

      {/* Log output */}
      <Card className="p-0 overflow-hidden">
        {error && (
          <div className="px-4 py-2 bg-red-500/10 text-red-500 text-xs border-b border-border">
            Error: {error}
          </div>
        )}
        <div className="bg-zinc-950 rounded-md max-h-[600px] overflow-auto p-4">
          {lines.length === 0 ? (
            <p className="text-zinc-500 text-sm font-mono">
              {podsLoading
                ? "Loading pods..."
                : !selectedPod
                  ? "Select a pod to view logs."
                  : follow
                    ? "Waiting for log data..."
                    : "No log lines returned."}
            </p>
          ) : (
            <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "hover:bg-zinc-800/50 px-1 -mx-1 rounded",
                    line.toLowerCase().includes("error") && "text-red-400",
                    line.toLowerCase().includes("warn") && "text-yellow-400"
                  )}
                >
                  {line}
                </div>
              ))}
              <div ref={logEndRef} />
            </pre>
          )}
        </div>
      </Card>
    </div>
  );
}
