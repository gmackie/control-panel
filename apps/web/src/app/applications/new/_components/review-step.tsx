"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  GitBranch,
  Cloud,
  Database,
  Lock,
  Globe,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import {
  useWizard,
  GIT_PROVIDERS,
  DEPLOY_PROVIDERS,
  DB_PROVIDERS,
} from "./wizard-context";

interface ProvisioningResult {
  step: string;
  provider: string;
  status: "pending" | "success" | "failed" | "skipped";
  message?: string;
}

interface ReviewStepProps {
  provisioningResults?: ProvisioningResult[];
}

export function ReviewStep({ provisioningResults }: ReviewStepProps) {
  const { state } = useWizard();
  const { form, isSubmitting } = state;

  const { data: templateData } = trpc.templates.byId.useQuery(form.templateId, {
    enabled: !!form.templateId,
  });

  const gitProviderLabel = useMemo(
    () => GIT_PROVIDERS.find((p) => p.value === form.gitProvider)?.label || form.gitProvider,
    [form.gitProvider]
  );

  const deployProviderLabel = useMemo(
    () => DEPLOY_PROVIDERS.find((p) => p.value === form.deployProvider)?.label || form.deployProvider,
    [form.deployProvider]
  );

  const dbProviderLabel = useMemo(
    () => DB_PROVIDERS.find((p) => p.value === form.dbProvider)?.label || form.dbProvider,
    [form.dbProvider]
  );

  const selectedModuleNames = useMemo(() => {
    if (!templateData?.metadata?.integrations) return form.selectedModules;
    return form.selectedModules.map((id) => {
      const integration = templateData.metadata?.integrations.find((m) => m.id === id);
      return integration?.name || id;
    });
  }, [templateData, form.selectedModules]);

  if (provisioningResults) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">Creating Application</h2>
          <p className="text-zinc-400 text-sm">
            Setting up your application and provisioning resources...
          </p>
        </div>

        <div className="space-y-3">
          {provisioningResults.map((result, index) => (
            <div
              key={`${result.step}-${index}`}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                result.status === "success" && "border-green-500/30 bg-green-500/10",
                result.status === "failed" && "border-red-500/30 bg-red-500/10",
                result.status === "skipped" && "border-zinc-700 bg-zinc-800/50",
                result.status === "pending" && "border-zinc-700 bg-zinc-900"
              )}
            >
              {result.status === "pending" && (
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              )}
              {result.status === "success" && (
                <CheckCircle className="w-5 h-5 text-green-400" />
              )}
              {result.status === "failed" && (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              {result.status === "skipped" && (
                <AlertCircle className="w-5 h-5 text-zinc-400" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-white capitalize">
                  {result.step.replace(/_/g, " ")}
                </p>
                {result.message && (
                  <p className="text-xs text-zinc-400">{result.message}</p>
                )}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  result.status === "success" && "border-green-500/50 text-green-400",
                  result.status === "failed" && "border-red-500/50 text-red-400",
                  result.status === "skipped" && "border-zinc-600 text-zinc-400"
                )}
              >
                {result.provider}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Review & Create</h2>
        <p className="text-zinc-400 text-sm">
          Review your configuration before creating the application.
        </p>
      </div>

      <Card className="p-4 bg-zinc-900 border-zinc-800">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Package className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{form.appName}</h3>
            <p className="text-sm text-zinc-400">/{form.appSlug}</p>
            {form.description && (
              <p className="text-sm text-zinc-500 mt-1">{form.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-400">
              <Package className="w-4 h-4" />
              <span className="text-sm">Template</span>
            </div>
            <span className="text-sm text-white">
              {templateData?.name || form.templateId}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-400">
              <GitBranch className="w-4 h-4" />
              <span className="text-sm">Git Provider</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">{gitProviderLabel}</span>
              {form.repoVisibility === "private" ? (
                <Lock className="w-3 h-3 text-zinc-500" />
              ) : (
                <Globe className="w-3 h-3 text-zinc-500" />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-400">
              <Cloud className="w-4 h-4" />
              <span className="text-sm">Deploy Provider</span>
            </div>
            <span className="text-sm text-white">{deployProviderLabel}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-400">
              <Database className="w-4 h-4" />
              <span className="text-sm">Database Provider</span>
            </div>
            <span className="text-sm text-white">{dbProviderLabel}</span>
          </div>

          {selectedModuleNames.length > 0 && (
            <div className="py-2 border-t border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400 mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm">Integrations</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedModuleNames.map((name) => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {form.autoProvision && (
            <div className="flex items-center gap-2 py-2 border-t border-zinc-800 text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Auto-provisioning enabled</span>
            </div>
          )}
        </div>
      </Card>

      {isSubmitting && (
        <div className="flex items-center justify-center gap-2 text-blue-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Creating application...</span>
        </div>
      )}
    </div>
  );
}
