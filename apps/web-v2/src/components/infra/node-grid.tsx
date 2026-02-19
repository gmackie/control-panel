"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function NodeGrid() {
  const { data: servers, isLoading } = trpc.infrastructure.servers.useQuery();

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Nodes</h2>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : !servers?.length ? (
        <p className="text-muted-foreground">No servers found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {servers.map((server) => (
            <Card key={server.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{server.name}</span>
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    server.status === "running" ? "bg-green-500" : "bg-zinc-500"
                  )}
                />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>IP</span>
                  <span className="font-mono">{server.publicIp}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type</span>
                  <span>{server.type}</span>
                </div>
                <div className="flex justify-between">
                  <span>Location</span>
                  <span>{server.datacenter}</span>
                </div>
                <div className="flex justify-between">
                  <span>Resources</span>
                  <span>
                    {server.cpu} vCPU / {server.memory}GB RAM / {server.disk}GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cost</span>
                  <span>&euro;{server.monthlyPrice?.toFixed(2)}/mo</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
