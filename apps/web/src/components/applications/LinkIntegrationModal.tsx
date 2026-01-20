"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  RefreshCw,
  Database,
  Shield,
  CreditCard,
  Cloud,
  Mail,
  Zap,
  ExternalLink,
  ChevronRight,
  Key,
} from "lucide-react";
import { INTEGRATION_TEMPLATES } from "@/types/applications";
import { cn } from "@/lib/utils";

interface LinkIntegrationModalProps {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface DiscoveredResource {
  id: string;
  name: string;
  provider: string;
  type: string;
  region?: string;
  status: "available" | "linked" | "unavailable";
  linkedTo?: string;
  metadata?: Record<string, any>;
}

const PROVIDER_CATEGORIES = {
  database: {
    label: "Databases",
    icon: Database,
    providers: ["neon", "turso", "supabase", "planetscale", "upstash"],
  },
  auth: {
    label: "Authentication",
    icon: Shield,
    providers: ["clerk"],
  },
  payment: {
    label: "Payments",
    icon: CreditCard,
    providers: ["stripe"],
  },
  cloud: {
    label: "Cloud & Storage",
    icon: Cloud,
    providers: ["aws"],
  },
  communication: {
    label: "Communication",
    icon: Mail,
    providers: ["sendgrid", "twilio", "resend"],
  },
  monitoring: {
    label: "Monitoring & AI",
    icon: Zap,
    providers: ["sentry", "posthog", "openrouter", "elevenlabs"],
  },
};

export function LinkIntegrationModal({
  applicationId,
  open,
  onOpenChange,
  onSuccess,
}: LinkIntegrationModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"select" | "configure" | "verify" | "complete">("select");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [linkMethod, setLinkMethod] = useState<"discover" | "manual">("discover");
  const [selectedResource, setSelectedResource] = useState<DiscoveredResource | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("select");
      setSelectedProvider(null);
      setSelectedResource(null);
      setSecrets({});
      setSearchQuery("");
      setLinkMethod("discover");
    }
  }, [open]);

  const {
    data: discoveredResources,
    isLoading: isDiscovering,
    refetch: refetchResources,
  } = useQuery<DiscoveredResource[]>({
    queryKey: ["discovered-resources", selectedProvider],
    queryFn: async () => {
      if (!selectedProvider) return [];
      const response = await fetch(
        `/api/integrations/discover?provider=${selectedProvider}`
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.resources || [];
    },
    enabled: !!selectedProvider && linkMethod === "discover",
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const integration = selectedProvider ? INTEGRATION_TEMPLATES[selectedProvider as keyof typeof INTEGRATION_TEMPLATES] : null;
      if (!integration) throw new Error("Invalid provider");

      const secretPromises = Object.entries(secrets)
        .filter(([, value]) => value.trim())
        .map(([key, value]) =>
          fetch(`/api/applications/${applicationId}/secrets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key,
              value,
              category:
                integration.requiredSecrets.find((s) => s.key === key)?.category ||
                ("optionalSecrets" in integration
                  ? integration.optionalSecrets?.find((s) => s.key === key)?.category
                  : undefined) ||
                "api",
              provider: integration.provider,
              description:
                integration.requiredSecrets.find((s) => s.key === key)?.description ||
                ("optionalSecrets" in integration
                  ? integration.optionalSecrets?.find((s) => s.key === key)?.description
                  : undefined),
            }),
          })
        );

      await Promise.all(secretPromises);

      const response = await fetch(`/api/applications/${applicationId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: integration.provider,
          name: integration.name,
          enabled: true,
          config: selectedResource ? { resourceId: selectedResource.id } : {},
          secrets: Object.keys(secrets).filter((k) => secrets[k]?.trim()),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to link integration");
      }

      return response.json();
    },
    onSuccess: () => {
      setStep("complete");
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["secrets", applicationId] });
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
    },
  });

  const integration = selectedProvider
    ? INTEGRATION_TEMPLATES[selectedProvider as keyof typeof INTEGRATION_TEMPLATES]
    : null;

  const allRequiredSecrets = integration
    ? integration.requiredSecrets.every((secret) => secrets[secret.key]?.trim())
    : false;

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider);
    setStep("configure");
  };

  const handleSubmit = () => {
    setStep("verify");
    linkMutation.mutate();
  };

  const filteredProviders = Object.entries(PROVIDER_CATEGORIES).map(
    ([category, config]) => ({
      category,
      ...config,
      providers: config.providers.filter((p) =>
        searchQuery
          ? INTEGRATION_TEMPLATES[p as keyof typeof INTEGRATION_TEMPLATES]?.name
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          : true
      ),
    })
  );

  const availableResources = discoveredResources?.filter(
    (r) => r.status === "available"
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "select" && "Link Integration"}
            {step === "configure" && integration && (
              <>
                <span className="text-2xl">{integration.icon}</span>
                Connect {integration.name}
              </>
            )}
            {step === "verify" && "Connecting..."}
            {step === "complete" && "Connected!"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Choose an integration to connect to your application"}
            {step === "configure" && integration?.description}
            {step === "verify" && "Verifying credentials and setting up integration..."}
            {step === "complete" && "Integration has been successfully connected"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
              {filteredProviders.map(
                ({ category, label, icon: Icon, providers }) =>
                  providers.length > 0 && (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="h-4 w-4 text-zinc-400" />
                        <h4 className="text-sm font-medium text-zinc-400">{label}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {providers.map((provider) => {
                          const template =
                            INTEGRATION_TEMPLATES[
                              provider as keyof typeof INTEGRATION_TEMPLATES
                            ];
                          if (!template) return null;
                          return (
                            <button
                              key={provider}
                              onClick={() => handleProviderSelect(provider)}
                              className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-colors text-left"
                            >
                              <span className="text-2xl">{template.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{template.name}</p>
                                <p className="text-xs text-zinc-500 truncate">
                                  {template.description}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-zinc-500" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
              )}
            </div>
          </div>
        )}

        {step === "configure" && integration && (
          <div className="space-y-6">
            <Tabs value={linkMethod} onValueChange={(v) => setLinkMethod(v as "discover" | "manual")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="discover">
                  <Search className="h-4 w-4 mr-2" />
                  Discover Resources
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Key className="h-4 w-4 mr-2" />
                  Manual Entry
                </TabsTrigger>
              </TabsList>

              <TabsContent value="discover" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-400">
                    Available {integration.name} resources
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchResources()}
                    disabled={isDiscovering}
                  >
                    {isDiscovering ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {isDiscovering ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                    <span className="ml-2 text-sm text-zinc-400">
                      Discovering resources...
                    </span>
                  </div>
                ) : availableResources.length > 0 ? (
                  <div className="space-y-2">
                    {availableResources.map((resource) => (
                      <button
                        key={resource.id}
                        onClick={() => {
                          setSelectedResource(resource);
                          if (resource.metadata?.connectionString) {
                            setSecrets((prev) => ({
                              ...prev,
                              DATABASE_URL: resource.metadata?.connectionString,
                            }));
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                          selectedResource?.id === resource.id
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{resource.name}</p>
                          <p className="text-xs text-zinc-500">
                            {resource.type} {resource.region && `- ${resource.region}`}
                          </p>
                        </div>
                        {selectedResource?.id === resource.id && (
                          <CheckCircle className="h-5 w-5 text-blue-500" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Card className="p-6 text-center">
                    <p className="text-zinc-400 mb-4">
                      No resources found. You can add credentials manually.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setLinkMethod("manual")}
                    >
                      Enter Manually
                    </Button>
                  </Card>
                )}

                {selectedResource && (
                  <div className="pt-4 border-t border-zinc-800">
                    <h4 className="font-medium mb-3">Additional Configuration</h4>
                    <div className="space-y-3">
                      {integration.requiredSecrets.map((secret) => (
                        <div key={secret.key}>
                          <Label htmlFor={secret.key}>{secret.key} *</Label>
                          <Input
                            id={secret.key}
                            type="password"
                            value={secrets[secret.key] || ""}
                            onChange={(e) =>
                              setSecrets({ ...secrets, [secret.key]: e.target.value })
                            }
                            placeholder={`Enter ${secret.key}`}
                            className="font-mono"
                          />
                          {secret.description && (
                            <p className="text-xs text-zinc-500 mt-1">
                              {secret.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                <div>
                  <h4 className="font-medium mb-3">Required Configuration</h4>
                  <div className="space-y-3">
                    {integration.requiredSecrets.map((secret) => (
                      <div key={secret.key}>
                        <Label htmlFor={secret.key}>{secret.key} *</Label>
                        <Input
                          id={secret.key}
                          type="password"
                          value={secrets[secret.key] || ""}
                          onChange={(e) =>
                            setSecrets({ ...secrets, [secret.key]: e.target.value })
                          }
                          placeholder={`Enter ${secret.key}`}
                          className="font-mono"
                        />
                        {secret.description && (
                          <p className="text-xs text-zinc-500 mt-1">
                            {secret.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {"optionalSecrets" in integration &&
                  integration.optionalSecrets &&
                  integration.optionalSecrets.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Optional Configuration</h4>
                      <div className="space-y-3">
                        {integration.optionalSecrets.map((secret) => (
                          <div key={secret.key}>
                            <Label htmlFor={secret.key}>{secret.key}</Label>
                            <Input
                              id={secret.key}
                              type="password"
                              value={secrets[secret.key] || ""}
                              onChange={(e) =>
                                setSecrets({ ...secrets, [secret.key]: e.target.value })
                              }
                              placeholder={`Enter ${secret.key} (optional)`}
                              className="font-mono"
                            />
                            {secret.description && (
                              <p className="text-xs text-zinc-500 mt-1">
                                {secret.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </TabsContent>
            </Tabs>

            <div>
              <h4 className="font-medium mb-2">Features</h4>
              <div className="flex flex-wrap gap-2">
                {integration.features.map((feature) => (
                  <Badge key={feature} variant="outline">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="py-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Connecting to {integration?.name}
            </h3>
            <p className="text-zinc-400">
              Verifying credentials and setting up integration...
            </p>
          </div>
        )}

        {step === "complete" && (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Successfully Connected!</h3>
            <p className="text-zinc-400">
              {integration?.name} has been connected to your application.
            </p>
          </div>
        )}

        {linkMutation.error && (
          <div className="p-3 bg-red-950/20 border border-red-900 rounded-md">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              {linkMutation.error.message}
            </div>
          </div>
        )}

        {step === "configure" && (
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep("select");
                setSelectedProvider(null);
                setSelectedResource(null);
                setSecrets({});
              }}
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!allRequiredSecrets || linkMutation.isPending}
            >
              {linkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Connect {integration?.name}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
