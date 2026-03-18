"use client";

import { SparklineCard } from "./sparkline-card";

export interface HealthMetric {
  label: string;
  value: string;
  delta?: { change: number };
  data?: number[];
  deployMarkers?: number[];
  threshold?: { value: number; type: "above" | "below" };
}

interface HealthOverviewStripProps {
  metrics: HealthMetric[];
  className?: string;
}

export function HealthOverviewStrip({ metrics, className }: HealthOverviewStripProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metrics.map((metric) => (
          <SparklineCard key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  );
}
