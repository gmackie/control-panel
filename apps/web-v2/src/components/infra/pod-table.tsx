"use client";

import { useClusterNodes, useClusterPods } from "@/hooks/use-cluster-data";
import { cn } from "@/lib/utils";

export function PodTable() {
  const { data: nodes, isLoading: nodesLoading } = useClusterNodes();
  const { data: pods, isLoading: podsLoading } = useClusterPods();

  return (
    <div className="space-y-8">
      {/* Cluster Nodes Table */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Cluster Nodes</h2>
        {nodesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : !nodes?.length ? (
          <p className="text-muted-foreground">No cluster nodes found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Node</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Cluster</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Status</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Role</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">CPU</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Memory</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Pods</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => {
                  const cpuPct = node.cpu.usageMillis != null
                    ? `${Math.round((node.cpu.usageMillis / node.cpu.allocatableMillis) * 100)}%`
                    : "\u2014";
                  const memPct = node.memory.usageBytes != null
                    ? `${Math.round((node.memory.usageBytes / node.memory.allocatableBytes) * 100)}%`
                    : "\u2014";
                  const podCount = pods
                    ? pods.filter((p) => p.nodeName === node.name && p.clusterId === node.clusterId).length
                    : undefined;

                  return (
                    <tr key={`${node.clusterId}-${node.name}`} className="border-b border-border/50 hover:bg-accent/50">
                      <td className="py-2 font-mono text-[13px] font-medium">{node.name}</td>
                      <td className="py-2 font-mono text-[13px] text-muted-foreground">
                        {node.clusterId === "production" ? "Production" : "Staging"}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full",
                              node.status === "Ready"
                                ? "bg-green-500"
                                : "bg-red-500"
                            )}
                          />
                          <span className="font-mono text-[13px]">{node.status}</span>
                        </div>
                      </td>
                      <td className="py-2 font-mono text-[13px] text-muted-foreground capitalize">
                        {node.roles.join(", ")}
                      </td>
                      <td className="py-2 font-mono text-[13px] tabular-nums text-muted-foreground">{cpuPct}</td>
                      <td className="py-2 font-mono text-[13px] tabular-nums text-muted-foreground">{memPct}</td>
                      <td className="py-2 font-mono text-[13px] tabular-nums text-muted-foreground">
                        {podCount != null ? `${podCount}/${node.pods.capacity}` : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pod List Table */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Pods</h2>
        {podsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : !pods?.length ? (
          <p className="text-muted-foreground">No pods found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Pod</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Namespace</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Cluster</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Status</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Ready</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Restarts</th>
                  <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Node</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((pod) => (
                  <tr key={`${pod.clusterId}-${pod.namespace}-${pod.name}`} className="border-b border-border/50 hover:bg-accent/50">
                    <td className="py-2 font-mono text-[13px] font-medium">{pod.name}</td>
                    <td className="py-2 font-mono text-[13px] text-muted-foreground">{pod.namespace}</td>
                    <td className="py-2 font-mono text-[13px] text-muted-foreground">
                      {pod.clusterId === "production" ? "Prod" : "Staging"}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            pod.status === "Running"
                              ? "bg-green-500"
                              : pod.status === "Pending"
                                ? "bg-yellow-500"
                                : pod.status === "Failed"
                                  ? "bg-red-500"
                                  : "bg-neutral-400"
                          )}
                        />
                        <span className="font-mono text-[13px]">{pod.status}</span>
                      </div>
                    </td>
                    <td className="py-2 font-mono text-[13px] tabular-nums text-muted-foreground">{pod.ready}</td>
                    <td className="py-2 font-mono text-[13px] tabular-nums text-muted-foreground">{pod.restarts}</td>
                    <td className="py-2 font-mono text-[13px] text-muted-foreground">{pod.nodeName ?? "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
