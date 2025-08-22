"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  Settings,
  ExternalLink 
} from "lucide-react";
import { INTEGRATION_TEMPLATES, Application } from "@/types/applications";
import { AddIntegrationModal } from "./AddIntegrationModal";

interface IntegrationsListProps {
  applicationId: string;
}

export function IntegrationsList({ applicationId }: IntegrationsListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const { data: application } = useQuery<Application>({
    queryKey: ["application", applicationId],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${applicationId}`);
      if (!response.ok) throw new Error("Failed to fetch application");
      return response.json();
    },
  });

  const integrations = Object.entries(INTEGRATION_TEMPLATES);

  const isIntegrationConnected = (provider: string) => {
    return application?.integrations.some(i => i.provider === provider && i.status === 'connected');
  };

  const handleAddIntegration = (provider: string) => {
    setSelectedProvider(provider);
    setShowAddModal(true);
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Integrations</h2>
            <p className="text-sm text-gray-400 mt-1">
              Connect third-party services to your application
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map(([key, integration]) => {
            const connected = isIntegrationConnected(key);
            
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
                  {connected && (
                    <Badge variant="success" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
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
                      <Button variant="outline" size="sm" className="flex-1">
                        <Settings className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleAddIntegration(key)}
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

      {showAddModal && selectedProvider && (
        <AddIntegrationModal
          applicationId={applicationId}
          provider={selectedProvider}
          onClose={() => {
            setShowAddModal(false);
            setSelectedProvider(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setSelectedProvider(null);
          }}
        />
      )}
    </>
  );
}