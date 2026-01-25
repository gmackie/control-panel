"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  AlertTriangle,
  ExternalLink,
  Download,
  Trash2,
  Triangle,
  Smartphone,
  Database,
  Github,
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

interface VercelProject {
  id: string;
  name: string;
  framework?: string;
  productionUrl?: string;
}

interface ExpoProject {
  id: string;
  name: string;
  slug?: string;
  platform?: string;
}

interface NeonProject {
  id: string;
  name: string;
  regionId?: string;
}

interface TursoDatabase {
  id: string;
  name: string;
  group?: string;
  primaryRegion?: string;
  hostname?: string;
}

interface GitHubRepo {
  id: string;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
}

interface AppConfig {
  id: string;
  name: string;
  slug: string;
  vercelProjectId?: string | null;
  expoProjectId?: string | null;
  repositoryUrl?: string | null;
  repositoryPath?: string | null;
  gitProvider?: string | null;
  deployProvider?: string | null;
  k8sNamespace?: string | null;
  k8sDeploymentName?: string | null;
  repository?: {
    provider: string;
    url: string;
    fullName: string;
  } | null;
  registry?: {
    name: string;
    project: string;
  } | null;
  deployment?: {
    name: string;
    namespace: string;
    cluster: string;
  } | null;
  vercelProject?: VercelProject;
  expoProject?: ExpoProject;
  neonProject?: NeonProject | null;
  tursoDatabase?: TursoDatabase | null;
  githubRepo?: GitHubRepo | null;
}

export function ApplicationSettings({ applicationId }: ApplicationSettingsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showRepoDialog, setShowRepoDialog] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [showRegistryDialog, setShowRegistryDialog] = useState(false);
  const [showDeploymentDialog, setShowDeploymentDialog] = useState(false);
  const [showVercelDialog, setShowVercelDialog] = useState(false);
  const [showExpoDialog, setShowExpoDialog] = useState(false);
  const [showNeonDialog, setShowNeonDialog] = useState(false);
  const [showTursoDialog, setShowTursoDialog] = useState(false);
  const [showExtractSecretsDialog, setShowExtractSecretsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [extractingSecrets, setExtractingSecrets] = useState(false);
  const [extractResult, setExtractResult] = useState<{ success: boolean; message: string; secrets?: string[] } | null>(null);

  const { data: appData, isLoading: loadingApp } = useQuery<{ success: boolean; data: AppConfig }>({
    queryKey: ["app-config", applicationId],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${applicationId}`);
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

  const { data: vercelProjects, isLoading: loadingVercel } = useQuery<{ projects: VercelProject[] }>({
    queryKey: ["vercel-projects"],
    queryFn: async () => {
      const response = await fetch("/api/vercel/projects");
      if (!response.ok) throw new Error("Failed to fetch Vercel projects");
      return response.json();
    },
    enabled: showVercelDialog,
  });

  const { data: expoProjects, isLoading: loadingExpo } = useQuery<{ projects: ExpoProject[] }>({
    queryKey: ["expo-projects"],
    queryFn: async () => {
      const response = await fetch("/api/expo/projects");
      if (!response.ok) throw new Error("Failed to fetch Expo projects");
      return response.json();
    },
    enabled: showExpoDialog,
  });

  const { data: neonProjects, isLoading: loadingNeon } = useQuery<{ projects: NeonProject[] }>({
    queryKey: ["neon-projects"],
    queryFn: async () => {
      const response = await fetch("/api/neon/projects");
      if (!response.ok) throw new Error("Failed to fetch Neon projects");
      return response.json();
    },
    enabled: showNeonDialog,
  });

  const { data: tursoDatabases, isLoading: loadingTurso } = useQuery<{ databases: TursoDatabase[] }>({
    queryKey: ["turso-databases"],
    queryFn: async () => {
      const response = await fetch("/api/turso/databases");
      if (!response.ok) throw new Error("Failed to fetch Turso databases");
      return response.json();
    },
    enabled: showTursoDialog,
  });

  const { data: githubRepos, isLoading: loadingGitHub } = useQuery<{ repos: GitHubRepo[] }>({
    queryKey: ["github-repos"],
    queryFn: async () => {
      const response = await fetch("/api/github/repos");
      if (!response.ok) throw new Error("Failed to fetch GitHub repos");
      return response.json();
    },
    enabled: showGitHubDialog,
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
      setShowGitHubDialog(false);
      setShowRegistryDialog(false);
      setShowDeploymentDialog(false);
      setShowVercelDialog(false);
      setShowExpoDialog(false);
      setShowNeonDialog(false);
      setShowTursoDialog(false);
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete application");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      router.push("/applications");
    },
  });

  const handleDelete = () => {
    if (deleteConfirmation === app?.name) {
      deleteAppMutation.mutate();
    }
  };

  const handleLinkRepo = (repo: GiteaRepo) => {
    updateAppMutation.mutate({
      repositoryUrl: repo.html_url,
      repositoryPath: repo.full_name,
      gitProvider: "gitea",
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
      k8sNamespace: deployment.namespace,
      k8sDeploymentName: deployment.name,
      deployProvider: "kubernetes",
    });
  };

  const handleUnlink = (resource: "repository" | "registry" | "deployment") => {
    if (resource === "repository") {
      updateAppMutation.mutate({ repositoryUrl: null, repositoryPath: null });
      return;
    }

    if (resource === "deployment") {
      updateAppMutation.mutate({ k8sNamespace: null, k8sDeploymentName: null });
      return;
    }

    updateAppMutation.mutate({ [resource]: null });
  };

  const handleExtractSecrets = async () => {
    if (!appData?.data?.k8sNamespace || !appData?.data?.k8sDeploymentName) return;
    
    setExtractingSecrets(true);
    setExtractResult(null);
    
    try {
      const response = await fetch(`/api/k8s/deployments/${appData.data.k8sNamespace}/${appData.data.k8sDeploymentName}`, {
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

  const repositoryInfo =
    app?.repository ??
    (app?.repositoryUrl
      ? {
          provider: app.gitProvider || "github",
          url: app.repositoryUrl,
          fullName: app.repositoryPath || app.repositoryUrl,
        }
      : null);

  const deploymentInfo =
    app?.deployment ??
    (app?.k8sNamespace && app?.k8sDeploymentName
      ? {
          name: app.k8sDeploymentName,
          namespace: app.k8sNamespace,
          cluster: "k3s-master-1",
        }
      : null);

  const githubRepoInfo: { full_name: string; html_url: string } | null =
    app?.githubRepo ??
    (app?.gitProvider === "github" && app?.repositoryUrl
      ? {
          full_name: app.repositoryPath || app.repositoryUrl,
          html_url: app.repositoryUrl,
        }
      : null);

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
                {repositoryInfo ? "Change" : "Link"}
              </Button>
            </div>
            {repositoryInfo ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{repositoryInfo.fullName}</p>
                  <a
                    href={repositoryInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {repositoryInfo.url}
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
                {deploymentInfo ? "Change" : "Link"}
              </Button>
            </div>
            {deploymentInfo ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{deploymentInfo.name}</p>
                  <p className="text-sm text-gray-400">
                    Namespace: {deploymentInfo.namespace} • Cluster: {deploymentInfo.cluster}
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

          {/* Vercel Project */}
          <div className="p-4 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Triangle className="h-5 w-5 text-white" />
                <h3 className="font-medium">Vercel Project</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVercelDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {app?.vercelProjectId ? "Change" : "Link"}
              </Button>
            </div>
            {app?.vercelProject ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{app.vercelProject.name}</p>
                  <p className="text-sm text-gray-400">
                    {app.vercelProject.framework || "Unknown framework"} • {app.vercelProject.productionUrl || "No production URL"}
                  </p>
                </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateAppMutation.mutate({ vercelProjectId: null })}
                className="text-red-400 hover:text-red-300"
              >
                <Unlink className="h-4 w-4" />
              </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No Vercel project linked</p>
            )}
          </div>

          {/* Expo Project */}
          <div className="p-4 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-violet-500" />
                <h3 className="font-medium">Expo Project</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExpoDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {app?.expoProjectId ? "Change" : "Link"}
              </Button>
            </div>
            {app?.expoProject ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{app.expoProject.name}</p>
                  <p className="text-sm text-gray-400">
                    {app.expoProject.slug || "No slug"} • {app.expoProject.platform || "All platforms"}
                  </p>
                </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateAppMutation.mutate({ expoProjectId: null })}
                className="text-red-400 hover:text-red-300"
              >
                <Unlink className="h-4 w-4" />
              </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No Expo project linked</p>
            )}
          </div>

          {/* GitHub Repository */}
          <div className="p-4 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5 text-gray-400" />
                <h3 className="font-medium">GitHub Repository</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGitHubDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {githubRepoInfo ? "Change" : "Link"}
              </Button>
            </div>
            {githubRepoInfo ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{githubRepoInfo.full_name}</p>
                  <a
                    href={githubRepoInfo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {githubRepoInfo.html_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateAppMutation.mutate({ repositoryUrl: null, repositoryPath: null })}
                  className="text-red-400 hover:text-red-300"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No GitHub repository linked</p>
            )}
          </div>

          {/* Neon Database */}
          <div className="p-4 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-500" />
                <h3 className="font-medium">Neon Database</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNeonDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {app?.neonProject ? "Change" : "Link"}
              </Button>
            </div>
            {app?.neonProject ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{app.neonProject.name}</p>
                  <p className="text-sm text-gray-400">
                    Region: {app.neonProject.regionId || "Unknown"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateAppMutation.mutate({ neonProject: null })}
                  className="text-red-400 hover:text-red-300"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No Neon database linked</p>
            )}
          </div>

          {/* Turso Database */}
          <div className="p-4 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-500" />
                <h3 className="font-medium">Turso Database</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTursoDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {app?.tursoDatabase ? "Change" : "Link"}
              </Button>
            </div>
            {app?.tursoDatabase ? (
              <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{app.tursoDatabase.name}</p>
                  <p className="text-sm text-gray-400">
                    {app.tursoDatabase.group || "Default group"} • {app.tursoDatabase.primaryRegion || "Unknown region"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateAppMutation.mutate({ tursoDatabase: null })}
                  className="text-red-400 hover:text-red-300"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No Turso database linked</p>
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

        {deploymentInfo ? (
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
                from {deploymentInfo.namespace}/{deploymentInfo.name}
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
            <Button
              variant="outline"
              className="border-red-800 text-red-400 hover:bg-red-950"
              onClick={() => {
                setDeleteConfirmation("");
                setShowDeleteDialog(true);
              }}
            >
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

      {/* Vercel Dialog */}
      <Dialog open={showVercelDialog} onOpenChange={setShowVercelDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Vercel Project</DialogTitle>
            <DialogDescription>
              Select a Vercel project to link to this application
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto space-y-2 py-4">
            {loadingVercel ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : vercelProjects?.projects?.length ? (
              vercelProjects.projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => updateAppMutation.mutate({ vercelProjectId: project.id })}
                  className="w-full p-3 text-left rounded-lg border border-gray-800 hover:border-white hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-gray-400">
                        {project.framework || "Unknown"} • {project.productionUrl || "No URL"}
                      </p>
                    </div>
                    <Triangle className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No Vercel projects found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expo Dialog */}
      <Dialog open={showExpoDialog} onOpenChange={setShowExpoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Expo Project</DialogTitle>
            <DialogDescription>
              Select an Expo project to link to this application
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto space-y-2 py-4">
            {loadingExpo ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : expoProjects?.projects?.length ? (
              expoProjects.projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => updateAppMutation.mutate({ expoProjectId: project.id })}
                  className="w-full p-3 text-left rounded-lg border border-gray-800 hover:border-violet-500 hover:bg-violet-950/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-gray-400">
                        {project.slug || "No slug"} • {project.platform || "All platforms"}
                      </p>
                    </div>
                    <Smartphone className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No Expo projects found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* GitHub Dialog */}
      <Dialog open={showGitHubDialog} onOpenChange={setShowGitHubDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link GitHub Repository</DialogTitle>
            <DialogDescription>
              Select a GitHub repository to link to this application
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto space-y-2 py-4">
            {loadingGitHub ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : githubRepos?.repos?.length ? (
              githubRepos.repos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() =>
                    updateAppMutation.mutate({
                      repositoryUrl: repo.html_url,
                      repositoryPath: repo.full_name,
                      gitProvider: "github",
                    })
                  }
                  className="w-full p-3 text-left rounded-lg border border-gray-800 hover:border-gray-500 hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{repo.full_name}</p>
                      <p className="text-sm text-gray-400 truncate">{repo.html_url}</p>
                    </div>
                    <Github className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No GitHub repositories found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Neon Dialog */}
      <Dialog open={showNeonDialog} onOpenChange={setShowNeonDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Neon Database</DialogTitle>
            <DialogDescription>
              Select a Neon PostgreSQL database to link to this application
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto space-y-2 py-4">
            {loadingNeon ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : neonProjects?.projects?.length ? (
              neonProjects.projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => updateAppMutation.mutate({ neonProject: project })}
                  className="w-full p-3 text-left rounded-lg border border-gray-800 hover:border-emerald-500 hover:bg-emerald-950/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-gray-400">
                        Region: {project.regionId || "Unknown"}
                      </p>
                    </div>
                    <Database className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No Neon projects found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Turso Dialog */}
      <Dialog open={showTursoDialog} onOpenChange={setShowTursoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Turso Database</DialogTitle>
            <DialogDescription>
              Select a Turso database to link to this application
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto space-y-2 py-4">
            {loadingTurso ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : tursoDatabases?.databases?.length ? (
              tursoDatabases.databases.map((db) => (
                <button
                  key={db.id}
                  onClick={() => updateAppMutation.mutate({ tursoDatabase: db })}
                  className="w-full p-3 text-left rounded-lg border border-gray-800 hover:border-cyan-500 hover:bg-cyan-950/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{db.name}</p>
                      <p className="text-sm text-gray-400">
                        {db.group || "Default"} • {db.primaryRegion || "Unknown region"}
                      </p>
                    </div>
                    <Database className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No Turso databases found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Delete Application
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                This will permanently delete <strong className="text-white">{app?.name}</strong> and all associated data:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-gray-400">
                <li>Tasks and task comments</li>
                <li>Releases and release assets</li>
                <li>Integrations and configurations</li>
                <li>Activity logs and notifications</li>
              </ul>
              <p className="text-yellow-500 text-sm">
                Linked resources (K8s deployments, Vercel projects, databases) will NOT be deleted.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-confirm" className="text-sm text-gray-400">
              Type <strong className="text-white">{app?.name}</strong> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={app?.name}
              className="mt-2"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteAppMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmation !== app?.name || deleteAppMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAppMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Application"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
