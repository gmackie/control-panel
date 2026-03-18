"use client";

import { useClusterNodes } from "@/hooks/use-cluster-data";
import { formatBytes, formatCpu } from "@/lib/cluster/k8s-resource-utils";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function NodeGrid() {
  const { data: nodes, isLoading } = useClusterNodes();

  return (
    <section>
      <h2 className="font-display text-lg font-semibold mb-4">Nodes</h2>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : !nodes?.length ? (
        <p className="text-muted-foreground">No nodes found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {nodes.map((node) => (
            <Card key={`${node.clusterId}-${node.name}`} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-sm">{node.name}</span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {node.clusterId === "production" ? "prod" : "staging"}
                  </span>
                </div>
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    node.status === "Ready" ? "bg-green-500" : "bg-red-500"
                  )}
                />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>IP</span>
                  <span className="font-mono">{node.internalIP}</span>
                </div>
                <div className="flex justify-between">
                  <span>Role</span>
                  <span className="font-mono capitalize">{node.roles.join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version</span>
                  <span className="font-mono">{node.kubeletVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span>CPU</span>
                  <span className="font-mono tabular-nums">
                    {node.cpu.usageMillis != null
                      ? `${formatCpu(node.cpu.usageMillis)} / ${formatCpu(node.cpu.allocatableMillis)}`
                      : formatCpu(node.cpu.allocatableMillis)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory</span>
                  <span className="font-mono tabular-nums">
                    {node.memory.usageBytes != null
                      ? `${formatBytes(node.memory.usageBytes)} / ${formatBytes(node.memory.allocatableBytes)}`
                      : formatBytes(node.memory.allocatableBytes)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Runtime</span>
                  <span className="font-mono">{node.containerRuntime}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
