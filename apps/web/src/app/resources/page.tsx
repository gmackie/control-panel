"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Server,
  Box,
  Network,
  GitBranch,
  Container,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Globe2,
  Database,
  Triangle,
  Github,
  Rocket,
  Plus,
} from "lucide-react";
import { LinkResourcesDialog } from "@/components/applications/link-resources-dialog";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const statusLower = status?.toLowerCase() || "";
  const variant = 
    statusLower === "running" || statusLower === "ready" ? "success" : 
    statusLower === "pending" ? "warning" : 
    statusLower.includes("error") || statusLower.includes("fail") ? "error" : 
    "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

// Fetch functions
async function fetchK8sResource(resource: string) {
  const res = await fetch(`/api/resources/k8s?resource=${resource}`);
  if (!res.ok) throw new Error(`Failed to fetch ${resource}`);
  const json = await res.json();
  return json.data;
}

async function fetchGiteaResource(resource: string) {
  const res = await fetch(`/api/resources/gitea?resource=${resource}`);
  if (!res.ok) throw new Error(`Failed to fetch ${resource}`);
  const json = await res.json();
  return json.data;
}

async function fetchHarborResource(resource: string) {
  const res = await fetch(`/api/resources/harbor?resource=${resource}`);
  if (!res.ok) throw new Error(`Failed to fetch ${resource}`);
  const json = await res.json();
  return json.data;
}

async function fetchNeonResource(resource: string) {
  const res = await fetch(`/api/resources/neon?resource=${resource}`);
  if (!res.ok) throw new Error(`Failed to fetch ${resource}`);
  const json = await res.json();
  return json.data;
}

async function fetchVercelResource(resource: string) {
  const res = await fetch(`/api/resources/vercel?resource=${resource}`);
  if (!res.ok) throw new Error(`Failed to fetch ${resource}`);
  const json = await res.json();
  return json.data;
}

async function fetchGitHubResource(resource: string) {
  const res = await fetch(`/api/resources/github?resource=${resource}`);
  if (!res.ok) throw new Error(`Failed to fetch ${resource}`);
  const json = await res.json();
  return json.data;
}

export default function ResourcesPage() {
  // Dialog state
  const [showCreateAppDialog, setShowCreateAppDialog] = useState(false);

  // K8s queries
  const { data: pods, isLoading: podsLoading, error: podsError, refetch: refetchPods } = useQuery({
    queryKey: ["k8s", "pods"],
    queryFn: () => fetchK8sResource("pods"),
  });

  const { data: deployments, isLoading: deploymentsLoading, error: deploymentsError, refetch: refetchDeployments } = useQuery({
    queryKey: ["k8s", "deployments"],
    queryFn: () => fetchK8sResource("deployments"),
  });

  const { data: services, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useQuery({
    queryKey: ["k8s", "services"],
    queryFn: () => fetchK8sResource("services"),
  });

  const { data: nodes, isLoading: nodesLoading, refetch: refetchNodes } = useQuery({
    queryKey: ["k8s", "nodes"],
    queryFn: () => fetchK8sResource("nodes"),
  });

  const { data: ingresses, isLoading: ingressesLoading, error: ingressesError, refetch: refetchIngresses } = useQuery({
    queryKey: ["k8s", "ingresses"],
    queryFn: () => fetchK8sResource("ingresses"),
  });

  const { data: clusterInfo, refetch: refetchClusterInfo } = useQuery({
    queryKey: ["k8s", "info"],
    queryFn: () => fetchK8sResource("info"),
  });

  // Gitea queries
  const { data: repositories, isLoading: reposLoading, error: reposError, refetch: refetchRepos } = useQuery({
    queryKey: ["gitea", "repositories"],
    queryFn: () => fetchGiteaResource("repositories"),
  });

  // Harbor queries
  const { data: harborRepos, isLoading: harborLoading, error: harborError, refetch: refetchHarbor } = useQuery({
    queryKey: ["harbor", "repositories"],
    queryFn: () => fetchHarborResource("repositories"),
  });

  const { data: harborStats, refetch: refetchHarborStats } = useQuery({
    queryKey: ["harbor", "stats"],
    queryFn: () => fetchHarborResource("stats"),
  });

  // Neon queries
  const { data: neonProjects, isLoading: neonLoading, error: neonError, refetch: refetchNeon } = useQuery({
    queryKey: ["neon", "projects"],
    queryFn: () => fetchNeonResource("projects"),
  });

  const { data: neonStats, refetch: refetchNeonStats } = useQuery({
    queryKey: ["neon", "stats"],
    queryFn: () => fetchNeonResource("stats"),
  });

  // Vercel queries
  const { data: vercelProjects, isLoading: vercelLoading, error: vercelError, refetch: refetchVercel } = useQuery({
    queryKey: ["vercel", "projects"],
    queryFn: () => fetchVercelResource("projects"),
  });

  const { data: vercelDeployments, refetch: refetchVercelDeployments } = useQuery({
    queryKey: ["vercel", "deployments"],
    queryFn: () => fetchVercelResource("deployments"),
  });

  // GitHub queries
  const { data: githubRepos, isLoading: githubLoading, error: githubError, refetch: refetchGitHub } = useQuery({
    queryKey: ["github", "repositories"],
    queryFn: () => fetchGitHubResource("repositories"),
  });

  const { data: githubWorkflows, refetch: refetchGitHubWorkflows } = useQuery({
    queryKey: ["github", "workflows"],
    queryFn: () => fetchGitHubResource("workflows"),
  });

  const refetchAll = () => {
    refetchPods();
    refetchDeployments();
    refetchServices();
    refetchNodes();
    refetchIngresses();
    refetchClusterInfo();
    refetchRepos();
    refetchHarbor();
    refetchHarborStats();
    refetchNeon();
    refetchNeonStats();
    refetchVercel();
    refetchVercelDeployments();
    refetchGitHub();
    refetchGitHubWorkflows();
  };

  const podsList = Array.isArray(pods) ? pods : [];
  const deploymentsList = Array.isArray(deployments) ? deployments : [];
  const servicesList = Array.isArray(services) ? services : [];
  const nodesList = Array.isArray(nodes) ? nodes : [];
  const ingressesList = Array.isArray(ingresses) ? ingresses : [];
  const reposList = Array.isArray(repositories) ? repositories : [];
  const imagesList = Array.isArray(harborRepos) ? harborRepos : [];
  const neonProjectsList = Array.isArray(neonProjects) ? neonProjects : [];
  const vercelProjectsList = Array.isArray(vercelProjects) ? vercelProjects : [];
  const vercelDeploymentsList = Array.isArray(vercelDeployments) ? vercelDeployments : [];
  const githubReposList = Array.isArray(githubRepos) ? githubRepos : [];
  const githubWorkflowsList = Array.isArray(githubWorkflows) ? githubWorkflows : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resources</h1>
          <p className="text-muted-foreground">
            View all infrastructure resources, databases, and authentication
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateAppDialog(true)} variant="default">
            <Plus className="h-4 w-4 mr-2" />
            Create App from Resources
          </Button>
          <Button onClick={refetchAll} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Link Resources Dialog */}
      <LinkResourcesDialog
        open={showCreateAppDialog}
        onOpenChange={setShowCreateAppDialog}
        giteaRepos={reposList}
        githubRepos={githubReposList}
        k8sDeployments={deploymentsList}
        vercelProjects={vercelProjectsList}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pods</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{podsList.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {podsList.filter((p: any) => p.status === "Running").length} running
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Deployments</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deploymentsList.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              across {new Set(deploymentsList.map((d: any) => d.namespace)).size} namespaces
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Repositories</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reposList.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Git repositories
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Images</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{imagesList.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Container images
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Databases</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{neonProjectsList.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Neon projects
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vercel</CardTitle>
            <Triangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vercelProjectsList.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {vercelDeploymentsList.length} recent deploys
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">GitHub</CardTitle>
            <Github className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{githubReposList.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              repositories
            </div>
          </CardContent>
        </Card>

      </div>

      <Tabs defaultValue="pods" className="w-full">
        <TabsList>
          <TabsTrigger value="pods" className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            Pods
          </TabsTrigger>
          <TabsTrigger value="deployments" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Deployments
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="nodes" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Nodes
          </TabsTrigger>
          <TabsTrigger value="ingresses" className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            Ingresses
          </TabsTrigger>
          <TabsTrigger value="repositories" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Repositories
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Container className="h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="neon" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Neon
          </TabsTrigger>
          <TabsTrigger value="vercel" className="flex items-center gap-2">
            <Triangle className="h-4 w-4" />
            Vercel
          </TabsTrigger>
          <TabsTrigger value="github" className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub
          </TabsTrigger>
        </TabsList>

        {/* Pods Tab */}
        <TabsContent value="pods">
          <Card>
            <CardHeader>
              <CardTitle>Kubernetes Pods</CardTitle>
            </CardHeader>
            <CardContent>
              {podsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : podsError ? (
                <div className="text-center py-8 text-red-500">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                  Failed to load pods: {(podsError as Error).message}
                </div>
              ) : podsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No pods found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Namespace</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ready</TableHead>
                      <TableHead>Restarts</TableHead>
                      <TableHead>Node</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {podsList.map((pod: any) => (
                      <TableRow key={`${pod.namespace}-${pod.name}`}>
                        <TableCell className="font-mono text-sm">{pod.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pod.namespace}</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={pod.status} />
                        </TableCell>
                        <TableCell>{pod.ready || "N/A"}</TableCell>
                        <TableCell>
                          {(pod.restarts || 0) > 0 ? (
                            <span className="text-yellow-500">{pod.restarts}</span>
                          ) : (
                            pod.restarts || 0
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{pod.node || "N/A"}</TableCell>
                        <TableCell className="text-muted-foreground">{pod.age || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <CardTitle>Kubernetes Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              {deploymentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : deploymentsError ? (
                <div className="text-center py-8 text-red-500">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                  Failed to load deployments: {(deploymentsError as Error).message}
                </div>
              ) : deploymentsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No deployments found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Namespace</TableHead>
                      <TableHead>Ready</TableHead>
                      <TableHead>Up-to-date</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deploymentsList.map((deployment: any) => (
                      <TableRow key={`${deployment.namespace}-${deployment.name}`}>
                        <TableCell className="font-mono text-sm">{deployment.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{deployment.namespace}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={deployment.readyReplicas === deployment.replicas ? "text-green-500" : "text-yellow-500"}>
                            {deployment.readyReplicas || 0}/{deployment.replicas || 0}
                          </span>
                        </TableCell>
                        <TableCell>{deployment.updatedReplicas || 0}</TableCell>
                        <TableCell>{deployment.availableReplicas || 0}</TableCell>
                        <TableCell className="text-muted-foreground">{deployment.age || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Kubernetes Services</CardTitle>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : servicesError ? (
                <div className="text-center py-8 text-red-500">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                  Failed to load services: {(servicesError as Error).message}
                </div>
              ) : servicesList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No services found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Namespace</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Cluster IP</TableHead>
                      <TableHead>Ports</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicesList.map((service: any) => (
                      <TableRow key={`${service.namespace}-${service.name}`}>
                        <TableCell className="font-mono text-sm">{service.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{service.namespace}</Badge>
                        </TableCell>
                        <TableCell>{service.type}</TableCell>
                        <TableCell className="font-mono text-sm">{service.clusterIP || "None"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {typeof service.ports === 'string' 
                            ? service.ports 
                            : service.ports?.map((p: any) => `${p.port}${p.targetPort ? `:${p.targetPort}` : ""}`).join(", ") || "N/A"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{service.age || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nodes Tab */}
        <TabsContent value="nodes">
          <Card>
            <CardHeader>
              <CardTitle>Kubernetes Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              {nodesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : nodesList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No nodes found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Internal IP</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nodesList.map((node: any) => (
                      <TableRow key={node.name}>
                        <TableCell className="font-mono text-sm">{node.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={node.status} />
                        </TableCell>
                        <TableCell>{node.roles?.join(", ") || "worker"}</TableCell>
                        <TableCell className="text-muted-foreground">{node.version || "N/A"}</TableCell>
                        <TableCell className="font-mono text-sm">{node.internalIP || "N/A"}</TableCell>
                        <TableCell className="text-muted-foreground">{node.age || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ingresses Tab */}
        <TabsContent value="ingresses">
          <Card>
            <CardHeader>
              <CardTitle>Kubernetes Ingresses</CardTitle>
            </CardHeader>
            <CardContent>
              {ingressesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : ingressesError ? (
                <div className="text-center py-8 text-red-500">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                  Failed to load ingresses: {(ingressesError as Error).message}
                </div>
              ) : ingressesList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No ingresses found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Namespace</TableHead>
                      <TableHead>Hosts</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Ports</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingressesList.map((ingress: any) => (
                      <TableRow key={`${ingress.namespace}-${ingress.name}`}>
                        <TableCell className="font-mono text-sm">{ingress.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ingress.namespace}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {ingress.hosts?.map((host: string) => (
                              <a 
                                key={host} 
                                href={`https://${host}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-sm"
                              >
                                {host}
                              </a>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{ingress.address || "Pending"}</TableCell>
                        <TableCell>{ingress.ports}</TableCell>
                        <TableCell>
                          {ingress.className && <Badge variant="secondary">{ingress.className}</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{ingress.age || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Repositories Tab */}
        <TabsContent value="repositories">
          <Card>
            <CardHeader>
              <CardTitle>Git Repositories</CardTitle>
            </CardHeader>
            <CardContent>
              {reposLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : reposError ? (
                <div className="text-center py-8 text-red-500">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                  Failed to load repositories: {(reposError as Error).message}
                </div>
              ) : reposList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No repositories found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Default Branch</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reposList.map((repo: any) => (
                      <TableRow key={repo.id || repo.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{repo.name || repo.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[300px] truncate">
                          {repo.description || "No description"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{repo.default_branch || repo.defaultBranch || "main"}</Badge>
                        </TableCell>
                        <TableCell>
                          {repo.private ? (
                            <Badge variant="secondary">Private</Badge>
                          ) : (
                            <Badge variant="outline">Public</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {repo.updated_at ? formatDate(repo.updated_at) : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={repo.html_url || repo.htmlUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images">
          <Card>
            <CardHeader>
              <CardTitle>Container Images</CardTitle>
            </CardHeader>
            <CardContent>
              {harborLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : harborError ? (
                <div className="text-center py-8 text-red-500">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                  Failed to load images: {(harborError as Error).message}
                </div>
              ) : imagesList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No images found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repository</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Pull Count</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imagesList.map((image: any) => (
                      <TableRow key={image.name || `${image.project}/${image.repository}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Container className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">
                              {image.name || `${image.project_id || image.project}/${image.repository || image.name}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(image.tags || []).slice(0, 3).map((tag: any) => (
                              <Badge key={typeof tag === 'string' ? tag : tag.name} variant="outline" className="font-mono text-xs">
                                {typeof tag === 'string' ? tag : tag.name}
                              </Badge>
                            ))}
                            {(image.tags?.length || 0) > 3 && (
                              <Badge variant="secondary">+{image.tags.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{image.pull_count || image.pullCount || 0}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {image.update_time || image.updated_at ? formatDate(image.update_time || image.updated_at) : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Neon Tab */}
        <TabsContent value="neon">
          <Card>
            <CardHeader>
              <CardTitle>Neon Databases</CardTitle>
            </CardHeader>
            <CardContent>
              {neonLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : neonError ? (
                <div className="text-center py-8 text-red-500">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                  Failed to load Neon projects: {(neonError as Error).message}
                </div>
              ) : neonProjectsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No Neon projects found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>PostgreSQL</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Compute Time</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {neonProjectsList.map((project: any) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{project.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{project.region_id}</Badge>
                        </TableCell>
                        <TableCell>v{project.pg_version}</TableCell>
                        <TableCell>{formatBytes(project.data_storage_bytes_hour || 0)}</TableCell>
                        <TableCell>{Math.round((project.compute_time_seconds || 0) / 3600 * 10) / 10}h</TableCell>
                        <TableCell className="text-muted-foreground">
                          {project.created_at ? formatDate(project.created_at) : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vercel Tab */}
        <TabsContent value="vercel">
          <div className="space-y-4">
            {/* Vercel Projects */}
            <Card>
              <CardHeader>
                <CardTitle>Vercel Projects</CardTitle>
              </CardHeader>
              <CardContent>
                {vercelLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : vercelError ? (
                  <div className="text-center py-8 text-red-500">
                    <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                    Failed to load Vercel projects: {(vercelError as Error).message}
                  </div>
                ) : vercelProjectsList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No Vercel projects found</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Framework</TableHead>
                        <TableHead>Repository</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vercelProjectsList.map((project: any) => (
                        <TableRow key={project.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Triangle className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{project.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {project.framework && <Badge variant="outline">{project.framework}</Badge>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {project.link?.repo || "N/A"}
                          </TableCell>
                          <TableCell>
                            {project.serverlessFunctionRegion && (
                              <Badge variant="secondary">{project.serverlessFunctionRegion}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {project.updatedAt ? formatDate(new Date(project.updatedAt).toISOString()) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`https://vercel.com/gmackie/${project.name}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Recent Deployments */}
            {vercelDeploymentsList.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Deployments</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vercelDeploymentsList.slice(0, 10).map((deploy: any) => (
                        <TableRow key={deploy.uid}>
                          <TableCell className="font-medium">{deploy.name}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                deploy.state === 'READY' ? 'success' : 
                                deploy.state === 'ERROR' ? 'error' : 
                                deploy.state === 'BUILDING' ? 'warning' : 
                                'secondary'
                              }
                            >
                              {deploy.state}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {deploy.target && <Badge variant="outline">{deploy.target}</Badge>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {deploy.meta?.githubCommitRef || "N/A"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {deploy.created ? formatDate(new Date(deploy.created).toISOString()) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`https://${deploy.url}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* GitHub Tab */}
        <TabsContent value="github">
          <div className="space-y-4">
            {/* GitHub Repositories */}
            <Card>
              <CardHeader>
                <CardTitle>GitHub Repositories</CardTitle>
              </CardHeader>
              <CardContent>
                {githubLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : githubError ? (
                  <div className="text-center py-8 text-red-500">
                    <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                    Failed to load GitHub repositories: {(githubError as Error).message}
                  </div>
                ) : githubReposList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No GitHub repositories found</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Repository</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Language</TableHead>
                        <TableHead>Stars</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {githubReposList.map((repo: any) => (
                        <TableRow key={repo.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Github className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{repo.name}</span>
                              {repo.private && <Badge variant="secondary">Private</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[300px] truncate">
                            {repo.description || "No description"}
                          </TableCell>
                          <TableCell>
                            {repo.language && <Badge variant="outline">{repo.language}</Badge>}
                          </TableCell>
                          <TableCell>{repo.stargazers_count || 0}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {repo.updated_at ? formatDate(repo.updated_at) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Recent Workflow Runs */}
            {githubWorkflowsList.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Workflow Runs</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workflow</TableHead>
                        <TableHead>Repository</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {githubWorkflowsList.slice(0, 10).map((run: any) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-medium">{run.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {run.repository?.name || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                run.conclusion === 'success' ? 'success' : 
                                run.conclusion === 'failure' ? 'error' : 
                                run.status === 'in_progress' ? 'warning' : 
                                'secondary'
                              }
                            >
                              {run.conclusion || run.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{run.head_branch}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {run.created_at ? formatDate(run.created_at) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={run.html_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
