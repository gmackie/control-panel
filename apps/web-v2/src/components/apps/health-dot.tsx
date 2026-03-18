import { cn } from "@/lib/utils";
import type { AppStatus } from "@/types/app";

export function HealthDot({ status, size = "md" }: { status: AppStatus; size?: "sm" | "md" }) {
  return (
    <div
      className={cn("rounded-full", {
        "h-2 w-2": size === "sm",
        "h-2.5 w-2.5": size === "md",
        "bg-green-500": status === "healthy",
        "bg-yellow-500": status === "degraded",
        "bg-red-500": status === "unhealthy",
        "bg-neutral-400": status === "unknown",
      })}
    />
  );
}
