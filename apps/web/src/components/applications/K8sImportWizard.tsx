"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  GitBranch,
  Server,
  Globe,
  Zap,
  X,
  Loader2,
  Search,
  Rocket,
  Package,
  ExternalLink,
  SkipForward,
  Database,
  Container,
} from "lucide-react";

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

interface DeploymentDetails {
  deployment: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    createdAt: string;
    replicas: number;
    readyReplicas: number;
    availableReplicas: number;
  };
  container: {
    name: string;
    image: string;
    ports?: Array<{ containerPort: number; name?: string }>;
  } | null;
  ingress: {
    name: string;
    host?: string;
    tls?: { hosts: string[]; secretName: string };
    paths: Array<{ path: string; service: string; port: number }>;
  } | null;
  detectedIntegrations: Array<{ name: string; icon: string; envVars: string[] }>;
  secrets: Array<{ name: string; type: string; keyCount: number }>;
  envVarCount: number;
}

interface GiteaRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  language: string;
  owner: { login: string };
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  language: string;
}

interface HarborRepo {
  id: number;
  name: string;
  fullName: string;
  project: string;
  artifactCount: number;
  tagCount: number;
  latestTag?: { name: string; pushedAt: string; size: number };
}

interface WizardState {
  productionDeployment: K8sDeployment | null;
  deploymentDetails: DeploymentDetails | null;
  stagingDeployment: K8sDeployment | null;
  githubRepo: GitHubRepo | null;
  giteaRepo: GiteaRepo | null;
  harborRepo: HarborRepo | null;
  appName: string;
  description: string;
}

interface K8sImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appId: string) => void;
}

const STEPS = [
  { id: "production", title: "Production K8s", icon: Server },
  { id: "extracted", title: "Extracted Data", icon: Zap },
  { id: "staging", title: "Staging (Optional)", icon: Server },
  { id: "github", title: "GitHub Repo", icon: GitBranch },
  { id: "gitea", title: "Gitea Repo", icon: GitBranch },
  { id: "harbor", title: "Container Image", icon: Container },
  { id: "review", title: "Review", icon: CheckCircle },
];

export function K8sImportWizard({ isOpen, onClose, onSuccess }: K8sImportWizardProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    productionDeployment: null,
    deploymentDetails: null,
    stagingDeployment: null,
    githubRepo: null,
    giteaRepo: null,
    harborRepo: null,
    appName: "",
    description: "",
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

  const { data: deploymentDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["deployment-details", state.productionDeployment?.namespace, state.productionDeployment?.name],
    queryFn: async () => {
      if (!state.productionDeployment) return null;
      const response = await fetch(
        `/api/k8s/deployments/${state.productionDeployment.namespace}/${state.productionDeployment.name}`
      );
      if (!response.ok) throw new Error("Failed to fetch deployment details");
      return response.json();
    },
    enabled: isOpen && !!state.productionDeployment,
  });

  const { data: githubReposData, isLoading: loadingGithub } = useQuery({
    queryKey: ["github-repos"],
    queryFn: async () => {
      const response = await fetch("/api/github?action=repositories");
      if (!response.ok) throw new Error("Failed to fetch GitHub repos");
      return response.json();
    },
    enabled: isOpen && currentStep >= 3,
  });

  const { data: giteaReposData, isLoading: loadingGitea } = useQuery({
    queryKey: ["gitea-repos"],
    queryFn: async () => {
      const response = await fetch("/api/gitea/repos");
      if (!response.ok) throw new Error("Failed to fetch Gitea repos");
      return response.json();
    },
    enabled: isOpen && currentStep >= 4,
  });

  const { data: harborReposData, isLoading: loadingHarbor } = useQuery({
    queryKey: ["harbor-repos"],
    queryFn: async () => {
      const response = await fetch("/api/harbor/repos");
      if (!response.ok) throw new Error("Failed to fetch Harbor repos");
      return response.json();
    },
    enabled: isOpen && currentStep >= 5,
  });

  const deployments: K8sDeployment[] = deploymentsData?.deployments || [];
  const githubRepos: GitHubRepo[] = githubReposData || [];
  const giteaRepos: GiteaRepo[] = giteaReposData?.repos || [];
  const harborRepos: HarborRepo[] = harborReposData?.repositories || [];

  useEffect(() => {
    if (deploymentDetails && !state.deploymentDetails) {
      setState(prev => ({
        ...prev,
        deploymentDetails,
        appName: prev.appName || deploymentDetails.deployment?.name || "",
        description: prev.description || `Imported from K8s deployment ${deploymentDetails.deployment?.namespace}/${deploymentDetails.deployment?.name}`,
      }));
    }
  }, [deploymentDetails, state.deploymentDetails]);

  const filteredDeployments = deployments.filter(
    dep =>
      dep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dep.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dep.ingress?.host?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGithubRepos = githubRepos.filter(
    repo =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGiteaRepos = giteaRepos.filter(
    repo =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHarborRepos = harborRepos.filter(
    repo =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNext = () => {
    if (currentStep === 0 && !state.productionDeployment) {
      setError("Please select a production deployment");
      return;
    }
    setError(null);
    setSearchQuery("");
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setError(null);
    setSearchQuery("");
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    if (!state.productionDeployment) return;

    setIsCreating(true);
    setError(null);

    try {
      const payload = {
        name: state.appName || state.productionDeployment.name,
        slug: (state.appName || state.productionDeployment.name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: state.description,
        repository: state.giteaRepo?.clone_url || state.githubRepo?.clone_url,
        githubRepository: state.githubRepo?.html_url,
        giteaRepository: state.giteaRepo?.html_url,
        harborImage: state.harborRepo?.fullName,
        deployment: {
          name: state.productionDeployment.name,
          namespace: state.productionDeployment.namespace,
        },
        stagingDeployment: state.stagingDeployment
          ? {
              name: state.stagingDeployment.name,
              namespace: state.stagingDeployment.namespace,
            }
          : undefined,
        environments: {
          staging: {
            enabled: !!state.stagingDeployment,
            domain: state.stagingDeployment?.ingress?.host || "",
            cluster: "k3s-master-1",
          },
          production: {
            enabled: true,
            domain: state.productionDeployment.ingress?.host || "",
            cluster: "k3s-master-1",
          },
        },
        detectedIntegrations: state.deploymentDetails?.detectedIntegrations || [],
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

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-950/20 border border-blue-900/50 rounded-lg">
              <p className="text-sm text-blue-300">
                Start by selecting your production Kubernetes deployment. We&apos;ll extract domain, integrations, and other configuration from it.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search deployments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
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
              <div className="grid gap-2 max-h-[400px] overflow-auto">
                {filteredDeployments.map((dep) => (
                  <button
                    key={`${dep.namespace}/${dep.name}`}
                    onClick={() => setState(prev => ({ ...prev, productionDeployment: dep, deploymentDetails: null }))}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      state.productionDeployment?.name === dep.name &&
                      state.productionDeployment?.namespace === dep.namespace
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
                      {state.productionDeployment?.name === dep.name &&
                        state.productionDeployment?.namespace === dep.namespace && (
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className={dep.readyReplicas === dep.replicas ? "text-green-400" : "text-yellow-400"}>
                        {dep.readyReplicas}/{dep.replicas} ready
                      </span>
                      {dep.ingress && (
                        <span className="text-blue-400 flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {dep.ingress.host}
                        </span>
                      )}
                    </div>
                    {dep.image && (
                      <p className="text-xs text-gray-600 mt-1 truncate flex items-center gap-1">
                        <Container className="h-3 w-3" />
                        {dep.image}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-400">Extracting deployment data...</span>
              </div>
            ) : state.deploymentDetails ? (
              <>
                <div className="grid gap-4">
                  <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Domain & Ingress
                    </h4>
                    {state.deploymentDetails.ingress ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Host:</span>
                          <span className="text-blue-400">{state.deploymentDetails.ingress.host}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">TLS:</span>
                          <Badge variant={state.deploymentDetails.ingress.tls ? "default" : "secondary"}>
                            {state.deploymentDetails.ingress.tls ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No ingress configured</p>
                    )}
                  </div>

                  <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Detected Integrations
                    </h4>
                    {state.deploymentDetails.detectedIntegrations.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {state.deploymentDetails.detectedIntegrations.map((int) => (
                          <Badge key={int.name} variant="secondary" className="flex items-center gap-1">
                            {int.name}
                            <span className="text-xs text-gray-500">({int.envVars.length} vars)</span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No integrations detected</p>
                    )}
                  </div>

                  <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Container className="h-4 w-4" />
                      Container
                    </h4>
                    {state.deploymentDetails.container ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Image:</span>
                          <span className="truncate max-w-[300px]">{state.deploymentDetails.container.image}</span>
                        </div>
                        {state.deploymentDetails.container.ports && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Ports:</span>
                            <span>{state.deploymentDetails.container.ports.map(p => p.containerPort).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No container info</p>
                    )}
                  </div>

                  <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Secrets ({state.deploymentDetails.secrets.length})
                    </h4>
                    {state.deploymentDetails.secrets.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {state.deploymentDetails.secrets.slice(0, 10).map((secret) => (
                          <Badge key={secret.name} variant="outline" className="text-xs">
                            {secret.name} ({secret.keyCount} keys)
                          </Badge>
                        ))}
                        {state.deploymentDetails.secrets.length > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{state.deploymentDetails.secrets.length - 10} more
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No secrets in namespace</p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Application Details</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">App Name</label>
                      <Input
                        value={state.appName}
                        onChange={(e) => setState(prev => ({ ...prev, appName: e.target.value }))}
                        placeholder={state.productionDeployment?.name}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Description</label>
                      <Input
                        value={state.description}
                        onChange={(e) => setState(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Application description"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a deployment first</p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-sm text-gray-400">
                Optionally link a staging deployment. This step can be skipped.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search staging deployments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="grid gap-2 max-h-[350px] overflow-auto">
              <button
                onClick={() => setState(prev => ({ ...prev, stagingDeployment: null }))}
                className={`p-4 rounded-lg border text-left ${
                  state.stagingDeployment === null
                    ? "border-blue-500 bg-blue-950/20"
                    : "border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <SkipForward className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">Skip - No Staging Deployment</span>
                </div>
              </button>

              {filteredDeployments
                .filter(dep => 
                  !(dep.name === state.productionDeployment?.name && 
                    dep.namespace === state.productionDeployment?.namespace)
                )
                .map((dep) => (
                  <button
                    key={`${dep.namespace}/${dep.name}`}
                    onClick={() => setState(prev => ({ ...prev, stagingDeployment: dep }))}
                    className={`p-4 rounded-lg border text-left ${
                      state.stagingDeployment?.name === dep.name &&
                      state.stagingDeployment?.namespace === dep.namespace
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
                      {state.stagingDeployment?.name === dep.name &&
                        state.stagingDeployment?.namespace === dep.namespace && (
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                        )}
                    </div>
                    {dep.ingress && (
                      <p className="text-xs text-blue-400 mt-2">{dep.ingress.host}</p>
                    )}
                  </button>
                ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-sm text-gray-400">
                Link your GitHub repository for CI/CD integration. This step can be skipped.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search GitHub repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingGithub ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid gap-2 max-h-[350px] overflow-auto">
                <button
                  onClick={() => setState(prev => ({ ...prev, githubRepo: null }))}
                  className={`p-4 rounded-lg border text-left ${
                    state.githubRepo === null
                      ? "border-blue-500 bg-blue-950/20"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Skip - No GitHub Repo</span>
                  </div>
                </button>

                {filteredGithubRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => setState(prev => ({ ...prev, githubRepo: repo }))}
                    className={`p-4 rounded-lg border text-left ${
                      state.githubRepo?.id === repo.id
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
                      {state.githubRepo?.id === repo.id && (
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

      case 4:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-sm text-gray-400">
                Link your Gitea repository (git.gmac.io). This step can be skipped.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search Gitea repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingGitea ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid gap-2 max-h-[350px] overflow-auto">
                <button
                  onClick={() => setState(prev => ({ ...prev, giteaRepo: null }))}
                  className={`p-4 rounded-lg border text-left ${
                    state.giteaRepo === null
                      ? "border-blue-500 bg-blue-950/20"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Skip - No Gitea Repo</span>
                  </div>
                </button>

                {filteredGiteaRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => setState(prev => ({ ...prev, giteaRepo: repo }))}
                    className={`p-4 rounded-lg border text-left ${
                      state.giteaRepo?.id === repo.id
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
                      {state.giteaRepo?.id === repo.id && (
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

      case 5:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-sm text-gray-400">
                Link your Harbor container image (registry.gmac.io). This step can be skipped.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search container images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingHarbor ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid gap-2 max-h-[350px] overflow-auto">
                <button
                  onClick={() => setState(prev => ({ ...prev, harborRepo: null }))}
                  className={`p-4 rounded-lg border text-left ${
                    state.harborRepo === null
                      ? "border-blue-500 bg-blue-950/20"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Skip - No Harbor Image</span>
                  </div>
                </button>

                {filteredHarborRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => setState(prev => ({ ...prev, harborRepo: repo }))}
                    className={`p-4 rounded-lg border text-left ${
                      state.harborRepo?.id === repo.id
                        ? "border-blue-500 bg-blue-950/20"
                        : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Container className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{repo.name}</span>
                        <Badge variant="outline">{repo.project}</Badge>
                      </div>
                      {state.harborRepo?.id === repo.id && (
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{repo.tagCount} tags</span>
                      <span>{repo.artifactCount} artifacts</span>
                      {repo.latestTag && (
                        <span className="text-blue-400">latest: {repo.latestTag.name}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Review Configuration</h3>

            <div className="p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Application</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Name:</span>
                  <span>{state.appName || state.productionDeployment?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Description:</span>
                  <span className="truncate max-w-[300px]">{state.description}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Production Deployment</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Deployment:</span>
                  <span>{state.productionDeployment?.namespace}/{state.productionDeployment?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Domain:</span>
                  <span className="text-blue-400">{state.productionDeployment?.ingress?.host || "Not configured"}</span>
                </div>
              </div>
            </div>

            {state.stagingDeployment && (
              <div className="p-4 bg-gray-900 rounded-lg">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Staging Deployment</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Deployment:</span>
                    <span>{state.stagingDeployment.namespace}/{state.stagingDeployment.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Domain:</span>
                    <span className="text-blue-400">{state.stagingDeployment.ingress?.host || "Not configured"}</span>
                  </div>
                </div>
              </div>
            )}

            {state.deploymentDetails?.detectedIntegrations && state.deploymentDetails.detectedIntegrations.length > 0 && (
              <div className="p-4 bg-gray-900 rounded-lg">
                <h4 className="text-sm font-medium text-gray-400 mb-3">
                  Detected Integrations ({state.deploymentDetails.detectedIntegrations.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {state.deploymentDetails.detectedIntegrations.map((int) => (
                    <Badge key={int.name} variant="secondary">
                      {int.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-900 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Linked Resources</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">GitHub:</span>
                  <span>{state.githubRepo?.full_name || "Not linked"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Gitea:</span>
                  <span>{state.giteaRepo?.full_name || "Not linked"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Harbor:</span>
                  <span>{state.harborRepo?.fullName || "Not linked"}</span>
                </div>
              </div>
            </div>
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
              Import from K8s
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
                    <span className="text-[10px] hidden sm:block">{step.title}</span>
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
              <Button onClick={handleCreate} disabled={isCreating || !state.productionDeployment}>
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
                {currentStep >= 2 ? "Next (or Skip)" : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
