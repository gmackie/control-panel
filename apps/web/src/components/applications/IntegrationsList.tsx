"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  CheckCircle, 
  XCircle,
  Settings,
  ExternalLink,
  RefreshCw,
  Database,
  Shield,
  CreditCard,
  AlertTriangle,
  BarChart3,
  Activity,
} from "lucide-react";
import { INTEGRATION_TEMPLATES, Application, ApplicationIntegration } from "@/types/applications";
import { LinkIntegrationModal } from "./LinkIntegrationModal";
import { IntegrationDetailSheet } from "./IntegrationDetailSheet";
import Link from "next/link";

interface IntegrationsListProps {
  applicationId: string;
}

interface IntegrationHealth {
  healthy: boolean;
  service: string;
  error?: string;
}

// Map of integration providers to their hub tab and icons
const INTEGRATION_HUB_MAP: Record<string, { tab: string; icon: React.ReactNode; color: string }> = {
  neon: { tab: "neon", icon: <Database className="h-4 w-4" />, color: "text-green-500" },
  clerk: { tab: "clerk", icon: <Shield className="h-4 w-4" />, color: "text-purple-500" },
  stripe: { tab: "stripe", icon: <CreditCard className="h-4 w-4" />, color: "text-blue-500" },
  sentry: { tab: "sentry", icon: <AlertTriangle className="h-4 w-4" />, color: "text-orange-500" },
  posthog: { tab: "posthog", icon: <BarChart3 className="h-4 w-4" />, color: "text-cyan-500" },
  sendgrid: { tab: "sendgrid", icon: <Activity className="h-4 w-4" />, color: "text-blue-400" },
  twilio: { tab: "twilio", icon: <Activity className="h-4 w-4" />, color: "text-red-500" },
};

export function IntegrationsList({ applicationId }: IntegrationsListProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<ApplicationIntegration | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [healthChecks, setHealthChecks] = useState<Record<string, IntegrationHealth>>({});
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const { data: application } = useQuery<Application>({
    queryKey: ["application", applicationId],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${applicationId}`);
      if (!response.ok) throw new Error("Failed to fetch application");
      return response.json();
    },
  });

  // Check health status of all configured integrations
  const checkHealthStatus = async () => {
    setIsCheckingHealth(true);
    const checks: Record<string, IntegrationHealth> = {};
    
    const services = Object.keys(INTEGRATION_HUB_MAP);
    
    await Promise.all(
      services.map(async (service) => {
        try {
          const res = await fetch(`/api/integrations/${service}?action=health`);
          const data = await res.json();
          checks[service] = {
            healthy: data.healthy === true,
            service,
            error: data.error,
          };
        } catch (err) {
          checks[service] = {
            healthy: false,
            service,
            error: err instanceof Error ? err.message : "Connection failed",
          };
        }
      })
    );
    
    setHealthChecks(checks);
    setIsCheckingHealth(false);
  };

  useEffect(() => {
    checkHealthStatus();
  }, []);

  const integrations = Object.entries(INTEGRATION_TEMPLATES);

  const isIntegrationConnected = (provider: string) => {
    return application?.integrations?.some(i => i.provider === provider && i.status === 'connected') ?? false;
  };

  const getHealthStatus = (provider: string) => {
    const normalizedProvider = provider.toLowerCase();
    return healthChecks[normalizedProvider];
  };

  const handleViewIntegration = (integration: ApplicationIntegration) => {
    setSelectedIntegration(integration);
    setShowDetailSheet(true);
  };

  // Get quick stats for connected integrations
  const connectedCount = Object.values(healthChecks).filter(h => h.healthy).length;
  const totalMonitored = Object.keys(INTEGRATION_HUB_MAP).length;

  return (
    <>
      <div className="space-y-6">
        {/* Integration Health Summary */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Integration Health</h2>
              <p className="text-sm text-gray-400 mt-1">
                Live status of configured third-party services
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {connectedCount}/{totalMonitored} services connected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={checkHealthStatus}
                disabled={isCheckingHealth}
              >
                {isCheckingHealth ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(INTEGRATION_HUB_MAP).map(([service, config]) => {
              const health = healthChecks[service];
              const isHealthy = health?.healthy;
              
              return (
                <Link
                  key={service}
                  href={`/integrations/hub?tab=${config.tab}`}
                  className="block"
                >
                  <div
                    className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                      isHealthy
                        ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
                        : health
                        ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                        : "border-gray-700 bg-gray-900 hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={config.color}>{config.icon}</div>
                      {isCheckingHealth ? (
                        <RefreshCw className="h-3 w-3 animate-spin text-gray-400" />
                      ) : isHealthy ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : health ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Activity className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <p className="text-sm font-medium capitalize">{service}</p>
                    <p className="text-xs text-gray-400">
                      {isHealthy ? "Connected" : health ? "Error" : "Not configured"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800">
            <Link href="/integrations/hub">
              <Button variant="outline" size="sm" className="w-full">
                <Activity className="h-4 w-4 mr-2" />
                Open Integration Hub
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Available Integrations</h2>
              <p className="text-sm text-gray-400 mt-1">
                Connect third-party services to your application
              </p>
            </div>
            <Button onClick={() => setShowLinkModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Link Integration
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map(([key, integration]) => {
              const connected = isIntegrationConnected(key);
              const health = getHealthStatus(key);
              const hubConfig = INTEGRATION_HUB_MAP[key.toLowerCase()];
              
              return (
                <Card 
                  key={key} 
                  className={`p-4 hover:border-gray-700 transition-colors ${
                    connected ? 'border-green-900' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <h3 className="font-medium">{integration.name}</h3>
                        <p className="text-xs text-gray-400">{integration.provider}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {health?.healthy && (
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      )}
                      {connected && (
                        <Badge variant="success" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-3">
                    {integration.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {integration.features.slice(0, 3).map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {integration.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{integration.features.length - 3}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {connected ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            const appIntegration = application?.integrations?.find(i => i.provider === key);
                            if (appIntegration) {
                              handleViewIntegration(appIntegration);
                            }
                          }}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Configure
                        </Button>
                        {hubConfig && (
                          <Link href={`/integrations/hub?tab=${hubConfig.tab}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setShowLinkModal(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Connect
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      </div>

      <LinkIntegrationModal
        applicationId={applicationId}
        open={showLinkModal}
        onOpenChange={setShowLinkModal}
        onSuccess={() => {
          checkHealthStatus();
        }}
      />

      <IntegrationDetailSheet
        applicationId={applicationId}
        integration={selectedIntegration}
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        onUnlinked={() => {
          checkHealthStatus();
        }}
      />
    </>
  );
}
