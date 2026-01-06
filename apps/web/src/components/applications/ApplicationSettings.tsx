"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
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
import {
  Settings,
  GitBranch,
  Container,
  Server,
  RefreshCw,
  Link2,
  Unlink,
  Key,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Download,
  Trash2,
} from "lucide-react";

interface ApplicationSettingsProps {
  applicationId: string;
}

interface GiteaRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
}

interface HarborRepo {
  name: string;
  project_id: number;
  artifact_count: number;
}

interface K8sDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  image?: string;
}

interface AppConfig {
  id: string;
  name: string;
  slug: string;
  repository?: {
    provider: string;
    url: string;
    fullName: string;
  };
  registry?: {
    name: string;
    project: string;
  };
  deployment?: {
    name: string;
    namespace: string;
    cluster: string;
  };
}

export function ApplicationSettings({ applicationId }: ApplicationSettingsProps) {
  const queryClient = useQueryClient();
  const [showRepoDialog, setShowRepoDialog] = useState(false);
  const [showRegistryDialog, setShowRegistryDialog] = useState(false);
  const [showDeploymentDialog, setShowDeploymentDialog] = useState(false);
  const [showExtractSecretsDialog, setShowExtractSecretsDialog] = useState(false);
  const [extractingSecrets, setExtractingSecrets] = useState(false);
  const [extractResult, setExtractResult] = useState<{ success: boolean; message: string; secrets?: string[] } | null>(null);

  const { data: appData, isLoading: loadingApp } = useQuery<{ success: boolean; data: AppConfig }>({
    queryKey: ["app-config", applicationId],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${applicationId}`);
      if (!response.ok) throw new Error("Failed to fetch app config");
      return response.json();
    },
  });

  const { data: giteaRepos, isLoading: loadingGitea } = useQuery<{ repos: GiteaRepo[] }>({
    queryKey: ["gitea-repos"],
    queryFn: async () => {
      const response = await fetch("/api/gitea/repos");
      if (!response.ok) throw new Error("Failed to fetch repos");
      return response.json();
    },
    enabled: showRepoDialog,
  });

  const { data: harborRepos, isLoading: loadingHarbor } = useQuery<{ repositories: HarborRepo[] }>({
    queryKey: ["harbor-repos"],
    queryFn: async () => {
      const response = await fetch("/api/harbor/repos");
      if (!response.ok) throw new Error("Failed to fetch registry repos");
      return response.json();
    },
    enabled: showRegistryDialog,
  });

  const { data: k8sDeployments, isLoading: loadingK8s } = useQuery<{ deployments: K8sDeployment[] }>({
    queryKey: ["k8s-deployments"],
    queryFn: async () => {
      const response = await fetch("/api/k8s/deployments");
      if (!response.ok) throw new Error("Failed to fetch deployments");
      return response.json();
    },
    enabled: showDeploymentDialog,
  });

  const updateAppMutation = useMutation({
    mutationFn: async (updates: Partial<AppConfig>) => {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update application");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-config", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["unified-app", applicationId] });
      setShowRepoDialog(false);
      setShowRegistryDialog(false);
      setShowDeploymentDialog(false);
    },
  });

  const handleLinkRepo = (repo: GiteaRepo) => {
    updateAppMutation.mutate({
      repository: {
        provider: "gitea",
        url: repo.html_url,
        fullName: repo.full_name,
      },
    });
  };

  const handleLinkRegistry = (repo: HarborRepo) => {
    updateAppMutation.mutate({
      registry: {
        name: repo.name,
        project: "gmac",
      },
    });
  };

  const handleLinkDeployment = (deployment: K8sDeployment) => {
    updateAppMutation.mutate({
      deployment: {
        name: deployment.name,
        namespace: deployment.namespace,
        cluster: "k3s-master-1",
      },
    });
  };

  const handleUnlink = (resource: "repository" | "registry" | "deployment") => {
    updateAppMutation.mutate({ [resource]: null });
  };

  const handleExtractSecrets = async () => {
    if (!appData?.data?.deployment) return;
    
    setExtractingSecrets(true);
    setExtractResult(null);
    
    try {
      const response = await fetch(`/api/k8s/deployments/${appData.data.deployment.namespace}/${appData.data.deployment.name}`, {
        method: "GET",
      });
      
      if (!response.ok) throw new Error("Failed to fetch deployment details");
      
      const data = await response.json();
      const detectedIntegrations = data.detectedIntegrations || [];
      const secretNames = detectedIntegrations.flatMap((i: any) => 
        Object.keys(i.envVars || {})
      );
      
      setExtractResult({
        success: true,
        message: `Found ${secretNames.length} environment variables from ${detectedIntegrations.length} detected integrations`,
        secrets: secretNames,
      });
    } catch (error) {
      setExtractResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to extract secrets",
      });
    } finally {
      setExtractingSecrets(false);
    }
  };

  const app = appData?.data;

  if (loadingApp) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Application Settings
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure linked resources for your application
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-4 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-blue-500" />
                <h3 className="font-medium">Repository</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRepoDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {app?.repository ? "Change" : "Link"}
              </Button>
            </div>
            {app?.repository ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{app.repository.fullName}</p>
                  <a
                    href={app.repository.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {app.repository.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlink("repository")}
                  className="text-red-400 hover:text-red-300"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No repository linked</p>
            )}
          </div>

          <div className="p-4 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Container className="h-5 w-5 text-purple-500" />
                <h3 className="font-medium">Container Registry</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegistryDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {app?.registry ? "Change" : "Link"}
              </Button>
            </div>
            {app?.registry ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{app.registry.name}</p>
                  <p className="text-sm text-gray-400">
                    registry.gmac.io/{app.registry.project}/{app.registry.name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlink("registry")}
                  className="text-red-400 hover:text-red-300"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No registry linked</p>
            )}
          </div>

          <div className="p-4 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Kubernetes Deployment</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeploymentDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {app?.deployment ? "Change" : "Link"}
              </Button>
            </div>
            {app?.deployment ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{app.deployment.name}</p>
                  <p className="text-sm text-gray-400">
                    Namespace: {app.deployment.namespace} • Cluster: {app.deployment.cluster}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlink("deployment")}
                  className="text-red-400 hover:text-red-300"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No deployment linked</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Extract Secrets from Cluster
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Detect and import environment variables from your Kubernetes deployment
          </p>
        </div>

        {app?.deployment ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  setShowExtractSecretsDialog(true);
                  handleExtractSecrets();
                }}
                disabled={extractingSecrets}
              >
                {extractingSecrets ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Extract Secrets
                  </>
                )}
              </Button>
              <p className="text-sm text-gray-400">
                from {app.deployment.namespace}/{app.deployment.name}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-900/50 rounded-lg">
            <Server className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Link a Kubernetes deployment first to extract secrets</p>
          </div>
        )}
      </Card>

      <Card className="p-6 border-red-900/50">
        <div className="mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-red-400">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Irreversible actions for this application
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-red-950/20 border border-red-900/50 rounded-lg">
            <div>
              <p className="font-medium">Delete Application</p>
              <p className="text-sm text-gray-400">
                Permanently remove this application and all its data
              </p>
            </div>
            <Button variant="outline" className="border-red-800 text-red-400 hover:bg-red-950">
              Delete
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={showRepoDialog} onOpenChange={setShowRepoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Repository</DialogTitle>
            <DialogDescription>
              Select a Gitea repository to link to this application
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto space-y-2 py-4">
            {loadingGitea ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              giteaRepos?.repos?.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleLinkRepo(repo)}
                  className="w-full p-3 text-left rounded-lg border border-gray-800 hover:border-blue-500 hover:bg-blue-950/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{repo.full_name}</p>
                      <p className="text-sm text-gray-400 truncate">{repo.clone_url}</p>
                    </div>
                    <GitBranch className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRegistryDialog} onOpenChange={setShowRegistryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Container Registry</DialogTitle>
            <DialogDescription>
              Select a Harbor repository to link to this application
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto space-y-2 py-4">
            {loadingHarbor ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              harborRepos?.repositories?.map((repo) => (
                <button
                  key={repo.name}
                  onClick={() => handleLinkRegistry(repo)}
                  className="w-full p-3 text-left rounded-lg border border-gray-800 hover:border-purple-500 hover:bg-purple-950/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{repo.name}</p>
                      <p className="text-sm text-gray-400">
                        {repo.artifact_count} artifacts
                      </p>
                    </div>
                    <Container className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeploymentDialog} onOpenChange={setShowDeploymentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Kubernetes Deployment</DialogTitle>
            <DialogDescription>
              Select a deployment to link to this application
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto space-y-2 py-4">
            {loadingK8s ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              k8sDeployments?.deployments?.map((deployment) => (
                <button
                  key={`${deployment.namespace}/${deployment.name}`}
                  onClick={() => handleLinkDeployment(deployment)}
                  className="w-full p-3 text-left rounded-lg border border-gray-800 hover:border-green-500 hover:bg-green-950/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{deployment.name}</p>
                      <p className="text-sm text-gray-400">
                        {deployment.namespace} • {deployment.readyReplicas}/{deployment.replicas} ready
                      </p>
                    </div>
                    <Server className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExtractSecretsDialog} onOpenChange={setShowExtractSecretsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract Secrets</DialogTitle>
            <DialogDescription>
              Detected environment variables from your deployment
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {extractingSecrets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : extractResult ? (
              <div className="space-y-4">
                <div className={`flex items-start gap-3 p-4 rounded-lg ${
                  extractResult.success ? "bg-green-950/20 border border-green-900" : "bg-red-950/20 border border-red-900"
                }`}>
                  {extractResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  )}
                  <p className={extractResult.success ? "text-green-400" : "text-red-400"}>
                    {extractResult.message}
                  </p>
                </div>
                {extractResult.secrets && extractResult.secrets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Detected Variables:</p>
                    <div className="max-h-48 overflow-auto space-y-1">
                      {extractResult.secrets.map((secret) => (
                        <div
                          key={secret}
                          className="px-3 py-2 bg-gray-900 rounded text-sm font-mono"
                        >
                          {secret}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtractSecretsDialog(false)}>
              Close
            </Button>
            {extractResult?.success && extractResult.secrets && extractResult.secrets.length > 0 && (
              <Button>
                Import to Secrets
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
