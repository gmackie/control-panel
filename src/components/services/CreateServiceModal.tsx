"use client";

import { useState } from "react";
import {
  X,
  Globe,
  Database,
  Settings,
  Code,
  Server,
  Monitor,
} from "lucide-react";
import { ServiceTemplate, ServiceConfig } from "@/types";

interface CreateServiceModalProps {
  templates: ServiceTemplate[];
  onClose: () => void;
  onServiceCreated: (service: any) => void;
}

export default function CreateServiceModal({
  templates,
  onClose,
  onServiceCreated,
}: CreateServiceModalProps) {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ServiceTemplate | null>(null);
  const [serviceConfig, setServiceConfig] = useState<Partial<ServiceConfig>>({
    name: "",
    namespace: "default",
    replicas: 1,
    environment: "development",
    resources: {
      cpu: "100m",
      memory: "128Mi",
    },
    ports: [
      {
        name: "http",
        port: 80,
        targetPort: 3000,
        protocol: "TCP",
      },
    ],
    envVars: {},
    secrets: [],
    healthCheck: {
      path: "/health",
      initialDelaySeconds: 30,
      periodSeconds: 10,
      timeoutSeconds: 5,
      failureThreshold: 3,
    },
  });

  const getTemplateIcon = (category: string) => {
    switch (category) {
      case "web":
        return <Globe className="w-6 h-6" />;
      case "api":
        return <Code className="w-6 h-6" />;
      case "worker":
        return <Server className="w-6 h-6" />;
      case "database":
        return <Database className="w-6 h-6" />;
      case "monitoring":
        return <Monitor className="w-6 h-6" />;
      default:
        return <Settings className="w-6 h-6" />;
    }
  };

  const handleTemplateSelect = (template: ServiceTemplate) => {
    setSelectedTemplate(template);
    setServiceConfig({
      ...serviceConfig,
      ...template.defaultConfig,
    });
    setStep(2);
  };

  const handleCreateService = async () => {
    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template: selectedTemplate?.id,
          config: serviceConfig,
        }),
      });

      if (response.ok) {
        const service = await response.json();
        onServiceCreated(service);
      } else {
        console.error("Failed to create service");
      }
    } catch (error) {
      console.error("Error creating service:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">Create New Service</h2>
            <p className="text-sm text-muted-foreground">
              {step === 1
                ? "Choose a template to get started"
                : "Configure your service"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 ? (
            /* Template Selection */
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Choose a Template</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="p-4 border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {getTemplateIcon(template.category)}
                        </div>
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {template.framework}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                      {template.features.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {template.features.slice(0, 3).map((feature) => (
                            <span
                              key={feature}
                              className="text-xs bg-muted px-2 py-1 rounded"
                            >
                              {feature}
                            </span>
                          ))}
                          {template.features.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{template.features.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Service Configuration */
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to templates
                </button>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {selectedTemplate &&
                      getTemplateIcon(selectedTemplate.category)}
                  </div>
                  <div>
                    <h3 className="font-medium">{selectedTemplate?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedTemplate?.framework}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Configuration */}
                <div className="space-y-4">
                  <h4 className="font-medium">Basic Configuration</h4>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Service Name
                    </label>
                    <input
                      type="text"
                      value={serviceConfig.name}
                      onChange={(e) =>
                        setServiceConfig({
                          ...serviceConfig,
                          name: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="my-service"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Namespace
                    </label>
                    <input
                      type="text"
                      value={serviceConfig.namespace}
                      onChange={(e) =>
                        setServiceConfig({
                          ...serviceConfig,
                          namespace: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="default"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Environment
                    </label>
                    <select
                      value={serviceConfig.environment}
                      onChange={(e) =>
                        setServiceConfig({
                          ...serviceConfig,
                          environment: e.target.value as any,
                        })
                      }
                      className="w-full p-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="development">Development</option>
                      <option value="staging">Staging</option>
                      <option value="production">Production</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Replicas
                    </label>
                    <input
                      type="number"
                      value={serviceConfig.replicas}
                      onChange={(e) =>
                        setServiceConfig({
                          ...serviceConfig,
                          replicas: parseInt(e.target.value),
                        })
                      }
                      className="w-full p-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      min="1"
                      max="10"
                    />
                  </div>
                </div>

                {/* Resources */}
                <div className="space-y-4">
                  <h4 className="font-medium">Resources</h4>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      CPU Request
                    </label>
                    <input
                      type="text"
                      value={serviceConfig.resources?.cpu}
                      onChange={(e) =>
                        setServiceConfig({
                          ...serviceConfig,
                          resources: {
                            ...serviceConfig.resources!,
                            cpu: e.target.value,
                          },
                        })
                      }
                      className="w-full p-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="100m"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Memory Request
                    </label>
                    <input
                      type="text"
                      value={serviceConfig.resources?.memory}
                      onChange={(e) =>
                        setServiceConfig({
                          ...serviceConfig,
                          resources: {
                            ...serviceConfig.resources!,
                            memory: e.target.value,
                          },
                        })
                      }
                      className="w-full p-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="128Mi"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Health Check Path
                    </label>
                    <input
                      type="text"
                      value={serviceConfig.healthCheck?.path}
                      onChange={(e) =>
                        setServiceConfig({
                          ...serviceConfig,
                          healthCheck: {
                            ...serviceConfig.healthCheck!,
                            path: e.target.value,
                          },
                        })
                      }
                      className="w-full p-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="/health"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-input rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateService}
                  disabled={!serviceConfig.name}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Service
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
