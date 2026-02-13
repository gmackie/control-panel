import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeSize = "sm" | "md";

interface ProviderBadgesProps {
  gitProvider?: string | null;
  deployProvider?: string | null;
  dbProvider?: string | null;
  size?: BadgeSize;
  className?: string;
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "github":
      return "GitHub";
    case "gitea":
      return "Gitea";
    case "gitlab":
      return "GitLab";
    case "vercel":
      return "Vercel";
    case "kubernetes":
      return "K8s";
    case "turso":
      return "Turso";
    case "neon":
      return "Neon";
    case "supabase":
      return "Supabase";
    case "planetscale":
      return "PlanetScale";
    case "railway":
      return "Railway";
    case "flyio":
      return "Fly";
    default:
      return provider;
  }
}

function providerBadgeClass(provider: string): string {
  switch (provider) {
    case "github":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "gitea":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "gitlab":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "vercel":
      return "border-gray-500/30 bg-gray-500/10 text-gray-200";
    case "kubernetes":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
    case "turso":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "neon":
      return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300";
    case "supabase":
      return "border-green-500/30 bg-green-500/10 text-green-300";
    case "planetscale":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    default:
      return "border-gray-700 bg-gray-900 text-gray-300";
  }
}

export function ProviderBadges({
  gitProvider,
  deployProvider,
  dbProvider,
  size = "md",
  className,
}: ProviderBadgesProps) {
  const providers: Array<{ kind: "git" | "deploy" | "db"; value: string }> = [];
  if (gitProvider) providers.push({ kind: "git", value: gitProvider });
  if (deployProvider) providers.push({ kind: "deploy", value: deployProvider });
  if (dbProvider) providers.push({ kind: "db", value: dbProvider });

  if (providers.length === 0) return null;

  const sizeClass = size === "sm" ? "text-[10px] px-2 py-0" : "";

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {providers.map((p) => (
        <Badge
          key={`${p.kind}:${p.value}`}
          variant="outline"
          className={cn(
            "capitalize",
            sizeClass,
            providerBadgeClass(p.value)
          )}
          title={`${p.kind} provider`}
        >
          {providerLabel(p.value)}
        </Badge>
      ))}
    </div>
  );
}
