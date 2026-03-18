"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AlertEvent {
  id: string;
  timestamp: string;
  severity: "critical" | "warning" | "info";
  status: "firing" | "resolved" | "acknowledged";
  message: string;
  source: string;
  app?: string;
  environment?: string;
  deployCorrelation?: string;
  externalUrl?: string;
}

interface AlertTimelineProps {
  alerts: AlertEvent[];
  onAcknowledge?: (id: string) => void;
  onAlertClick?: (alert: AlertEvent) => void;
}

const severityDotColor = {
  critical: "bg-red-500",
  warning: "bg-yellow-500",
  info: "bg-blue-400",
} as const;

const severities = ["all", "critical", "warning", "info"] as const;
const statuses = ["all", "firing", "resolved"] as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AlertTimeline({
  alerts,
  onAcknowledge,
  onAlertClick,
}: AlertTimelineProps) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = alerts.filter((a) => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {severities.map((sev) => (
            <Button
              key={sev}
              variant={severityFilter === sev ? "default" : "outline"}
              size="sm"
              onClick={() => setSeverityFilter(sev)}
              className="capitalize text-xs h-7"
            >
              {sev}
            </Button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          {statuses.map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className="capitalize text-xs h-7"
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No alerts match the current filters.
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                alert.status === "resolved" ? "opacity-50" : "hover:bg-accent/50",
                onAlertClick && "cursor-pointer"
              )}
              onClick={() => onAlertClick?.(alert)}
            >
              {/* Time */}
              <span className="font-mono text-[11px] tabular-nums text-dim w-12 shrink-0">
                {formatTime(alert.timestamp)}
              </span>

              {/* Severity dot */}
              <div className={cn("h-2 w-2 rounded-full shrink-0", severityDotColor[alert.severity])} />

              {/* Severity badge */}
              <Badge
                variant={alert.severity === "critical" ? "error" : alert.severity === "warning" ? "warning" : "secondary"}
                className="font-mono text-[11px] shrink-0 w-16 justify-center"
              >
                {alert.severity}
              </Badge>

              {/* Message */}
              <span className="text-sm truncate flex-1 min-w-0">{alert.message}</span>

              {/* Deploy correlation */}
              {alert.deployCorrelation && (
                <span className="font-mono text-[11px] text-secondary shrink-0">
                  since {alert.deployCorrelation}
                </span>
              )}

              {/* App/env */}
              {alert.app && (
                <Badge variant="secondary" className="font-mono text-[11px] shrink-0">
                  {alert.app}
                </Badge>
              )}

              {/* Actions */}
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                {alert.status === "firing" && onAcknowledge && (
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onAcknowledge(alert.id)}>
                    Ack
                  </Button>
                )}
                {alert.externalUrl && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                    <a href={alert.externalUrl} target="_blank" rel="noopener noreferrer">View</a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
