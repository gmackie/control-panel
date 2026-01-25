"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Cloud, Database, Lock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWizard,
  GIT_PROVIDERS,
  DEPLOY_PROVIDERS,
  DB_PROVIDERS,
} from "./wizard-context";

interface ProviderCardProps {
  value: string;
  label: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
  recommended?: boolean;
}

function ProviderCard({
  value,
  label,
  description,
  isSelected,
  onSelect,
  recommended,
}: ProviderCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "p-4 cursor-pointer transition-all border-2",
        isSelected
          ? "border-blue-500 bg-blue-500/10"
          : "border-zinc-800 hover:border-zinc-700 bg-zinc-900"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{label}</span>
            {recommended && (
              <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                Recommended
              </Badge>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        </div>
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
            isSelected ? "border-blue-500 bg-blue-500" : "border-zinc-600"
          )}
        >
          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
      </div>
    </Card>
  );
}

export function ProvidersStep() {
  const { state, updateForm } = useWizard();
  const { form, errors } = state;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Configure Providers</h2>
        <p className="text-zinc-400 text-sm">
          Select your preferred providers for version control, deployment, and database.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-zinc-400" />
          <Label className="text-base font-medium">Git Provider</Label>
        </div>
        <div className="grid gap-3">
          {GIT_PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.value}
              value={provider.value}
              label={provider.label}
              description={provider.description}
              isSelected={form.gitProvider === provider.value}
              onSelect={() => updateForm("gitProvider", provider.value as "github" | "gitea")}
              recommended={provider.value === "github"}
            />
          ))}
        </div>
        {errors.gitProvider && (
          <p className="text-sm text-red-400">{errors.gitProvider}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-zinc-400" />
          <Label className="text-base font-medium">Deploy Provider</Label>
        </div>
        <div className="grid gap-3">
          {DEPLOY_PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.value}
              value={provider.value}
              label={provider.label}
              description={provider.description}
              isSelected={form.deployProvider === provider.value}
              onSelect={() => updateForm("deployProvider", provider.value as "vercel" | "kubernetes")}
              recommended={provider.value === "vercel"}
            />
          ))}
        </div>
        {errors.deployProvider && (
          <p className="text-sm text-red-400">{errors.deployProvider}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-zinc-400" />
          <Label className="text-base font-medium">Database Provider</Label>
        </div>
        <div className="grid gap-3">
          {DB_PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.value}
              value={provider.value}
              label={provider.label}
              description={provider.description}
              isSelected={form.dbProvider === provider.value}
              onSelect={() => updateForm("dbProvider", provider.value as "neon" | "turso" | "supabase")}
              recommended={provider.value === "neon"}
            />
          ))}
        </div>
        {errors.dbProvider && (
          <p className="text-sm text-red-400">{errors.dbProvider}</p>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {form.repoVisibility === "private" ? (
              <Lock className="w-5 h-5 text-zinc-400" />
            ) : (
              <Globe className="w-5 h-5 text-zinc-400" />
            )}
            <div>
              <Label className="text-base font-medium">Repository Visibility</Label>
              <p className="text-sm text-zinc-400">
                {form.repoVisibility === "private"
                  ? "Only you can see this repository"
                  : "Anyone can see this repository"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Private</span>
            <Switch
              checked={form.repoVisibility === "public"}
              onCheckedChange={(checked) =>
                updateForm("repoVisibility", checked ? "public" : "private")
              }
            />
            <span className="text-sm text-zinc-400">Public</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Auto-Provision Resources</Label>
            <p className="text-sm text-zinc-400">
              Automatically create database and configure integrations
            </p>
          </div>
          <Switch
            checked={form.autoProvision}
            onCheckedChange={(checked) => updateForm("autoProvision", checked)}
          />
        </div>
      </div>
    </div>
  );
}
