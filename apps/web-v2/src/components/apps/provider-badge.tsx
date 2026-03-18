import { cn } from "@/lib/utils";

export function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] font-medium uppercase tracking-wide",
        {
          "bg-blue-500/10 text-blue-400": provider === "k8s",
          "bg-neutral-500/10 text-neutral-400": provider === "vercel",
          "bg-orange-500/10 text-orange-400": provider === "gitea",
          "bg-purple-500/10 text-purple-400": provider === "github",
        }
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-blue-400": provider === "k8s",
        "bg-neutral-400": provider === "vercel",
        "bg-orange-400": provider === "gitea",
        "bg-purple-400": provider === "github",
      })} />
      {provider}
    </span>
  );
}
