"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

interface IntegrationSetupWizardProps {
  applicationId: string;
  provider: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function IntegrationSetupWizard({
  applicationId,
  provider,
  open,
  onOpenChange,
  onComplete,
}: IntegrationSetupWizardProps) {
  const { data: template } = trpc.secrets.template.useQuery(provider!, {
    enabled: !!provider && open,
  });
  const setSecret = trpc.secrets.set.useMutation();
  const healthCheck = trpc.secrets.healthCheck.useMutation();

  const [values, setValues] = useState<Record<string, string>>({});
  const [enabledSections, setEnabledSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [healthStatus, setHealthStatus] = useState<Record<string, { status: string; message: string }>>({});

  const handleValueChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleToggleSection = useCallback((sectionId: string) => {
    setEnabledSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const handleHealthCheck = useCallback(async (tokenField: string) => {
    const token = values[tokenField];
    if (!token || !provider) return;

    const result = await healthCheck.mutateAsync({ provider, token });
    setHealthStatus((prev) => ({ ...prev, [tokenField]: result }));
  }, [values, provider, healthCheck]);

  const handleSave = useCallback(async () => {
    if (!template) return;
    setSaving(true);

    try {
      // Save all filled-in fields
      const fieldsToSave = [
        ...template.fields,
        ...(template.sections ?? [])
          .filter((s) => !s.toggleable || enabledSections.has(s.id))
          .flatMap((s) => s.fields),
      ];

      for (const field of fieldsToSave) {
        const value = values[field.key]?.trim();
        if (!value) {
          if (field.required) continue; // Skip empty required fields (will show validation)
          continue;
        }

        await setSecret.mutateAsync({
          applicationId,
          key: field.key,
          value,
          category: template.category,
          provider: template.provider,
          sensitive: field.sensitive,
          syncTargets: ["k8s:production"],
        });
      }

      onComplete?.();
      onOpenChange(false);
      // Reset state
      setValues({});
      setEnabledSections(new Set());
      setHealthStatus({});
    } finally {
      setSaving(false);
    }
  }, [template, values, enabledSections, applicationId, setSecret, onComplete, onOpenChange]);

  if (!template) return null;

  const allRequiredFilled = template.fields
    .filter((f) => f.required)
    .every((f) => values[f.key]?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle className="font-display">
            Set up {template.displayName}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main fields */}
          <div className="space-y-3">
            {template.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.key} className="font-mono text-[11px] uppercase tracking-wider text-dim">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </Label>
                  {template.healthCheck?.tokenField === field.key && values[field.key] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleHealthCheck(field.key)}
                      disabled={healthCheck.isPending}
                    >
                      {healthCheck.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : healthStatus[field.key]?.status === "healthy" ? (
                        <><Check className="h-3 w-3 text-green-500 mr-1" /> Valid</>
                      ) : healthStatus[field.key]?.status === "invalid" ? (
                        <><X className="h-3 w-3 text-red-400 mr-1" /> Invalid</>
                      ) : (
                        "Test"
                      )}
                    </Button>
                  )}
                </div>
                <Input
                  id={field.key}
                  type={field.sensitive ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? field.defaultValue ?? ""}
                  onChange={(e) => handleValueChange(field.key, e.target.value)}
                  className="font-mono text-[13px]"
                />
                {field.description && (
                  <p className="text-xs text-dim">{field.description}</p>
                )}
              </div>
            ))}
          </div>

          {/* Toggleable sections (e.g., OAuth providers) */}
          {template.sections?.map((section) => (
            <div key={section.id} className="space-y-3">
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <p className="text-sm font-medium">{section.label}</p>
                  {section.description && (
                    <p className="text-xs text-dim">{section.description}</p>
                  )}
                </div>
                {section.toggleable && (
                  <Switch
                    checked={enabledSections.has(section.id)}
                    onCheckedChange={() => handleToggleSection(section.id)}
                  />
                )}
              </div>

              {(!section.toggleable || enabledSections.has(section.id)) && (
                <div className="space-y-3 pl-4 border-l-2 border-border">
                  {section.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={field.key} className="font-mono text-[11px] uppercase tracking-wider text-dim">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </Label>
                      <Input
                        id={field.key}
                        type={field.sensitive ? "password" : "text"}
                        placeholder={field.placeholder}
                        value={values[field.key] ?? ""}
                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                        className="font-mono text-[13px]"
                      />
                      {field.description && (
                        <p className="text-xs text-dim">{field.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Webhook URL hint */}
          {template.webhookUrl && values[template.fields[0]?.key] && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-1">
                Webhook URL
              </p>
              <p className="font-mono text-[13px] text-muted-foreground">
                {`https://your-app.com${template.webhookUrl.path}`}
              </p>
              <p className="text-xs text-dim mt-1">{template.webhookUrl.description}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !allRequiredFilled}
          >
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</>
            ) : (
              `Save ${template.displayName}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
