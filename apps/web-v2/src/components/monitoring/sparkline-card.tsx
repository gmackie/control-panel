import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface SparklineCardProps {
  label: string;
  value: string;
  delta?: { change: number; period?: string };
  data?: number[];
  deployMarkers?: number[];
  threshold?: { value: number; type: "above" | "below" };
  className?: string;
}

/** Renders an inline SVG sparkline from a data array */
function Sparkline({
  data,
  deployMarkers,
  className,
}: {
  data: number[];
  deployMarkers?: number[];
  className?: string;
}) {
  if (data.length < 2) return null;

  const width = 120;
  const height = 32;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  // Gradient fill below the line
  const fillPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${width - padding},${height - padding}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full h-8", className)}
      preserveAspectRatio="none"
    >
      {/* Fill */}
      <polygon
        points={fillPoints}
        className="fill-primary/10"
      />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        className="stroke-primary"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Deploy markers */}
      {deployMarkers?.map((markerIndex) => {
        if (markerIndex < 0 || markerIndex >= data.length) return null;
        const x =
          padding + (markerIndex / (data.length - 1)) * (width - padding * 2);
        return (
          <line
            key={markerIndex}
            x1={x}
            y1={padding}
            x2={x}
            y2={height - padding}
            className="stroke-secondary"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        );
      })}
    </svg>
  );
}

export function SparklineCard({
  label,
  value,
  delta,
  data,
  deployMarkers,
  threshold,
  className,
}: SparklineCardProps) {
  const isOverThreshold =
    threshold &&
    ((threshold.type === "above" && parseFloat(value) > threshold.value) ||
      (threshold.type === "below" && parseFloat(value) < threshold.value));

  const deltaIsNeutral = !delta || Math.abs(delta.change) < 5;
  const deltaIsGood = delta ? delta.change <= 0 : true;

  const DeltaIcon = deltaIsNeutral
    ? Minus
    : delta && delta.change > 0
      ? ArrowUp
      : ArrowDown;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm transition-colors",
        isOverThreshold ? "border-red-500/30" : "border-border",
        className
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {delta && (
          <span
            className={cn(
              "flex items-center gap-0.5 font-mono text-[11px] tabular-nums",
              deltaIsNeutral
                ? "text-muted-foreground"
                : deltaIsGood
                  ? "text-green-500"
                  : "text-red-400"
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {deltaIsNeutral ? "—" : `${Math.abs(delta.change).toFixed(0)}%`}
          </span>
        )}
      </div>

      <p
        className={cn(
          "font-mono text-lg font-bold tabular-nums",
          isOverThreshold ? "text-red-400" : "text-foreground"
        )}
      >
        {value}
      </p>

      {data && data.length > 1 && (
        <div className="mt-2">
          <Sparkline data={data} deployMarkers={deployMarkers} />
        </div>
      )}
    </div>
  );
}
