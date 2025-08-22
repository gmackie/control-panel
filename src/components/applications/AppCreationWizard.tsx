"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Code,
  Package,
  GitBranch,
  Server,
  Globe,
  Cpu,
  HardDrive,
  DollarSign,
  Zap,
  Database,
  CreditCard,
  Users,
  Mic,
  Brain,
  Mail,
  MessageSquare,
  Cloud,
  Shield,
  Layers,
  Plus,
  X,
  Info,
  AlertCircle,
  Rocket,
} from "lucide-react";
import { INTEGRATION_TEMPLATES } from "@/types/applications";

interface AppCreationWizardProps {
  onClose: () => void;
  onSuccess: (appId: string) => void;
}

interface AppConfig {
  // Basic Info
  name: string;
  slug: string;
  description: string;
  
  // Repository
  repository: {
    provider: "gitea" | "github" | "gitlab";
    visibility: "public" | "private";
    template?: string;
    autoInit: boolean;
    defaultBranch: string;
  };
  
  // Integrations
  integrations: {
    [key: string]: {
      enabled: boolean;
      config: Record<string, any>;
      secrets: Record<string, string>;
    };
  };
  
  // Deployment
  deployment: {
    environments: {
      staging: {
        enabled: boolean;
        domain?: string;
        cluster?: string;
        namespace?: string;
      };
      production: {
        enabled: boolean;
        domain?: string;
        cluster?: string;
        namespace?: string;
      };
    };
    
    // Resource allocation
    resources: {
      cpu: {
        request: number; // in millicores
        limit: number;
      };
      memory: {
        request: number; // in MB
        limit: number;
      };
      replicas: {
        min: number;
        max: number;
      };
    };
    
    // Container registry
    registry: {
      provider: "harbor" | "dockerhub" | "gcr";
      namespace?: string;
      imageName?: string;
    };
    
    // CI/CD
    cicd: {
      provider: "gitea-actions" | "github-actions" | "gitlab-ci";
      autoDeployStaging: boolean;
      autoDeployProduction: boolean;
      runTests: boolean;
      buildCache: boolean;
    };
  };
  
  // Monitoring
  monitoring: {
    enabled: boolean;
    provider: "prometheus" | "datadog" | "newrelic";
    alerts: boolean;
    logging: boolean;
    tracing: boolean;
  };
  
  // Estimated cost
  estimatedCost?: {
    monthly: number;
    breakdown: {
      infrastructure: number;
      integrations: number;
      storage: number;
      bandwidth: number;
    };
  };
}

const STEPS = [
  { id: 'basic', title: 'Basic Info', icon: Code },
  { id: 'repository', title: 'Repository', icon: GitBranch },
  { id: 'integrations', title: 'Integrations', icon: Zap },
  { id: 'deployment', title: 'Deployment', icon: Server },
  { id: 'resources', title: 'Resources', icon: Cpu },
  { id: 'monitoring', title: 'Monitoring', icon: Shield },
  { id: 'review', title: 'Review', icon: CheckCircle },
];

const AVAILABLE_CLUSTERS = [
  { id: 'prod-cluster-1', name: 'Production Cluster 1', location: 'US West', available: true },
  { id: 'prod-cluster-2', name: 'Production Cluster 2', location: 'EU Central', available: true },
  { id: 'dev-cluster', name: 'Development Cluster', location: 'US East', available: true },
];

const REPOSITORY_TEMPLATES = [
  { id: 'blank', name: 'Blank Repository', description: 'Start from scratch' },
  { id: 'nextjs', name: 'Next.js App', description: 'Full-stack React framework' },
  { id: 'express', name: 'Express API', description: 'Node.js REST API' },
  { id: 'fastapi', name: 'FastAPI', description: 'Python async API' },
  { id: 'django', name: 'Django App', description: 'Python web framework' },
  { id: 'rails', name: 'Rails App', description: 'Ruby on Rails application' },
];

export function AppCreationWizard({ onClose, onSuccess }: AppCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [config, setConfig] = useState<AppConfig>({
    name: '',
    slug: '',
    description: '',
    
    repository: {
      provider: 'gitea',
      visibility: 'private',
      template: 'blank',
      autoInit: true,
      defaultBranch: 'main',
    },
    
    integrations: {},
    
    deployment: {
      environments: {
        staging: {
          enabled: true,
          cluster: 'dev-cluster',
        },
        production: {
          enabled: true,
          cluster: 'prod-cluster-1',
        },
      },
      
      resources: {
        cpu: {
          request: 100, // 100m
          limit: 500,   // 500m
        },
        memory: {
          request: 128, // 128MB
          limit: 512,   // 512MB
        },
        replicas: {
          min: 1,
          max: 3,
        },
      },
      
      registry: {
        provider: 'harbor',
      },
      
      cicd: {
        provider: 'gitea-actions',
        autoDeployStaging: true,
        autoDeployProduction: false,
        runTests: true,
        buildCache: true,
      },
    },
    
    monitoring: {
      enabled: true,
      provider: 'prometheus',
      alerts: true,
      logging: true,
      tracing: false,
    },
  });
  
  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setConfig(prev => ({
      ...prev,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }));
  };
  
  // Calculate estimated cost
  const calculateCost = () => {
    let cost = 0;
    
    // Base infrastructure cost
    const cpuCost = (config.deployment.resources.cpu.limit / 1000) * 20; // $20 per vCPU
    const memoryCost = (config.deployment.resources.memory.limit / 1024) * 10; // $10 per GB
    const replicaCost = config.deployment.resources.replicas.max * 5; // $5 per replica
    
    cost += cpuCost + memoryCost + replicaCost;
    
    // Environment multiplier
    if (config.deployment.environments.staging.enabled) cost += 20;
    if (config.deployment.environments.production.enabled) cost += 50;
    
    // Integration costs
    const integrationCount = Object.values(config.integrations).filter(i => i.enabled).length;
    cost += integrationCount * 10;
    
    // Monitoring cost
    if (config.monitoring.enabled) cost += 15;
    
    return {
      monthly: Math.round(cost),
      breakdown: {
        infrastructure: Math.round(cpuCost + memoryCost + replicaCost),
        integrations: integrationCount * 10,
        storage: 5,
        bandwidth: 10,
      },
    };
  };
  
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 0: // Basic Info
        if (!config.name) newErrors.name = 'Application name is required';
        if (!config.slug) newErrors.slug = 'Slug is required';
        if (config.slug && !/^[a-z0-9-]+$/.test(config.slug)) {
          newErrors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
        }
        break;
        
      case 3: // Deployment
        if (config.deployment.environments.staging.enabled && !config.deployment.environments.staging.domain) {
          newErrors.stagingDomain = 'Staging domain is required';
        }
        if (config.deployment.environments.production.enabled && !config.deployment.environments.production.domain) {
          newErrors.productionDomain = 'Production domain is required';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleCreate = async () => {
    setIsCreating(true);
    
    try {
      // Calculate final cost
      const estimatedCost = calculateCost();
      const finalConfig = { ...config, estimatedCost };
      
      const response = await fetch('/api/applications/create-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalConfig),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create application');
      }
      
      const { applicationId } = await response.json();
      onSuccess(applicationId);
    } catch (error) {
      console.error('Error creating application:', error);
      setErrors({ submit: 'Failed to create application. Please try again.' });
    } finally {
      setIsCreating(false);
    }
  };
  
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Application Name *</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="My Awesome App"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">URL Slug *</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">apps/</span>
                <input
                  type="text"
                  value={config.slug}
                  onChange={(e) => setConfig(prev => ({ ...prev, slug: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="my-awesome-app"
                />
              </div>
              {errors.slug && <p className="text-red-500 text-sm mt-1">{errors.slug}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={config.description}
                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                rows={3}
                placeholder="A brief description of your application..."
              />
            </div>
          </div>
        );
        
      case 1: // Repository
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Repository Provider</label>
              <div className="grid grid-cols-3 gap-3">
                {['gitea', 'github', 'gitlab'].map((provider) => (
                  <button
                    key={provider}
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      repository: { ...prev.repository, provider: provider as any }
                    }))}
                    className={`p-3 rounded-lg border ${
                      config.repository.provider === provider
                        ? 'border-blue-500 bg-blue-950/20'
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <GitBranch className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm capitalize">{provider}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Repository Template</label>
              <div className="grid grid-cols-2 gap-3">
                {REPOSITORY_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      repository: { ...prev.repository, template: template.id }
                    }))}
                    className={`p-3 rounded-lg border text-left ${
                      config.repository.template === template.id
                        ? 'border-blue-500 bg-blue-950/20'
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Repository Settings</label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Visibility</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={config.repository.visibility === 'private' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        repository: { ...prev.repository, visibility: 'private' }
                      }))}
                    >
                      Private
                    </Button>
                    <Button
                      size="sm"
                      variant={config.repository.visibility === 'public' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        repository: { ...prev.repository, visibility: 'public' }
                      }))}
                    >
                      Public
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Initialize with README</span>
                  <Switch
                    checked={config.repository.autoInit}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      repository: { ...prev.repository, autoInit: checked }
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Default Branch</span>
                  <input
                    type="text"
                    value={config.repository.defaultBranch}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      repository: { ...prev.repository, defaultBranch: e.target.value }
                    }))}
                    className="w-24 px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );
        
      case 2: // Integrations
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Select Integrations</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(INTEGRATION_TEMPLATES).map(([key, template]) => {
                  const isEnabled = config.integrations[key]?.enabled || false;
                  const iconMap: Record<string, any> = {
                    stripe: CreditCard,
                    clerk: Users,
                    turso: Database,
                    supabase: Database,
                    elevenlabs: Mic,
                    openrouter: Brain,
                    planetscale: Database,
                    sentry: Shield,
                    aws: Cloud,
                  };
                  const Icon = iconMap[key] || Zap;
                  
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setConfig(prev => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            [key]: {
                              enabled: !isEnabled,
                              config: {},
                              secrets: {},
                            },
                          },
                        }));
                      }}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        isEnabled
                          ? 'border-blue-500 bg-blue-950/20'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <Icon className="h-5 w-5 text-gray-400" />
                        {isEnabled && <CheckCircle className="h-4 w-4 text-blue-500" />}
                      </div>
                      <div className="mt-2">
                        <div className="font-medium text-sm">{template.name}</div>
                        <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {template.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {Object.entries(config.integrations).filter(([_, i]) => i.enabled).length > 0 && (
              <div className="p-4 bg-blue-950/20 border border-blue-900 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5" />
                  <div className="text-sm text-blue-300">
                    <p className="font-medium mb-1">Integration Setup</p>
                    <p className="text-xs text-blue-300/70">
                      You'll be prompted to configure API keys and settings for each integration after the app is created.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        
      case 3: // Deployment
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Environment Configuration</h3>
              
              {/* Staging Environment */}
              <div className="space-y-4 p-4 border border-gray-800 rounded-lg mb-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Staging Environment
                  </h4>
                  <Switch
                    checked={config.deployment.environments.staging.enabled}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        environments: {
                          ...prev.deployment.environments,
                          staging: { ...prev.deployment.environments.staging, enabled: checked }
                        }
                      }
                    }))}
                  />
                </div>
                
                {config.deployment.environments.staging.enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Domain</label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">https://</span>
                        <input
                          type="text"
                          value={config.deployment.environments.staging.domain || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            deployment: {
                              ...prev.deployment,
                              environments: {
                                ...prev.deployment.environments,
                                staging: { ...prev.deployment.environments.staging, domain: e.target.value }
                              }
                            }
                          }))}
                          className="flex-1 px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                          placeholder={`staging-${config.slug || 'app'}.gmac.io`}
                        />
                      </div>
                      {errors.stagingDomain && <p className="text-red-500 text-xs mt-1">{errors.stagingDomain}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Cluster</label>
                      <select
                        value={config.deployment.environments.staging.cluster || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          deployment: {
                            ...prev.deployment,
                            environments: {
                              ...prev.deployment.environments,
                              staging: { ...prev.deployment.environments.staging, cluster: e.target.value }
                            }
                          }
                        }))}
                        className="w-full px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                      >
                        <option value="">Select a cluster</option>
                        {AVAILABLE_CLUSTERS.map(cluster => (
                          <option key={cluster.id} value={cluster.id} disabled={!cluster.available}>
                            {cluster.name} - {cluster.location}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Production Environment */}
              <div className="space-y-4 p-4 border border-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Production Environment
                  </h4>
                  <Switch
                    checked={config.deployment.environments.production.enabled}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        environments: {
                          ...prev.deployment.environments,
                          production: { ...prev.deployment.environments.production, enabled: checked }
                        }
                      }
                    }))}
                  />
                </div>
                
                {config.deployment.environments.production.enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Domain</label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">https://</span>
                        <input
                          type="text"
                          value={config.deployment.environments.production.domain || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            deployment: {
                              ...prev.deployment,
                              environments: {
                                ...prev.deployment.environments,
                                production: { ...prev.deployment.environments.production, domain: e.target.value }
                              }
                            }
                          }))}
                          className="flex-1 px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                          placeholder={`${config.slug || 'app'}.gmac.io`}
                        />
                      </div>
                      {errors.productionDomain && <p className="text-red-500 text-xs mt-1">{errors.productionDomain}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Cluster</label>
                      <select
                        value={config.deployment.environments.production.cluster || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          deployment: {
                            ...prev.deployment,
                            environments: {
                              ...prev.deployment.environments,
                              production: { ...prev.deployment.environments.production, cluster: e.target.value }
                            }
                          }
                        }))}
                        className="w-full px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                      >
                        <option value="">Select a cluster</option>
                        {AVAILABLE_CLUSTERS.filter(c => c.id.includes('prod')).map(cluster => (
                          <option key={cluster.id} value={cluster.id} disabled={!cluster.available}>
                            {cluster.name} - {cluster.location}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">CI/CD Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-deploy to Staging</span>
                  <Switch
                    checked={config.deployment.cicd.autoDeployStaging}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        cicd: { ...prev.deployment.cicd, autoDeployStaging: checked }
                      }
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-deploy to Production</span>
                  <Switch
                    checked={config.deployment.cicd.autoDeployProduction}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        cicd: { ...prev.deployment.cicd, autoDeployProduction: checked }
                      }
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Run Tests</span>
                  <Switch
                    checked={config.deployment.cicd.runTests}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        cicd: { ...prev.deployment.cicd, runTests: checked }
                      }
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Enable Build Cache</span>
                  <Switch
                    checked={config.deployment.cicd.buildCache}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        cicd: { ...prev.deployment.cicd, buildCache: checked }
                      }
                    }))}
                  />
                </div>
              </div>
            </div>
          </div>
        );
        
      case 4: // Resources
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Resource Allocation</h3>
              
              {/* CPU */}
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      CPU Request
                    </label>
                    <span className="text-sm text-gray-400">{config.deployment.resources.cpu.request}m</span>
                  </div>
                  <Slider
                    value={[config.deployment.resources.cpu.request]}
                    onValueChange={(value) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        resources: {
                          ...prev.deployment.resources,
                          cpu: { ...prev.deployment.resources.cpu, request: value[0] }
                        }
                      }
                    }))}
                    min={50}
                    max={2000}
                    step={50}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>50m</span>
                    <span>2000m (2 vCPU)</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">CPU Limit</label>
                    <span className="text-sm text-gray-400">{config.deployment.resources.cpu.limit}m</span>
                  </div>
                  <Slider
                    value={[config.deployment.resources.cpu.limit]}
                    onValueChange={(value) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        resources: {
                          ...prev.deployment.resources,
                          cpu: { ...prev.deployment.resources.cpu, limit: value[0] }
                        }
                      }
                    }))}
                    min={config.deployment.resources.cpu.request}
                    max={4000}
                    step={100}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{config.deployment.resources.cpu.request}m (min)</span>
                    <span>4000m (4 vCPU)</span>
                  </div>
                </div>
              </div>
              
              {/* Memory */}
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      Memory Request
                    </label>
                    <span className="text-sm text-gray-400">{config.deployment.resources.memory.request} MB</span>
                  </div>
                  <Slider
                    value={[config.deployment.resources.memory.request]}
                    onValueChange={(value) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        resources: {
                          ...prev.deployment.resources,
                          memory: { ...prev.deployment.resources.memory, request: value[0] }
                        }
                      }
                    }))}
                    min={64}
                    max={4096}
                    step={64}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>64 MB</span>
                    <span>4096 MB (4 GB)</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Memory Limit</label>
                    <span className="text-sm text-gray-400">{config.deployment.resources.memory.limit} MB</span>
                  </div>
                  <Slider
                    value={[config.deployment.resources.memory.limit]}
                    onValueChange={(value) => setConfig(prev => ({
                      ...prev,
                      deployment: {
                        ...prev.deployment,
                        resources: {
                          ...prev.deployment.resources,
                          memory: { ...prev.deployment.resources.memory, limit: value[0] }
                        }
                      }
                    }))}
                    min={config.deployment.resources.memory.request}
                    max={8192}
                    step={128}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{config.deployment.resources.memory.request} MB (min)</span>
                    <span>8192 MB (8 GB)</span>
                  </div>
                </div>
              </div>
              
              {/* Replicas */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Auto-scaling
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Min Replicas</label>
                    <input
                      type="number"
                      value={config.deployment.resources.replicas.min}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        deployment: {
                          ...prev.deployment,
                          resources: {
                            ...prev.deployment.resources,
                            replicas: { ...prev.deployment.resources.replicas, min: parseInt(e.target.value) || 1 }
                          }
                        }
                      }))}
                      min={1}
                      max={10}
                      className="w-full px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max Replicas</label>
                    <input
                      type="number"
                      value={config.deployment.resources.replicas.max}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        deployment: {
                          ...prev.deployment,
                          resources: {
                            ...prev.deployment.resources,
                            replicas: { ...prev.deployment.resources.replicas, max: parseInt(e.target.value) || 3 }
                          }
                        }
                      }))}
                      min={config.deployment.resources.replicas.min}
                      max={20}
                      className="w-full px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Resource Summary */}
            <div className="p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium mb-3">Resource Summary</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">CPU:</span>
                  <span className="ml-2">{config.deployment.resources.cpu.request}m - {config.deployment.resources.cpu.limit}m</span>
                </div>
                <div>
                  <span className="text-gray-400">Memory:</span>
                  <span className="ml-2">{config.deployment.resources.memory.request}MB - {config.deployment.resources.memory.limit}MB</span>
                </div>
                <div>
                  <span className="text-gray-400">Replicas:</span>
                  <span className="ml-2">{config.deployment.resources.replicas.min} - {config.deployment.resources.replicas.max}</span>
                </div>
                <div>
                  <span className="text-gray-400">Est. Cost:</span>
                  <span className="ml-2 text-green-400">${calculateCost().monthly}/mo</span>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 5: // Monitoring
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Monitoring & Observability</h3>
                <Switch
                  checked={config.monitoring.enabled}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    monitoring: { ...prev.monitoring, enabled: checked }
                  }))}
                />
              </div>
              
              {config.monitoring.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Monitoring Provider</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['prometheus', 'datadog', 'newrelic'].map((provider) => (
                        <button
                          key={provider}
                          onClick={() => setConfig(prev => ({
                            ...prev,
                            monitoring: { ...prev.monitoring, provider: provider as any }
                          }))}
                          className={`p-3 rounded-lg border ${
                            config.monitoring.provider === provider
                              ? 'border-blue-500 bg-blue-950/20'
                              : 'border-gray-800 hover:border-gray-700'
                          }`}
                        >
                          <Shield className="h-5 w-5 mx-auto mb-1" />
                          <span className="text-sm capitalize">{provider}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Alerts</span>
                        <p className="text-xs text-gray-400">Get notified about issues</p>
                      </div>
                      <Switch
                        checked={config.monitoring.alerts}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          monitoring: { ...prev.monitoring, alerts: checked }
                        }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Logging</span>
                        <p className="text-xs text-gray-400">Centralized log collection</p>
                      </div>
                      <Switch
                        checked={config.monitoring.logging}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          monitoring: { ...prev.monitoring, logging: checked }
                        }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Distributed Tracing</span>
                        <p className="text-xs text-gray-400">Track requests across services</p>
                      </div>
                      <Switch
                        checked={config.monitoring.tracing}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          monitoring: { ...prev.monitoring, tracing: checked }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {config.monitoring.alerts && (
              <div className="p-4 bg-yellow-950/20 border border-yellow-900 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                  <div className="text-sm text-yellow-300">
                    <p className="font-medium mb-1">Default Alerts</p>
                    <p className="text-xs text-yellow-300/70">
                      We'll set up default alerts for high CPU/memory usage, error rates, and downtime.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        
      case 6: // Review
        const cost = calculateCost();
        const enabledIntegrations = Object.entries(config.integrations)
          .filter(([_, i]) => i.enabled)
          .map(([key]) => INTEGRATION_TEMPLATES[key as keyof typeof INTEGRATION_TEMPLATES]);
        
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Review Configuration</h3>
              
              {/* Basic Info */}
              <div className="p-4 bg-gray-900 rounded-lg mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Application</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Name:</span>
                    <span>{config.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Slug:</span>
                    <span>{config.slug}</span>
                  </div>
                  {config.description && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Description:</span>
                      <span className="text-right max-w-xs">{config.description}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Repository */}
              <div className="p-4 bg-gray-900 rounded-lg mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Repository</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Provider:</span>
                    <span className="capitalize">{config.repository.provider}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Template:</span>
                    <span>{REPOSITORY_TEMPLATES.find(t => t.id === config.repository.template)?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Visibility:</span>
                    <span className="capitalize">{config.repository.visibility}</span>
                  </div>
                </div>
              </div>
              
              {/* Integrations */}
              {enabledIntegrations.length > 0 && (
                <div className="p-4 bg-gray-900 rounded-lg mb-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Integrations</h4>
                  <div className="flex flex-wrap gap-2">
                    {enabledIntegrations.map(integration => (
                      <Badge key={integration.provider} variant="secondary">
                        {integration.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Environments */}
              <div className="p-4 bg-gray-900 rounded-lg mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Environments</h4>
                <div className="space-y-3">
                  {config.deployment.environments.staging.enabled && (
                    <div>
                      <div className="font-medium text-sm mb-1">Staging</div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <span>Domain: {config.deployment.environments.staging.domain || 'Auto-generated'}</span>
                        <span>Cluster: {config.deployment.environments.staging.cluster}</span>
                      </div>
                    </div>
                  )}
                  {config.deployment.environments.production.enabled && (
                    <div>
                      <div className="font-medium text-sm mb-1">Production</div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <span>Domain: {config.deployment.environments.production.domain || 'Auto-generated'}</span>
                        <span>Cluster: {config.deployment.environments.production.cluster}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Resources */}
              <div className="p-4 bg-gray-900 rounded-lg mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Resources</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">CPU:</span>
                    <span className="ml-2">{config.deployment.resources.cpu.request}m - {config.deployment.resources.cpu.limit}m</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Memory:</span>
                    <span className="ml-2">{config.deployment.resources.memory.request}MB - {config.deployment.resources.memory.limit}MB</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Replicas:</span>
                    <span className="ml-2">{config.deployment.resources.replicas.min} - {config.deployment.resources.replicas.max}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Monitoring:</span>
                    <span className="ml-2">{config.monitoring.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
              
              {/* Cost Estimate */}
              <div className="p-4 bg-gradient-to-r from-blue-950/50 to-purple-950/50 rounded-lg border border-blue-900">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Estimated Monthly Cost
                </h4>
                <div className="text-3xl font-bold mb-3">${cost.monthly}</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <span>Infrastructure: ${cost.breakdown.infrastructure}</span>
                  <span>Integrations: ${cost.breakdown.integrations}</span>
                  <span>Storage: ${cost.breakdown.storage}</span>
                  <span>Bandwidth: ${cost.breakdown.bandwidth}</span>
                </div>
              </div>
            </div>
            
            {errors.submit && (
              <div className="p-4 bg-red-950/20 border border-red-900 rounded-lg">
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="h-6 w-6 text-blue-500" />
              Create New Application
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress */}
          <div className="space-y-2">
            <Progress value={(currentStep + 1) / STEPS.length * 100} className="h-2" />
            <div className="flex justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <button
                    key={step.id}
                    onClick={() => index <= currentStep && setCurrentStep(index)}
                    disabled={index > currentStep}
                    className={`flex flex-col items-center gap-1 ${
                      index === currentStep
                        ? 'text-blue-500'
                        : index < currentStep
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs hidden sm:block">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {renderStepContent()}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                Step {currentStep + 1} of {STEPS.length}
              </span>
            </div>
            
            {currentStep === STEPS.length - 1 ? (
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Create Application
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}