"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  status: "success" | "running" | "failed" | "info" | "pending";
  title: string;
  detail?: string;
  duration?: string;
  expandable?: boolean;
  expandedContent?: string;
}

interface DeployTimelineProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
  className?: string;
}

const statusDotColor = {
  success: "bg-green-500",
  running: "bg-primary animate-pulse",
  failed: "bg-red-500",
  info: "bg-blue-400",
  pending: "bg-muted-foreground/30",
} as const;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function DeployTimeline({
  events,
  onEventClick,
  className,
}: DeployTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn("space-y-0", className)}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const isExpanded = expandedIds.has(event.id);

        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0 mt-1.5",
                  statusDotColor[event.status]
                )}
              />
              {!isLast && (
                <div className="w-px flex-1 bg-border min-h-[24px]" />
              )}
            </div>

            {/* Event content */}
            <div
              className={cn(
                "flex-1 pb-4 min-w-0",
                onEventClick && "cursor-pointer"
              )}
              onClick={() => {
                if (event.expandable) {
                  toggleExpanded(event.id);
                } else {
                  onEventClick?.(event);
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {event.expandable && (
                    <span className="text-muted-foreground shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </span>
                  )}
                  <p
                    className={cn(
                      "text-sm truncate",
                      event.status === "failed" && "text-red-400",
                      event.status === "running" && "text-primary",
                      event.status === "pending" && "text-dim"
                    )}
                  >
                    {event.title}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {event.duration && (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {event.duration}
                    </span>
                  )}
                  <span className="font-mono text-[11px] tabular-nums text-dim">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              </div>

              {event.detail && (
                <p className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
                  {event.detail}
                </p>
              )}

              {isExpanded && event.expandedContent && (
                <div className="mt-2 p-3 rounded-md bg-[hsl(264,8%,6%)] border border-border">
                  <pre className="font-mono text-[12px] text-foreground/70 whitespace-pre-wrap">
                    {event.expandedContent}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
