"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineStepper } from "@/components/pipeline/pipeline-stepper";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ReleaseQueueItem } from "@/types/release";

interface ReleaseQueueProps {
  items: ReleaseQueueItem[];
  onRowClick?: (item: ReleaseQueueItem) => void;
  onPromote?: (id: string) => void;
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "success" | "warning" | "error"> = {
  healthy: "success",
  succeeded: "success",
  deployed: "success",
  published: "success",
  ready: "success",
  failed: "error",
  rolled_back: "warning",
  canceled: "secondary",
  superseded: "secondary",
  draft: "secondary",
  building: "secondary",
  testing: "secondary",
  deploying: "secondary",
  verifying: "secondary",
  pending_approval: "warning",
  awaiting_approval: "warning",
};

const environments = ["all", "production", "staging", "development"] as const;

export function ReleaseQueue({
  items,
  onRowClick,
  onPromote,
}: ReleaseQueueProps) {
  const [envFilter, setEnvFilter] = useState<string>("all");

  const filtered =
    envFilter === "all"
      ? items
      : items.filter((item) => item.environment === envFilter);

  return (
    <div className="space-y-4">
      {/* Filter */}
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

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No releases found{envFilter !== "all" ? ` for ${envFilter}` : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">App</th>
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Version</th>
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Env</th>
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Status</th>
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Pipeline</th>
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Triggered</th>
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Started</th>
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Duration</th>
                <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-border/50 hover:bg-accent/50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  <td className="py-2.5 font-medium">{item.appName}</td>
                  <td className="py-2.5 font-mono text-[13px]">{item.version}</td>
                  <td className="py-2.5">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {item.environment}
                    </Badge>
                  </td>
                  <td className="py-2.5">
                    <Badge
                      variant={statusBadgeVariant[item.status] ?? "secondary"}
                      className="font-mono text-[11px]"
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-2.5">
                    <PipelineStepper steps={item.steps} compact />
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                    {item.triggeredBy}
                  </td>
                  <td className="py-2.5 font-mono text-[13px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.startedAt), { addSuffix: true })}
                  </td>
                  <td className="py-2.5 font-mono text-[13px] tabular-nums text-muted-foreground">
                    {item.durationMs != null
                      ? item.durationMs < 60000
                        ? `${Math.floor(item.durationMs / 1000)}s`
                        : `${Math.floor(item.durationMs / 60000)}m ${Math.floor((item.durationMs % 60000) / 1000)}s`
                      : "—"}
                  </td>
                  <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                    {item.status === "healthy" &&
                      item.environment === "staging" &&
                      onPromote && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPromote(item.id)}
                        >
                          Promote
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
