"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TrustSource {
  status: string;
  ageSeconds?: number;
}

interface TrustBannerProps {
  trust?: {
    status: string;
    degradedSources: string[];
    summary: string;
    sources: Record<string, TrustSource>;
  } | null;
  isLoading?: boolean;
}

export function TrustBanner({ trust, isLoading = false }: TrustBannerProps) {
  const isDegraded = trust?.status === "degraded";

  return (
    <Card
      className={
        isDegraded
          ? "border-amber-900/70 bg-amber-950/35"
          : "border-emerald-900/60 bg-emerald-950/30"
      }
    >
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          {isLoading ? (
            <ShieldAlert className="mt-0.5 h-5 w-5 text-gray-400" />
          ) : isDegraded ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-300">
              Trust
            </p>
            <h2 className="text-xl font-semibold text-white">
              {isLoading ? "Checking release-control feeds" : trust?.summary ?? "Release-control data is healthy."}
            </h2>
            <p className="text-sm text-gray-300">
              {isLoading
                ? "Refreshing ArgoCD, Harbor, Prometheus, Kubernetes, and CI evidence."
                : isDegraded
                  ? "Promotion decisions should treat stale or degraded evidence as a blocker or explicit override path."
                  : "Critical upstream feeds are fresh enough to support release decisions."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(trust?.sources ?? {}).map(([source, signal]) => (
            <Badge
              key={source}
              variant={signal.status === "healthy" ? "success" : "warning"}
              className="capitalize"
            >
              {source}
              {typeof signal.ageSeconds === "number"
                ? ` ${Math.floor(signal.ageSeconds / 60)}m`
                : ""}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
