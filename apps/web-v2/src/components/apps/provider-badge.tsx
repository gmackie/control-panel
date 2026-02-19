import { cn } from "@/lib/utils";

export function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
        {
          "bg-blue-500/10 text-blue-400": provider === "k8s",
          "bg-zinc-500/10 text-zinc-400": provider === "vercel",
          "bg-orange-500/10 text-orange-400": provider === "gitea",
          "bg-purple-500/10 text-purple-400": provider === "github",
        }
      )}
    >
      {provider}
    </span>
  );
}
