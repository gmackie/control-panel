"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MetricDelta } from "@/components/monitoring/metric-delta";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ReleaseQueueItem } from "@/types/release";

interface ReleaseHistoryProps {
  items: ReleaseQueueItem[];
  onRowClick?: (item: ReleaseQueueItem) => void;
  defaultExpanded?: boolean;
}

const outcomeBadgeVariant: Record<string, "success" | "error" | "warning" | "secondary"> = {
  healthy: "success",
  succeeded: "success",
  deployed: "success",
  failed: "error",
  rolled_back: "warning",
  canceled: "secondary",
  superseded: "secondary",
};

export function ReleaseHistory({
  items,
  onRowClick,
  defaultExpanded = false,
}: ReleaseHistoryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Release History ({items.length})
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(item)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge
                  variant={outcomeBadgeVariant[item.status] ?? "secondary"}
                  className="font-mono text-[11px] shrink-0"
                >
                  {item.status}
                </Badge>
                <span className="font-medium text-sm truncate">
                  {item.appName}
                </span>
                <span className="font-mono text-[13px] text-muted-foreground shrink-0">
                  {item.version}
                </span>
                <Badge variant="secondary" className="font-mono text-[11px] shrink-0">
                  {item.environment}
                </Badge>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {/* Impact deltas */}
                {item.impact?.errorRate && (
                  <MetricDelta
                    label=""
                    current={item.impact.errorRate.current}
                    previous={item.impact.errorRate.previous}
                    unit="%"
                  />
                )}
                {item.impact?.latency && (
                  <MetricDelta
                    label=""
                    current={item.impact.latency.current}
                    previous={item.impact.latency.previous}
                    unit="ms"
                  />
                )}

                <span className="font-mono text-[11px] text-dim w-24 text-right">
                  {formatDistanceToNow(new Date(item.startedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
