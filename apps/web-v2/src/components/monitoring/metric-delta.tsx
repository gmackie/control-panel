import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface MetricDeltaProps {
  label: string;
  current: number;
  previous: number;
  unit?: string;
  /** If true, an increase is good (e.g., uptime). Default false (increase = bad). */
  invertColor?: boolean;
  className?: string;
}

function formatValue(value: number, unit?: string): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "ms") return `${Math.round(value)}ms`;
  if (unit === "MB") return `${Math.round(value)} MB`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(1);
}

export function MetricDelta({
  label,
  current,
  previous,
  unit,
  invertColor = false,
  className,
}: MetricDeltaProps) {
  const diff = current - previous;
  const percentChange =
    previous !== 0 ? ((diff / previous) * 100) : diff !== 0 ? 100 : 0;
  const isNeutral = Math.abs(percentChange) < 5;
  const isIncrease = diff > 0;

  // Determine if this change is "good" or "bad"
  const isGood = invertColor ? isIncrease : !isIncrease;

  const deltaColor = isNeutral
    ? "text-muted-foreground"
    : isGood
      ? "text-green-500"
      : "text-red-400";

  const DeltaIcon = isNeutral ? Minus : isIncrease ? ArrowUp : ArrowDown;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-[13px] tabular-nums">
        {formatValue(current, unit)}
      </span>
      <span className={cn("flex items-center gap-0.5 font-mono text-[11px] tabular-nums", deltaColor)}>
        <DeltaIcon className="h-3 w-3" />
        {isNeutral ? "—" : `${Math.abs(percentChange).toFixed(0)}%`}
      </span>
    </div>
  );
}
