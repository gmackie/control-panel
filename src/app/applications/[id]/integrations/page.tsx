"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Users,
  Database,
  Mic,
  Brain,
  Mail,
  MessageSquare,
  Cloud,
  Shield,
  Plus,
  Settings,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Zap,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { StripeIntegrationForm } from "@/components/integrations/StripeIntegrationForm";
import { TursoIntegrationForm } from "@/components/integrations/TursoIntegrationForm";
import { ElevenLabsIntegrationForm } from "@/components/integrations/ElevenLabsIntegrationForm";
import { OpenRouterIntegrationForm } from "@/components/integrations/OpenRouterIntegrationForm";
import { SendGridIntegrationForm } from "@/components/integrations/SendGridIntegrationForm";
import { TwilioIntegrationForm } from "@/components/integrations/TwilioIntegrationForm";
import { INTEGRATION_TEMPLATES } from "@/types/applications";

interface IntegrationConfig {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  lastSync?: string;
  status: 'connected' | 'error' | 'not_configured';
  metrics?: {
    [key: string]: any;
  };
}

export default function ApplicationIntegrationsPage({ params }: { params: { id: string } }) {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);

  const { data: integrations, isLoading, refetch } = useQuery<IntegrationConfig[]>({
    queryKey: ["application", params.id, "integrations"],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${params.id}/integrations`);
      if (!response.ok) throw new Error("Failed to fetch integrations");
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (config: any) => {
      const response = await fetch(`/api/applications/${params.id}/integrations`, {
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
      elevenlabs: Mic,
      openrouter: Brain,
      sendgrid: Mail,
      twilio: MessageSquare,
      aws: Cloud,
      sentry: Shield,
    };
    return icons[provider] || Zap;
  };

  const getIntegrationStatus = (integration: IntegrationConfig) => {
    if (!integration.configured) return 'not_configured';
    if (integration.status === 'error') return 'error';
    if (integration.enabled && integration.status === 'connected') return 'connected';
    return 'disabled';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'disabled':
        return 'text-gray-500';
      default:
        return 'text-yellow-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'error':
        return 'error';
      case 'disabled':
        return 'secondary';
      default:
        return 'warning';
    }
  };

  if (showConfigForm && selectedIntegration) {
    const integration = integrations?.find(i => i.provider === selectedIntegration);
    
    if (selectedIntegration === 'stripe') {
      return (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <StripeIntegrationForm
            applicationId={params.id}
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
    
    if (selectedIntegration === 'turso') {
      return (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <TursoIntegrationForm
            applicationId={params.id}
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
    
    if (selectedIntegration === 'elevenlabs') {
      return (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <ElevenLabsIntegrationForm
            applicationId={params.id}
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
    
    if (selectedIntegration === 'openrouter') {
      return (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <OpenRouterIntegrationForm
            applicationId={params.id}
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
    
    if (selectedIntegration === 'sendgrid') {
      return (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <SendGridIntegrationForm
            applicationId={params.id}
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
    
    if (selectedIntegration === 'twilio') {
      return (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <TwilioIntegrationForm
            applicationId={params.id}
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
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/applications/${params.id}`}
              className="text-gray-400 hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Integrations</h1>
          </div>
          <p className="text-gray-400">
            Configure and manage third-party service integrations
          </p>
        </div>
        <Button onClick={() => setSelectedIntegration('new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {/* Integration Status Overview */}
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
              <p className="text-2xl font-bold">
                {integrations?.filter(i => i.status === 'connected').length || 0}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Errors</p>
              <p className="text-2xl font-bold">
                {integrations?.filter(i => i.status === 'error').length || 0}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Not Configured</p>
              <p className="text-2xl font-bold">
                {integrations?.filter(i => !i.configured).length || 0}
              </p>
            </div>
            <Settings className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Integrations Grid */}
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
          {/* Existing Integrations */}
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
                  <Badge variant={getStatusBadge(status) as any}>
                    {status.replace('_', ' ')}
                  </Badge>
                </div>
                
                <h3 className="font-semibold text-lg mb-1">{integration.name}</h3>
                <p className="text-sm text-gray-400 mb-4">
                  {template?.description || 'Third-party service integration'}
                </p>
                
                {integration.configured && integration.metrics && (
                  <div className="space-y-2 mb-4">
                    {Object.entries(integration.metrics).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-500 capitalize">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
                
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
          
          {/* Available Integrations to Add */}
          {Object.entries(INTEGRATION_TEMPLATES)
            .filter(([key]) => !integrations?.some(i => i.provider === key))
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
                    <Plus className="h-3 w-3 mr-1" />
                    Add Integration
                  </Button>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}