"use client";

import { Badge } from "@/components/ui/badge";
import { GitBranch, Cloud, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProviderConfig {
  label: string;
  color: string;
  bgColor: string;
}

const GIT_PROVIDERS: Record<string, ProviderConfig> = {
  github: { label: "GitHub", color: "text-gray-100", bgColor: "bg-gray-700" },
  gitea: { label: "Gitea", color: "text-green-100", bgColor: "bg-green-700" },
  gitlab: { label: "GitLab", color: "text-orange-100", bgColor: "bg-orange-700" },
};

const DEPLOY_PROVIDERS: Record<string, ProviderConfig> = {
  vercel: { label: "Vercel", color: "text-white", bgColor: "bg-black" },
  kubernetes: { label: "K8s", color: "text-blue-100", bgColor: "bg-blue-700" },
  railway: { label: "Railway", color: "text-purple-100", bgColor: "bg-purple-700" },
  flyio: { label: "Fly.io", color: "text-violet-100", bgColor: "bg-violet-700" },
};

const DB_PROVIDERS: Record<string, ProviderConfig> = {
  neon: { label: "Neon", color: "text-green-100", bgColor: "bg-green-600" },
  turso: { label: "Turso", color: "text-teal-100", bgColor: "bg-teal-700" },
  supabase: { label: "Supabase", color: "text-emerald-100", bgColor: "bg-emerald-700" },
  planetscale: { label: "PlanetScale", color: "text-slate-100", bgColor: "bg-slate-700" },
};

interface ProviderBadgeProps {
  type: "git" | "deploy" | "db";
  provider: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function ProviderBadge({ type, provider, showIcon = true, size = "sm" }: ProviderBadgeProps) {
  const configs = type === "git" ? GIT_PROVIDERS : type === "deploy" ? DEPLOY_PROVIDERS : DB_PROVIDERS;
  const config = configs[provider] || { label: provider, color: "text-zinc-100", bgColor: "bg-zinc-700" };
  
  const Icon = type === "git" ? GitBranch : type === "deploy" ? Cloud : Database;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium",
        config.color,
        config.bgColor,
        textSize,
        padding
      )}
    >
      {showIcon && <Icon className={iconSize} />}
      {config.label}
    </span>
  );
}

interface ProviderBadgesProps {
  gitProvider?: string;
  deployProvider?: string;
  dbProvider?: string;
  showIcons?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ProviderBadges({
  gitProvider,
  deployProvider,
  dbProvider,
  showIcons = true,
  size = "sm",
  className,
}: ProviderBadgesProps) {
  const hasAnyProvider = gitProvider || deployProvider || dbProvider;
  
  if (!hasAnyProvider) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {gitProvider && (
        <ProviderBadge type="git" provider={gitProvider} showIcon={showIcons} size={size} />
      )}
      {deployProvider && (
        <ProviderBadge type="deploy" provider={deployProvider} showIcon={showIcons} size={size} />
      )}
      {dbProvider && (
        <ProviderBadge type="db" provider={dbProvider} showIcon={showIcons} size={size} />
      )}
    </div>
  );
}

interface ProviderStackProps {
  gitProvider?: string;
  deployProvider?: string;
  dbProvider?: string;
}

export function ProviderStack({ gitProvider, deployProvider, dbProvider }: ProviderStackProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      {gitProvider && (
        <div className="flex items-center gap-1" title={`Git: ${GIT_PROVIDERS[gitProvider]?.label || gitProvider}`}>
          <GitBranch className="h-3.5 w-3.5" />
        </div>
      )}
      {deployProvider && (
        <div className="flex items-center gap-1" title={`Deploy: ${DEPLOY_PROVIDERS[deployProvider]?.label || deployProvider}`}>
          <Cloud className="h-3.5 w-3.5" />
        </div>
      )}
      {dbProvider && (
        <div className="flex items-center gap-1" title={`Database: ${DB_PROVIDERS[dbProvider]?.label || dbProvider}`}>
          <Database className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
