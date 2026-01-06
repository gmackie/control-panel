"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  GitBranch,
  Server,
  Globe,
  Zap,
  Key,
  X,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Rocket,
  Package,
  ExternalLink,
  SkipForward,
} from "lucide-react";

interface GiteaRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  created_at: string;
  updated_at: string;
  language: string;
  owner: { login: string };
}

interface K8sDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  image?: string;
  createdAt: string;
  ingress?: { host: string; tls: boolean };
}

interface IntegrationDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  secrets: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

interface ImportWizardState {
  selectedRepo: GiteaRepo | null;
  selectedDeployment: K8sDeployment | null;
  environments: {
    staging: { enabled: boolean; domain: string; cluster: string };
    production: { enabled: boolean; domain: string; cluster: string };
  };
  integrations: Record<string, { enabled: boolean; secrets: Record<string, string> }>;
}

interface ImportAppWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appId: string) => void;
}

const STEPS = [
  { id: "repo", title: "Repository", icon: GitBranch },
  { id: "k8s", title: "K8s Resources", icon: Server },
  { id: "env", title: "Environments", icon: Globe },
  { id: "integrations", title: "Integrations", icon: Zap },
  { id: "review", title: "Review", icon: CheckCircle },
];

const AVAILABLE_CLUSTERS = [
  { id: "k3s-master-1", name: "K3s Production", location: "Hetzner" },
];

const INTEGRATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clerk: Key,
  stripe: Key,
  turso: Server,
  supabase: Server,
  openrouter: Zap,
  openai: Zap,
};

export function ImportAppWizard({ isOpen, onClose, onSuccess }: ImportAppWizardProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [k8sSearchQuery, setK8sSearchQuery] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<ImportWizardState>({
    selectedRepo: null,
    selectedDeployment: null,
    environments: {
      staging: { enabled: false, domain: "", cluster: "k3s-master-1" },
      production: { enabled: true, domain: "", cluster: "k3s-master-1" },
    },
    integrations: {},
  });

  const { data: reposData, isLoading: loadingRepos } = useQuery({
    queryKey: ["gitea-repos"],
    queryFn: async () => {
      const response = await fetch("/api/gitea/repos");
      if (!response.ok) throw new Error("Failed to fetch repos");
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: deploymentsData, isLoading: loadingDeployments } = useQuery({
    queryKey: ["k8s-deployments"],
    queryFn: async () => {
      const response = await fetch("/api/k8s/deployments");
      if (!response.ok) throw new Error("Failed to fetch deployments");
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: integrationsData, isLoading: loadingIntegrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const response = await fetch("/api/applications/create-wizard");
      if (!response.ok) throw new Error("Failed to fetch integrations");
      return response.json();
    },
    enabled: isOpen,
  });

  const repos: GiteaRepo[] = reposData?.repos || [];
  const deployments: K8sDeployment[] = deploymentsData?.deployments || [];
  const integrations: Record<string, IntegrationDefinition> = integrationsData?.integrations || {};

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDeployments = deployments.filter(
    (dep) =>
      dep.name.toLowerCase().includes(k8sSearchQuery.toLowerCase()) ||
      dep.namespace.toLowerCase().includes(k8sSearchQuery.toLowerCase())
  );

  useEffect(() => {
    if (state.selectedRepo && !state.environments.production.domain) {
      setState((prev) => ({
        ...prev,
        environments: {
          ...prev.environments,
          staging: {
            ...prev.environments.staging,
            domain: `${prev.selectedRepo?.name}-staging.gmac.io`,
          },
          production: {
            ...prev.environments.production,
            domain: `${prev.selectedRepo?.name}.gmac.io`,
          },
        },
      }));
    }
  }, [state.selectedRepo]);

  const handleNext = () => {
    if (currentStep === 0 && !state.selectedRepo) {
      setError("Please select a repository");
      return;
    }
    setError(null);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setError(null);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    if (!state.selectedRepo) return;

    setIsCreating(true);
    setError(null);

    try {
      const payload = {
        name: state.selectedRepo.name,
        slug: state.selectedRepo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: state.selectedRepo.description || `Imported from ${state.selectedRepo.full_name}`,
        repository: state.selectedRepo.clone_url,
        deployment: state.selectedDeployment
          ? {
              name: state.selectedDeployment.name,
              namespace: state.selectedDeployment.namespace,
            }
          : undefined,
        environments: state.environments,
        integrations: Object.entries(state.integrations)
          .filter(([_, v]) => v.enabled)
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
      };

      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create application");
      }

      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      onSuccess?.(result.application?.id || result.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateIntegrationSecret = (integrationKey: string, secretName: string, value: string) => {
    setState((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        [integrationKey]: {
          ...prev.integrations[integrationKey],
          secrets: {
            ...prev.integrations[integrationKey]?.secrets,
            [secretName]: value,
          },
        },
      },
    }));
  };

  const enabledIntegrations = Object.entries(state.integrations)
    .filter(([_, v]) => v.enabled)
    .map(([key]) => ({ key, definition: integrations[key] }))
    .filter((i) => i.definition);

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-900 border-gray-800"
              />
            </div>

            {loadingRepos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid gap-2 max-h-[400px] overflow-auto">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => setState((prev) => ({ ...prev, selectedRepo: repo }))}
                    className={`p-4 rounded-lg border text-left ${
                      state.selectedRepo?.id === repo.id
                        ? "border-blue-500 bg-blue-950/20"
                        : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{repo.name}</span>
                        {repo.private && <Badge variant="secondary">Private</Badge>}
                      </div>
                      {state.selectedRepo?.id === repo.id && (
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {repo.language && <span>{repo.language}</span>}
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 hover:text-gray-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </a>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-sm text-gray-400">
                Optionally link this application to an existing Kubernetes deployment.
                This step can be skipped if you want to create a new deployment later.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search deployments..."
                value={k8sSearchQuery}
                onChange={(e) => setK8sSearchQuery(e.target.value)}
                className="pl-9 bg-gray-900 border-gray-800"
              />
            </div>

            {loadingDeployments ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredDeployments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No deployments found</p>
              </div>
            ) : (
              <div className="grid gap-2 max-h-[350px] overflow-auto">
                <button
                  onClick={() => setState((prev) => ({ ...prev, selectedDeployment: null }))}
                  className={`p-4 rounded-lg border text-left ${
                    state.selectedDeployment === null
                      ? "border-blue-500 bg-blue-950/20"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Skip - No K8s Deployment</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Create deployment configuration later</p>
                </button>

                {filteredDeployments.map((dep) => (
                  <button
                    key={`${dep.namespace}/${dep.name}`}
                    onClick={() => setState((prev) => ({ ...prev, selectedDeployment: dep }))}
                    className={`p-4 rounded-lg border text-left ${
                      state.selectedDeployment?.name === dep.name &&
                      state.selectedDeployment?.namespace === dep.namespace
                        ? "border-blue-500 bg-blue-950/20"
                        : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{dep.name}</span>
                        <Badge variant="outline">{dep.namespace}</Badge>
                      </div>
                      {state.selectedDeployment?.name === dep.name &&
                        state.selectedDeployment?.namespace === dep.namespace && (
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>
                        {dep.readyReplicas}/{dep.replicas} ready
                      </span>
                      {dep.ingress && (
                        <span className="text-blue-400">{dep.ingress.host}</span>
                      )}
                    </div>
                    {dep.image && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{dep.image}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-4 p-4 border border-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Staging Environment
                </h4>
                <Switch
                  checked={state.environments.staging.enabled}
                  onCheckedChange={(checked) =>
                    setState((prev) => ({
                      ...prev,
                      environments: {
                        ...prev.environments,
                        staging: { ...prev.environments.staging, enabled: checked },
                      },
                    }))
                  }
                />
              </div>

              {state.environments.staging.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Domain</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">https://</span>
                      <Input
                        value={state.environments.staging.domain}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            environments: {
                              ...prev.environments,
                              staging: { ...prev.environments.staging, domain: e.target.value },
                            },
                          }))
                        }
                        className="flex-1 bg-gray-900 border-gray-800"
                        placeholder={`${state.selectedRepo?.name || "app"}-staging.gmac.io`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Cluster</label>
                    <select
                      value={state.environments.staging.cluster}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          environments: {
                            ...prev.environments,
                            staging: { ...prev.environments.staging, cluster: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-2 py-2 bg-gray-900 border border-gray-800 rounded-md text-sm"
                    >
                      {AVAILABLE_CLUSTERS.map((cluster) => (
                        <option key={cluster.id} value={cluster.id}>
                          {cluster.name} - {cluster.location}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 p-4 border border-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Production Environment
                </h4>
                <Switch
                  checked={state.environments.production.enabled}
                  onCheckedChange={(checked) =>
                    setState((prev) => ({
                      ...prev,
                      environments: {
                        ...prev.environments,
                        production: { ...prev.environments.production, enabled: checked },
                      },
                    }))
                  }
                />
              </div>

              {state.environments.production.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Domain</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">https://</span>
                      <Input
                        value={state.environments.production.domain}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            environments: {
                              ...prev.environments,
                              production: { ...prev.environments.production, domain: e.target.value },
                            },
                          }))
                        }
                        className="flex-1 bg-gray-900 border-gray-800"
                        placeholder={`${state.selectedRepo?.name || "app"}.gmac.io`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Cluster</label>
                    <select
                      value={state.environments.production.cluster}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          environments: {
                            ...prev.environments,
                            production: { ...prev.environments.production, cluster: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-2 py-2 bg-gray-900 border border-gray-800 rounded-md text-sm"
                    >
                      {AVAILABLE_CLUSTERS.map((cluster) => (
                        <option key={cluster.id} value={cluster.id}>
                          {cluster.name} - {cluster.location}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Select Integrations</h3>

              {loadingIntegrations ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {Object.entries(integrations).map(([key, integration]) => {
                    const isEnabled = state.integrations[key]?.enabled || false;
                    const Icon = INTEGRATION_ICONS[key] || Zap;

                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setState((prev) => ({
                            ...prev,
                            integrations: {
                              ...prev.integrations,
                              [key]: {
                                enabled: !isEnabled,
                                secrets: prev.integrations[key]?.secrets || {},
                              },
                            },
                          }));
                        }}
                        className={`p-4 rounded-lg border text-left ${
                          isEnabled
                            ? "border-blue-500 bg-blue-950/20"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <Icon className="h-5 w-5 text-gray-400" />
                          {isEnabled && <CheckCircle className="h-4 w-4 text-blue-500" />}
                        </div>
                        <div className="mt-2">
                          <div className="font-medium text-sm">{integration.name}</div>
                          <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {integration.description}
                          </div>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {integration.category}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {enabledIntegrations.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Configure Secrets</h4>
                  {enabledIntegrations.map(({ key, definition }) => (
                    <div key={key} className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                      <h5 className="font-medium mb-3">{definition.name}</h5>
                      <div className="space-y-3">
                        {definition.secrets?.map((secret) => {
                          const secretKey = `${key}.${secret.name}`;
                          const isVisible = showSecrets[secretKey];
                          const currentValue =
                            state.integrations[key]?.secrets?.[secret.name] || "";

                          return (
                            <div key={secret.name}>
                              <label className="text-sm font-medium flex items-center gap-2 mb-1">
                                {secret.name}
                                {secret.required && <span className="text-red-400">*</span>}
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type={isVisible ? "text" : "password"}
                                    value={currentValue}
                                    onChange={(e) =>
                                      updateIntegrationSecret(key, secret.name, e.target.value)
                                    }
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                                    placeholder={secret.description}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleSecretVisibility(secretKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                  >
                                    {isVisible ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Review Configuration</h3>

            <div className="p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Repository</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Name:</span>
                  <span>{state.selectedRepo?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Owner:</span>
                  <span>{state.selectedRepo?.owner.login}</span>
                </div>
                {state.selectedRepo?.language && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Language:</span>
                    <span>{state.selectedRepo.language}</span>
                  </div>
                )}
              </div>
            </div>

            {state.selectedDeployment && (
              <div className="p-4 bg-gray-900 rounded-lg">
                <h4 className="text-sm font-medium text-gray-400 mb-3">K8s Deployment</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Name:</span>
                    <span>{state.selectedDeployment.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Namespace:</span>
                    <span>{state.selectedDeployment.namespace}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Environments</h4>
              <div className="space-y-3">
                {state.environments.staging.enabled && (
                  <div>
                    <div className="font-medium text-sm mb-1">Staging</div>
                    <div className="text-xs text-gray-500">
                      {state.environments.staging.domain || `${state.selectedRepo?.name}-staging.gmac.io`}
                    </div>
                  </div>
                )}
                {state.environments.production.enabled && (
                  <div>
                    <div className="font-medium text-sm mb-1">Production</div>
                    <div className="text-xs text-gray-500">
                      {state.environments.production.domain || `${state.selectedRepo?.name}.gmac.io`}
                    </div>
                  </div>
                )}
                {!state.environments.staging.enabled && !state.environments.production.enabled && (
                  <p className="text-sm text-gray-500">No environments configured</p>
                )}
              </div>
            </div>

            {enabledIntegrations.length > 0 && (
              <div className="p-4 bg-gray-900 rounded-lg">
                <h4 className="text-sm font-medium text-gray-400 mb-3">
                  Integrations ({enabledIntegrations.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {enabledIntegrations.map(({ key, definition }) => (
                    <Badge key={key} variant="secondary">
                      {definition.name}
                    </Badge>
                  ))}
                </div>
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
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-950 border-gray-800">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="h-6 w-6 text-blue-500" />
              Import Application
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isCreating}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Progress value={((currentStep + 1) / STEPS.length) * 100} className="h-2" />
            <div className="flex justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <button
                    key={step.id}
                    onClick={() => !isCreating && index <= currentStep && setCurrentStep(index)}
                    disabled={index > currentStep || isCreating}
                    className={`flex flex-col items-center gap-1 ${
                      index === currentStep
                        ? "text-blue-500"
                        : index < currentStep
                        ? "text-gray-400"
                        : "text-gray-600"
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

        <div className="flex-1 overflow-auto p-6">{renderStepContent()}</div>

        {error && (
          <div className="px-6 pb-2">
            <div className="p-3 bg-red-950/20 border border-red-900 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        <div className="p-6 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0 || isCreating}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <span className="text-sm text-gray-400">
              Step {currentStep + 1} of {STEPS.length}
            </span>

            {currentStep === STEPS.length - 1 ? (
              <Button onClick={handleCreate} disabled={isCreating || !state.selectedRepo}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
              <Button onClick={handleNext} disabled={isCreating}>
                {currentStep === 1 ? "Next (or Skip)" : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
