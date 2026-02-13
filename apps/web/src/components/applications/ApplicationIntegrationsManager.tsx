"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
  Brain,
  CheckCircle,
  Cloud,
  CreditCard,
  Database,
  ExternalLink,
  Mail,
  MessageSquare,
  Mic,
  Settings,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { StripeIntegrationForm } from "@/components/integrations/StripeIntegrationForm";
import { TursoIntegrationForm } from "@/components/integrations/TursoIntegrationForm";
import { ElevenLabsIntegrationForm } from "@/components/integrations/ElevenLabsIntegrationForm";
import { OpenRouterIntegrationForm } from "@/components/integrations/OpenRouterIntegrationForm";
import { SendGridIntegrationForm } from "@/components/integrations/SendGridIntegrationForm";
import { TwilioIntegrationForm } from "@/components/integrations/TwilioIntegrationForm";
import { GenericIntegrationForm } from "@/components/integrations/GenericIntegrationForm";
import { INTEGRATION_TEMPLATES } from "@/types/applications";

interface IntegrationConfig {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  lastSync?: string;
  status: "connected" | "error" | "not_configured";
  metrics?: Record<string, unknown>;
}

type Mode = "embedded" | "page";

interface ApplicationIntegrationsManagerProps {
  applicationId: string;
  mode?: Mode;
}

export function ApplicationIntegrationsManager({
  applicationId,
  mode = "embedded",
}: ApplicationIntegrationsManagerProps) {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);

  const { data: integrations, isLoading, refetch } = useQuery<IntegrationConfig[]>({
    queryKey: ["application", applicationId, "integrations"],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${applicationId}/integrations`);
      if (!response.ok) throw new Error("Failed to fetch integrations");
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (config: unknown) => {
      const response = await fetch(`/api/applications/${applicationId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Failed to save integration");
      return response.json();
    },
    onSuccess: () => {
      setShowConfigForm(false);
      setSelectedIntegration(null);
      refetch();
    },
  });

  const getIntegrationIcon = (provider: string) => {
    const icons: Record<string, any> = {
      stripe: CreditCard,
      clerk: Users,
      turso: Database,
      supabase: Database,
      neon: Database,
      elevenlabs: Mic,
      openrouter: Brain,
      sendgrid: Mail,
      twilio: MessageSquare,
      aws: Cloud,
      sentry: Shield,
      posthog: Zap,
      resend: Mail,
      upstash: Database,
      planetscale: Database,
    };
    return icons[provider] || Zap;
  };

  const getIntegrationStatus = (integration: IntegrationConfig) => {
    if (!integration.configured) return "not_configured";
    if (integration.status === "error") return "error";
    if (integration.enabled && integration.status === "connected") return "connected";
    return "disabled";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return "success";
      case "error":
        return "error";
      case "disabled":
        return "secondary";
      default:
        return "warning";
    }
  };

  if (showConfigForm && selectedIntegration) {
    const integration = integrations?.find((i) => i.provider === selectedIntegration);

    if (selectedIntegration === "stripe") {
      return (
        <div className={mode === "page" ? "container mx-auto px-4 py-6 max-w-4xl" : "py-2"}>
          <StripeIntegrationForm
            applicationId={applicationId}
            existingConfig={integration as any}
            onSave={(config) => saveMutation.mutate(config)}
            onCancel={() => {
              setShowConfigForm(false);
              setSelectedIntegration(null);
            }}
          />
        </div>
      );
    }

    if (selectedIntegration === "turso") {
      return (
        <div className={mode === "page" ? "container mx-auto px-4 py-6 max-w-4xl" : "py-2"}>
          <TursoIntegrationForm
            applicationId={applicationId}
            existingConfig={integration as any}
            onSave={(config) => saveMutation.mutate(config)}
            onCancel={() => {
              setShowConfigForm(false);
              setSelectedIntegration(null);
            }}
          />
        </div>
      );
    }

    if (selectedIntegration === "elevenlabs") {
      return (
        <div className={mode === "page" ? "container mx-auto px-4 py-6 max-w-4xl" : "py-2"}>
          <ElevenLabsIntegrationForm
            applicationId={applicationId}
            existingConfig={integration as any}
            onSave={(config) => saveMutation.mutate(config)}
            onCancel={() => {
              setShowConfigForm(false);
              setSelectedIntegration(null);
            }}
          />
        </div>
      );
    }

    if (selectedIntegration === "openrouter") {
      return (
        <div className={mode === "page" ? "container mx-auto px-4 py-6 max-w-4xl" : "py-2"}>
          <OpenRouterIntegrationForm
            applicationId={applicationId}
            existingConfig={integration as any}
            onSave={(config) => saveMutation.mutate(config)}
            onCancel={() => {
              setShowConfigForm(false);
              setSelectedIntegration(null);
            }}
          />
        </div>
      );
    }

    if (selectedIntegration === "sendgrid") {
      return (
        <div className={mode === "page" ? "container mx-auto px-4 py-6 max-w-4xl" : "py-2"}>
          <SendGridIntegrationForm
            applicationId={applicationId}
            existingConfig={integration as any}
            onSave={(config) => saveMutation.mutate(config)}
            onCancel={() => {
              setShowConfigForm(false);
              setSelectedIntegration(null);
            }}
          />
        </div>
      );
    }

    if (selectedIntegration === "twilio") {
      return (
        <div className={mode === "page" ? "container mx-auto px-4 py-6 max-w-4xl" : "py-2"}>
          <TwilioIntegrationForm
            applicationId={applicationId}
            existingConfig={integration as any}
            onSave={(config) => saveMutation.mutate(config)}
            onCancel={() => {
              setShowConfigForm(false);
              setSelectedIntegration(null);
            }}
          />
        </div>
      );
    }

    return (
      <div className={mode === "page" ? "container mx-auto px-4 py-6 max-w-4xl" : "py-2"}>
        <GenericIntegrationForm
          applicationId={applicationId}
          provider={selectedIntegration}
          existingConfig={integration as any}
          onSave={(config) => saveMutation.mutate(config)}
          onCancel={() => {
            setShowConfigForm(false);
            setSelectedIntegration(null);
          }}
        />
      </div>
    );
  }

  const content = (
    <div className={mode === "page" ? "container mx-auto px-4 py-6 max-w-7xl space-y-6" : "space-y-6"}>
      {mode === "page" && (
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href={`/applications/${applicationId}`} className="text-gray-400 hover:text-gray-200">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-3xl font-bold">Integrations</h1>
            </div>
            <p className="text-gray-400">Configure and manage third-party service integrations</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Integrations</p>
              <p className="text-2xl font-bold">{integrations?.length || 0}</p>
            </div>
            <Zap className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Connected</p>
              <p className="text-2xl font-bold">{integrations?.filter((i) => i.status === "connected").length || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Errors</p>
              <p className="text-2xl font-bold">{integrations?.filter((i) => i.status === "error").length || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Not Configured</p>
              <p className="text-2xl font-bold">{integrations?.filter((i) => !i.configured).length || 0}</p>
            </div>
            <Settings className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-12 w-12 bg-gray-800 rounded-lg"></div>
                <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                <div className="h-3 bg-gray-800 rounded w-full"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations?.map((integration) => {
            const Icon = getIntegrationIcon(integration.provider);
            const status = getIntegrationStatus(integration);
            const template = INTEGRATION_TEMPLATES[integration.provider as keyof typeof INTEGRATION_TEMPLATES];

            return (
              <Card
                key={integration.id}
                className="p-6 hover:border-gray-700 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedIntegration(integration.provider);
                  setShowConfigForm(true);
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <Icon className="h-6 w-6 text-gray-400" />
                  </div>
                  <Badge variant={getStatusBadge(status) as any}>{status.replace("_", " ")}</Badge>
                </div>
                <h3 className="font-semibold text-lg mb-1">{integration.name}</h3>
                <p className="text-sm text-gray-400 mb-4">{template?.description || "Third-party service integration"}</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <Button size="sm" variant="outline">
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                  {integration.configured && (
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}

          {Object.entries(INTEGRATION_TEMPLATES)
            .filter(([key]) => !integrations?.some((i) => i.provider === key))
            .map(([key, template]) => {
              const Icon = getIntegrationIcon(key);

              return (
                <Card
                  key={key}
                  className="p-6 border-dashed hover:border-gray-700 transition-colors cursor-pointer opacity-60 hover:opacity-100"
                  onClick={() => {
                    setSelectedIntegration(key);
                    setShowConfigForm(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <Icon className="h-6 w-6 text-gray-500" />
                    </div>
                    <Badge variant="outline">Available</Badge>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                  <p className="text-sm text-gray-400 mb-4">{template.description}</p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.features.slice(0, 3).map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  <Button size="sm" variant="outline" className="w-full">
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );

  return content;
}
