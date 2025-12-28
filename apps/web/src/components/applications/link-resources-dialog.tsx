"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GitBranch,
  Github,
  Server,
  Triangle,
  Loader2,
  AlertCircle,
} from "lucide-react";

// Types
interface Repository {
  id: string | number;
  name: string;
  full_name?: string;
  fullName?: string;
  owner?: { login?: string } | string;
  description?: string;
  default_branch?: string;
  defaultBranch?: string;
  language?: string;
  private?: boolean;
  html_url?: string;
  htmlUrl?: string;
  clone_url?: string;
  cloneUrl?: string;
  ssh_url?: string;
  sshUrl?: string;
}

interface K8sDeployment {
  name: string;
  namespace: string;
  replicas?: number;
  readyReplicas?: number;
  image?: string;
}

interface VercelProject {
  id: string;
  name: string;
  framework?: string;
  link?: { repo?: string };
}

interface LinkedRepository {
  provider: "gitea" | "github" | "gitlab";
  repoId: string;
  fullName: string;
  name: string;
  owner: string;
  url: string;
  cloneUrl?: string;
  sshUrl?: string;
  defaultBranch?: string;
  description?: string;
  language?: string;
  isPrivate?: boolean;
  role: "primary" | "mirror" | "archive";
}

interface LinkedDeployment {
  provider: "kubernetes" | "vercel";
  namespace?: string;
  deploymentName?: string;
  vercelProjectId?: string;
  vercelProjectName?: string;
  environment: "production" | "staging" | "development";
}

interface LinkResourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Pre-selected resources
  selectedGiteaRepos?: Repository[];
  selectedGithubRepos?: Repository[];
  selectedK8sDeployments?: K8sDeployment[];
  selectedVercelProjects?: VercelProject[];
  // All available resources for selection
  giteaRepos?: Repository[];
  githubRepos?: Repository[];
  k8sDeployments?: K8sDeployment[];
  vercelProjects?: VercelProject[];
}

export function LinkResourcesDialog({
  open,
  onOpenChange,
  selectedGiteaRepos = [],
  selectedGithubRepos = [],
  selectedK8sDeployments = [],
  selectedVercelProjects = [],
  giteaRepos = [],
  githubRepos = [],
  k8sDeployments = [],
  vercelProjects = [],
}: LinkResourcesDialogProps) {
  const queryClient = useQueryClient();
  
  // Form state
  const [appName, setAppName] = useState("");
  const [appSlug, setAppSlug] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [appType, setAppType] = useState<"web" | "api" | "worker" | "cron">("web");
  
  // Selected resources state (initialized with pre-selected)
  const [selectedGitea, setSelectedGitea] = useState<Set<string>>(
    new Set(selectedGiteaRepos.map(r => String(r.id)))
  );
  const [selectedGithub, setSelectedGithub] = useState<Set<string>>(
    new Set(selectedGithubRepos.map(r => String(r.id)))
  );
  const [selectedK8s, setSelectedK8s] = useState<Set<string>>(
    new Set(selectedK8sDeployments.map(d => `${d.namespace}/${d.name}`))
  );
  const [selectedVercel, setSelectedVercel] = useState<Set<string>>(
    new Set(selectedVercelProjects.map(p => p.id))
  );
  
  // Primary repository selection
  const [primaryRepo, setPrimaryRepo] = useState<string>("");

  // Create application mutation
  const createAppMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      slug?: string;
      description?: string;
      type: string;
      repositories: LinkedRepository[];
      deployments: LinkedDeployment[];
    }) => {
      const res = await fetch("/api/applications/from-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create application");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setAppName("");
    setAppSlug("");
    setAppDescription("");
    setAppType("web");
    setSelectedGitea(new Set());
    setSelectedGithub(new Set());
    setSelectedK8s(new Set());
    setSelectedVercel(new Set());
    setPrimaryRepo("");
  };

  // Get all selected repositories
  const getAllSelectedRepos = (): LinkedRepository[] => {
    const repos: LinkedRepository[] = [];
    
    // Add Gitea repos
    giteaRepos
      .filter(r => selectedGitea.has(String(r.id)))
      .forEach(r => {
        const owner = typeof r.owner === 'object' ? r.owner?.login : r.owner;
        const fullName = r.full_name || r.fullName || `${owner}/${r.name}`;
        const repoKey = `gitea:${r.id}`;
        repos.push({
          provider: "gitea",
          repoId: String(r.id),
          fullName,
          name: r.name,
          owner: owner || "",
          url: r.html_url || r.htmlUrl || "",
          cloneUrl: r.clone_url || r.cloneUrl,
          sshUrl: r.ssh_url || r.sshUrl,
          defaultBranch: r.default_branch || r.defaultBranch || "main",
          description: r.description,
          language: r.language,
          isPrivate: r.private,
          role: primaryRepo === repoKey ? "primary" : "mirror",
        });
      });
    
    // Add GitHub repos
    githubRepos
      .filter(r => selectedGithub.has(String(r.id)))
      .forEach(r => {
        const owner = typeof r.owner === 'object' ? r.owner?.login : r.owner;
        const fullName = r.full_name || r.fullName || `${owner}/${r.name}`;
        const repoKey = `github:${r.id}`;
        repos.push({
          provider: "github",
          repoId: String(r.id),
          fullName,
          name: r.name,
          owner: owner || "",
          url: r.html_url || r.htmlUrl || "",
          cloneUrl: r.clone_url || r.cloneUrl,
          sshUrl: r.ssh_url || r.sshUrl,
          defaultBranch: r.default_branch || r.defaultBranch || "main",
          description: r.description,
          language: r.language,
          isPrivate: r.private,
          role: primaryRepo === repoKey ? "primary" : "mirror",
        });
      });
    
    // Ensure at least one is primary
    if (repos.length > 0 && !repos.some(r => r.role === "primary")) {
      repos[0].role = "primary";
    }
    
    return repos;
  };

  // Get all selected deployments
  const getAllSelectedDeployments = (): LinkedDeployment[] => {
    const deployments: LinkedDeployment[] = [];
    
    // Add K8s deployments
    k8sDeployments
      .filter(d => selectedK8s.has(`${d.namespace}/${d.name}`))
      .forEach(d => {
        deployments.push({
          provider: "kubernetes",
          namespace: d.namespace,
          deploymentName: d.name,
          environment: d.namespace.includes("prod") ? "production" : 
                       d.namespace.includes("staging") ? "staging" : "development",
        });
      });
    
    // Add Vercel projects
    vercelProjects
      .filter(p => selectedVercel.has(p.id))
      .forEach(p => {
        deployments.push({
          provider: "vercel",
          vercelProjectId: p.id,
          vercelProjectName: p.name,
          environment: "production",
        });
      });
    
    return deployments;
  };

  const handleSubmit = () => {
    if (!appName.trim()) return;
    
    const repos = getAllSelectedRepos();
    if (repos.length === 0) return;
    
    createAppMutation.mutate({
      name: appName.trim(),
      slug: appSlug.trim() || undefined,
      description: appDescription.trim() || undefined,
      type: appType,
      repositories: repos,
      deployments: getAllSelectedDeployments(),
    });
  };

  const toggleGitea = (id: string) => {
    const newSet = new Set(selectedGitea);
    if (newSet.has(id)) {
      newSet.delete(id);
      if (primaryRepo === `gitea:${id}`) setPrimaryRepo("");
    } else {
      newSet.add(id);
    }
    setSelectedGitea(newSet);
  };

  const toggleGithub = (id: string) => {
    const newSet = new Set(selectedGithub);
    if (newSet.has(id)) {
      newSet.delete(id);
      if (primaryRepo === `github:${id}`) setPrimaryRepo("");
    } else {
      newSet.add(id);
    }
    setSelectedGithub(newSet);
  };

  const toggleK8s = (key: string) => {
    const newSet = new Set(selectedK8s);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedK8s(newSet);
  };

  const toggleVercel = (id: string) => {
    const newSet = new Set(selectedVercel);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedVercel(newSet);
  };

  const totalSelected = selectedGitea.size + selectedGithub.size + selectedK8s.size + selectedVercel.size;
  const reposSelected = selectedGitea.size + selectedGithub.size;

  // Generate available primary repo options
  const primaryRepoOptions = [
    ...Array.from(selectedGitea).map(id => {
      const repo = giteaRepos.find(r => String(r.id) === id);
      return repo ? { key: `gitea:${id}`, label: `Gitea: ${repo.name}` } : null;
    }),
    ...Array.from(selectedGithub).map(id => {
      const repo = githubRepos.find(r => String(r.id) === id);
      return repo ? { key: `github:${id}`, label: `GitHub: ${repo.name}` } : null;
    }),
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Application from Resources</DialogTitle>
          <DialogDescription>
            Link repositories and deployments to create a new application.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="details" className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="details">App Details</TabsTrigger>
              <TabsTrigger value="repositories">
                Repositories {reposSelected > 0 && <Badge className="ml-2">{reposSelected}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="deployments">
                Deployments {(selectedK8s.size + selectedVercel.size) > 0 && (
                  <Badge className="ml-2">{selectedK8s.size + selectedVercel.size}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* App Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="app-name">Application Name *</Label>
                  <Input
                    id="app-name"
                    placeholder="My Application"
                    value={appName}
                    onChange={(e) => {
                      setAppName(e.target.value);
                      if (!appSlug) {
                        setAppSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                      }
                    }}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="app-slug">Slug</Label>
                  <Input
                    id="app-slug"
                    placeholder="my-application"
                    value={appSlug}
                    onChange={(e) => setAppSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="app-description">Description</Label>
                  <Input
                    id="app-description"
                    placeholder="A brief description of the application"
                    value={appDescription}
                    onChange={(e) => setAppDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="app-type">Application Type</Label>
                  <Select value={appType} onValueChange={(v) => setAppType(v as typeof appType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web">Web Application</SelectItem>
                      <SelectItem value="api">API Service</SelectItem>
                      <SelectItem value="worker">Background Worker</SelectItem>
                      <SelectItem value="cron">Cron Job</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {primaryRepoOptions.length > 1 && (
                  <div className="grid gap-2">
                    <Label htmlFor="primary-repo">Primary Repository</Label>
                    <Select value={primaryRepo} onValueChange={setPrimaryRepo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select primary repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {primaryRepoOptions.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The primary repository is the main source of truth for this application.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Repositories Tab */}
            <TabsContent value="repositories" className="h-[400px]">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  {/* Gitea Repos */}
                  {giteaRepos.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        Gitea Repositories
                      </h4>
                      <div className="space-y-2">
                        {giteaRepos.map((repo) => {
                          const id = String(repo.id);
                          const isSelected = selectedGitea.has(id);
                          return (
                            <div
                              key={id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                              }`}
                              onClick={() => toggleGitea(id)}
                            >
                              <Checkbox checked={isSelected} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{repo.name}</div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {repo.description || "No description"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {repo.language && (
                                  <Badge variant="outline">{repo.language}</Badge>
                                )}
                                {repo.private && (
                                  <Badge variant="secondary">Private</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* GitHub Repos */}
                  {githubRepos.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        GitHub Repositories
                      </h4>
                      <div className="space-y-2">
                        {githubRepos.map((repo) => {
                          const id = String(repo.id);
                          const isSelected = selectedGithub.has(id);
                          return (
                            <div
                              key={id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                              }`}
                              onClick={() => toggleGithub(id)}
                            >
                              <Checkbox checked={isSelected} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{repo.name}</div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {repo.description || "No description"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {repo.language && (
                                  <Badge variant="outline">{repo.language}</Badge>
                                )}
                                {repo.private && (
                                  <Badge variant="secondary">Private</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {giteaRepos.length === 0 && githubRepos.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No repositories available
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Deployments Tab */}
            <TabsContent value="deployments" className="h-[400px]">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  {/* K8s Deployments */}
                  {k8sDeployments.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Kubernetes Deployments
                      </h4>
                      <div className="space-y-2">
                        {k8sDeployments.map((deploy) => {
                          const key = `${deploy.namespace}/${deploy.name}`;
                          const isSelected = selectedK8s.has(key);
                          return (
                            <div
                              key={key}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                              }`}
                              onClick={() => toggleK8s(key)}
                            >
                              <Checkbox checked={isSelected} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{deploy.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  Namespace: {deploy.namespace}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {deploy.readyReplicas || 0}/{deploy.replicas || 0}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Vercel Projects */}
                  {vercelProjects.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Triangle className="h-4 w-4" />
                        Vercel Projects
                      </h4>
                      <div className="space-y-2">
                        {vercelProjects.map((project) => {
                          const isSelected = selectedVercel.has(project.id);
                          return (
                            <div
                              key={project.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                              }`}
                              onClick={() => toggleVercel(project.id)}
                            >
                              <Checkbox checked={isSelected} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{project.name}</div>
                                {project.link?.repo && (
                                  <div className="text-sm text-muted-foreground truncate">
                                    {project.link.repo}
                                  </div>
                                )}
                              </div>
                              {project.framework && (
                                <Badge variant="outline">{project.framework}</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {k8sDeployments.length === 0 && vercelProjects.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No deployments available
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {totalSelected} resource{totalSelected !== 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!appName.trim() || reposSelected === 0 || createAppMutation.isPending}
            >
              {createAppMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Application"
              )}
            </Button>
          </div>
        </DialogFooter>

        {createAppMutation.isError && (
          <div className="flex items-center gap-2 text-sm text-red-500 mt-2">
            <AlertCircle className="h-4 w-4" />
            {createAppMutation.error instanceof Error 
              ? createAppMutation.error.message 
              : "Failed to create application"}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
