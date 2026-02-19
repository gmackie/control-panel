"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthDot } from "./health-dot";
import { cn } from "@/lib/utils";
import type { AppSummary } from "@/types/app";

interface AppSlideOverProps {
  app: AppSummary | null;
  onClose: () => void;
}

export function AppSlideOver({ app, onClose }: AppSlideOverProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          app ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[480px] bg-card border-l border-border shadow-2xl transition-transform duration-200",
          app ? "translate-x-0" : "translate-x-full"
        )}
      >
        {app && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <HealthDot status={app.status} />
                <h2 className="font-semibold">{app.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/apps/${app.slug}`}>
                  <Button variant="outline" size="sm">
                    Open <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Environments */}
              <section>
                <h3 className="text-sm font-medium mb-3">Environments</h3>
                <div className="space-y-2">
                  {app.environments.map((env) => (
                    <div
                      key={env.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <HealthDot status={env.status} size="sm" />
                        <span className="text-sm capitalize">{env.provider} {env.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {env.podCount
                          ? `${env.podCount.ready}/${env.podCount.total} pods`
                          : env.vercelStatus}
                        {env.version && ` • ${env.version}`}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Metrics */}
              {app.metrics && (
                <section>
                  <h3 className="text-sm font-medium mb-3">Current Metrics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "CPU", value: `${app.metrics.cpuPercent}%` },
                      { label: "Memory", value: `${app.metrics.memPercent}%` },
                      { label: "Error Rate", value: `${app.metrics.errorRate}%` },
                      { label: "P95 Latency", value: `${app.metrics.p95Latency}ms` },
                    ].map((m) => (
                      <div key={m.label} className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-lg font-semibold">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Placeholder for recent deploys */}
              <section>
                <h3 className="text-sm font-medium mb-3">Recent Deployments</h3>
                <p className="text-sm text-muted-foreground">Loading...</p>
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
