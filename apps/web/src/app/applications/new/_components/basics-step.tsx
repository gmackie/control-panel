"use client";

import { useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useWizard } from "./wizard-context";
import { useDebouncedCallback } from "use-debounce";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

export function BasicsStep() {
  const { state, updateForm, setSlugValidation } = useWizard();
  const { form, errors, slugValidation } = state;

  const { data: templates, isLoading: templatesLoading } = trpc.templates.list.useQuery();

  const validateSlugQuery = trpc.templates.validateSlug.useQuery(form.appSlug, {
    enabled: form.appSlug.length >= 2,
  });

  const debouncedSlugCheck = useDebouncedCallback((slug: string) => {
    if (slug.length < 2) {
      setSlugValidation({ isValidating: false, isAvailable: null, error: null });
      return;
    }
    setSlugValidation({ isValidating: true });
  }, 300);

  useEffect(() => {
    if (validateSlugQuery.isLoading) {
      setSlugValidation({ isValidating: true });
    } else if (validateSlugQuery.data) {
      setSlugValidation({
        isValidating: false,
        isAvailable: validateSlugQuery.data.available,
        error: validateSlugQuery.data.error || null,
      });
    }
  }, [validateSlugQuery.data, validateSlugQuery.isLoading, setSlugValidation]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      updateForm("appName", name);

      const slug = slugify(name);
      updateForm("appSlug", slug);
      debouncedSlugCheck(slug);
    },
    [updateForm, debouncedSlugCheck]
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const slug = slugify(e.target.value);
      updateForm("appSlug", slug);
      debouncedSlugCheck(slug);
    },
    [updateForm, debouncedSlugCheck]
  );

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      updateForm("templateId", templateId);
    },
    [updateForm]
  );

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.id === form.templateId),
    [templates, form.templateId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Choose a Template</h2>
        <p className="text-zinc-400 text-sm">
          Select a template to bootstrap your application with pre-configured integrations.
        </p>
      </div>

      {templatesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="grid gap-4">
          {templates?.map((template) => (
            <Card
              key={template.id}
              onClick={() => handleTemplateSelect(template.id)}
              className={cn(
                "p-4 cursor-pointer transition-all border-2",
                form.templateId === template.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-900"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white">{template.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      v{template.version}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400 mb-2">{template.description}</p>
                  {template.metadata?.features && (
                    <div className="flex flex-wrap gap-2">
                      {template.metadata.features.web && (
                        <Badge variant="secondary" className="text-xs">Web</Badge>
                      )}
                      {template.metadata.features.mobile && (
                        <Badge variant="secondary" className="text-xs">Mobile</Badge>
                      )}
                      {template.metadata.features.api && (
                        <Badge variant="secondary" className="text-xs">API</Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {errors.templateId && (
        <p className="text-sm text-red-400">{errors.templateId}</p>
      )}

      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <div className="space-y-2">
          <Label htmlFor="appName">Application Name</Label>
          <Input
            id="appName"
            value={form.appName}
            onChange={handleNameChange}
            placeholder="My Awesome App"
            className={cn(errors.appName && "border-red-500")}
          />
          {errors.appName && (
            <p className="text-sm text-red-400">{errors.appName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="appSlug">URL Slug</Label>
          <div className="relative">
            <Input
              id="appSlug"
              value={form.appSlug}
              onChange={handleSlugChange}
              placeholder="my-awesome-app"
              className={cn(
                "pr-10",
                errors.appSlug && "border-red-500",
                slugValidation.isAvailable === false && "border-red-500",
                slugValidation.isAvailable === true && "border-green-500"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {slugValidation.isValidating && (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              )}
              {!slugValidation.isValidating && slugValidation.isAvailable === true && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {!slugValidation.isValidating && slugValidation.isAvailable === false && (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Used in URLs and repository names. Only lowercase letters, numbers, and hyphens.
          </p>
          {(errors.appSlug || slugValidation.error) && (
            <p className="text-sm text-red-400">
              {errors.appSlug || slugValidation.error}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            placeholder="A brief description of your application..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
