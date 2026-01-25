"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Users, BarChart, AlertCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useWizard } from "./wizard-context";
import type { LucideIcon } from "lucide-react";

const MODULE_ICONS: Record<string, LucideIcon> = {
  clerk: Users,
  stripe: CreditCard,
  posthog: BarChart,
  sentry: AlertCircle,
  expo: Smartphone,
};

const MODULE_COLORS: Record<string, string> = {
  clerk: "text-purple-400",
  stripe: "text-blue-400",
  posthog: "text-orange-400",
  sentry: "text-pink-400",
  expo: "text-cyan-400",
};

export function ModulesStep() {
  const { state, updateForm } = useWizard();
  const { form, errors } = state;

  const { data: templateData, isLoading } = trpc.templates.byId.useQuery(form.templateId, {
    enabled: !!form.templateId,
  });

  const availableModules = useMemo(() => {
    if (!templateData?.metadata?.integrations) return [];
    return templateData.metadata.integrations;
  }, [templateData]);

  const defaultModules = useMemo(() => {
    return templateData?.metadata?.config?.defaultIntegrations || [];
  }, [templateData]);

  const optionalModules = useMemo(() => {
    return templateData?.metadata?.config?.optionalIntegrations || [];
  }, [templateData]);

  const toggleModule = (moduleId: string) => {
    const current = form.selectedModules;
    const updated = current.includes(moduleId)
      ? current.filter((id) => id !== moduleId)
      : [...current, moduleId];
    updateForm("selectedModules", updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!templateData?.metadata) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">No template selected. Please go back and select a template.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Select Integrations</h2>
        <p className="text-zinc-400 text-sm">
          Choose which integrations to include in your application. Default integrations are pre-selected.
        </p>
      </div>

      {availableModules.length === 0 ? (
        <div className="text-center py-8 text-zinc-400">
          No integrations available for this template.
        </div>
      ) : (
        <div className="grid gap-4">
          {availableModules.map((module) => {
            const isSelected = form.selectedModules.includes(module.id);
            const isDefault = defaultModules.includes(module.id);
            const isOptional = optionalModules.includes(module.id);
            const Icon = MODULE_ICONS[module.id] || AlertCircle;
            const colorClass = MODULE_COLORS[module.id] || "text-zinc-400";

            return (
              <Card
                key={module.id}
                onClick={() => toggleModule(module.id)}
                className={cn(
                  "p-4 cursor-pointer transition-all border-2",
                  isSelected
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-900"
                )}
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleModule(module.id)}
                    className="mt-1"
                  />
                  <div className={cn("w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center", colorClass)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white">{module.name}</h3>
                      {isDefault && (
                        <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                          Default
                        </Badge>
                      )}
                      {isOptional && !isDefault && (
                        <Badge variant="outline" className="text-xs">
                          Optional
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400">{module.description}</p>
                    <Badge variant="outline" className="text-xs mt-2 capitalize">
                      {module.category}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {errors.selectedModules && (
        <p className="text-sm text-red-400">{errors.selectedModules}</p>
      )}
    </div>
  );
}
