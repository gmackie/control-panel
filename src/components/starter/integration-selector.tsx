"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle } from "lucide-react";
import { AVAILABLE_INTEGRATIONS, STARTER_TEMPLATES, StarterIntegration, StarterTemplate } from "@/types/starter-app";

interface IntegrationSelectorProps {
  selectedIntegrations: string[];
  onIntegrationsChange: (integrations: string[]) => void;
}

export function IntegrationSelector({ 
  selectedIntegrations, 
  onIntegrationsChange 
}: IntegrationSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleTemplateSelect = (template: StarterTemplate) => {
    setSelectedTemplate(template.id);
    onIntegrationsChange(template.preselectedIntegrations);
  };

  const handleIntegrationToggle = (integrationId: string) => {
    const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === integrationId);
    if (!integration) return;

    let newSelections = [...selectedIntegrations];

    if (selectedIntegrations.includes(integrationId)) {
      // Remove the integration
      newSelections = newSelections.filter(id => id !== integrationId);
    } else {
      // Add the integration
      newSelections.push(integrationId);

      // Check for incompatible integrations
      if (integration.incompatibleWith) {
        newSelections = newSelections.filter(
          id => !integration.incompatibleWith?.includes(id)
        );
      }
    }

    setSelectedTemplate(null); // Clear template selection on manual change
    onIntegrationsChange(newSelections);
  };

  const getIntegrationStatus = (integration: StarterIntegration) => {
    const isSelected = selectedIntegrations.includes(integration.id);
    
    // Check if incompatible with any selected integration
    const hasIncompatibility = integration.incompatibleWith?.some(
      id => selectedIntegrations.includes(id)
    );

    return { isSelected, hasIncompatibility };
  };

  const groupedIntegrations = AVAILABLE_INTEGRATIONS.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, StarterIntegration[]>);

  const categoryLabels = {
    auth: "Authentication",
    database: "Database",
    payment: "Payments",
    monitoring: "Monitoring",
    email: "Email",
    storage: "Storage",
    analytics: "Analytics",
  };

  return (
    <div className="space-y-6">
      {/* Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Quick Start Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {STARTER_TEMPLATES.map(template => (
            <Card
              key={template.id}
              className={`p-4 cursor-pointer transition-all ${
                selectedTemplate === template.id
                  ? "border-blue-500 bg-blue-950/20"
                  : "hover:border-gray-600"
              }`}
              onClick={() => handleTemplateSelect(template)}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium">{template.name}</h4>
                {template.recommended && (
                  <Badge variant="success" className="text-xs">
                    Recommended
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-3">{template.description}</p>
              <div className="flex flex-wrap gap-1">
                {template.preselectedIntegrations.map(id => {
                  const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === id);
                  return integration ? (
                    <Badge key={id} variant="outline" className="text-xs">
                      {integration.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-3">
          Customize Integrations
          {selectedTemplate && (
            <span className="text-sm text-gray-400 ml-2">
              (Modified from {STARTER_TEMPLATES.find(t => t.id === selectedTemplate)?.name})
            </span>
          )}
        </h3>
        
        {Object.entries(groupedIntegrations).map(([category, integrations]) => (
          <div key={category} className="mb-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3">
              {categoryLabels[category as keyof typeof categoryLabels]}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {integrations.map(integration => {
                const { isSelected, hasIncompatibility } = getIntegrationStatus(integration);
                
                return (
                  <Card
                    key={integration.id}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-950/20"
                        : hasIncompatibility
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-gray-600"
                    }`}
                    onClick={() => !hasIncompatibility && handleIntegrationToggle(integration.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium flex items-center gap-2">
                          {integration.name}
                          {isSelected && <Check className="h-4 w-4 text-blue-500" />}
                        </h5>
                        <p className="text-sm text-gray-400 mt-1">{integration.description}</p>
                        
                        {hasIncompatibility && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-yellow-500">
                            <AlertCircle className="h-3 w-3" />
                            <span>
                              Incompatible with {
                                integration.incompatibleWith
                                  ?.filter(id => selectedIntegrations.includes(id))
                                  .map(id => AVAILABLE_INTEGRATIONS.find(i => i.id === id)?.name)
                                  .join(", ")
                              }
                            </span>
                          </div>
                        )}
                        
                        {integration.requiredEnvVars.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">
                              Requires {integration.requiredEnvVars.length} env {
                                integration.requiredEnvVars.length === 1 ? "variable" : "variables"
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Count */}
      <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
        <span className="text-sm text-gray-400">
          {selectedIntegrations.length} integration{selectedIntegrations.length !== 1 ? "s" : ""} selected
        </span>
        {selectedIntegrations.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onIntegrationsChange([]);
              setSelectedTemplate(null);
            }}
          >
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}