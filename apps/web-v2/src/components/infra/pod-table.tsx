"use client";

import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Renders node rows for a single cluster.
 * Using a child component lets us call useQuery per-cluster
 * without violating the rules of hooks.
 */
function ClusterNodeRows({ clusterId, clusterName }: { clusterId: string; clusterName: string }) {
  const { data: cluster, isLoading } = trpc.clusters.byId.useQuery(clusterId);

  if (isLoading) {
    return (
      <tr>
        <td colSpan={7} className="py-2 text-muted-foreground">
          Loading nodes for {clusterName}...
        </td>
      </tr>
    );
  }

  const nodes = cluster?.nodes ?? [];

  if (!nodes.length) {
    return (
      <tr>
        <td colSpan={7} className="py-2 text-muted-foreground">
          No nodes in {clusterName}
        </td>
      </tr>
    );
  }

  return (
    <>
      {nodes.map((node) => (
        <tr key={node.id} className="border-b border-border/50">
          <td className="py-2 font-medium">{node.name}</td>
          <td className="py-2 text-muted-foreground">{clusterName}</td>
          <td className="py-2">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  node.status === "ready"
                    ? "bg-green-500"
                    : node.status === "not_ready"
                      ? "bg-red-500"
                      : "bg-zinc-500"
                )}
              />
              <span className="capitalize">{node.status?.replace("_", " ")}</span>
            </div>
          </td>
          <td className="py-2 text-muted-foreground capitalize">
            {node.role?.replace("-", " ")}
          </td>
          <td className="py-2 text-muted-foreground">
            {node.cpu
              ? `${((node.cpu.used / node.cpu.total) * 100).toFixed(0)}%`
              : "\u2014"}
          </td>
          <td className="py-2 text-muted-foreground">
            {node.memory
              ? `${((node.memory.used / node.memory.total) * 100).toFixed(0)}%`
              : "\u2014"}
          </td>
          <td className="py-2 text-muted-foreground">
            {node.pods ? `${node.pods.running}/${node.pods.total}` : "\u2014"}
          </td>
        </tr>
      ))}
    </>
  );
}

export function PodTable() {
  const { data: clusters, isLoading } = trpc.clusters.list.useQuery();

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Cluster Nodes</h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : !clusters?.length ? (
        <p className="text-muted-foreground">No cluster nodes found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium">Node</th>
                <th className="pb-2 font-medium">Cluster</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">CPU</th>
                <th className="pb-2 font-medium">Memory</th>
                <th className="pb-2 font-medium">Pods</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster) => (
                <ClusterNodeRows
                  key={cluster.id}
                  clusterId={cluster.id}
                  clusterName={cluster.name}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
