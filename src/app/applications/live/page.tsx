"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch,
  Package,
  Server,
  ExternalLink,
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  Github,
  BarChart3,
  Layers,
  Clock,
  Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Application {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  
  gitea?: {
    owner: string;
    repo: string;
    url: string;
    defaultBranch: string;
    lastCommit?: {
      sha: string;
      message: string;
      author: string;
      date: string;
    };
    workflows?: Array<{
      id: number;
      name: string;
      status: string;
      conclusion?: string;
      url: string;
    }>;
  };

  github?: {
    url: string;
    fullName: string;
    lastPush?: string;
    stars: number;
    forks: number;
    syncStatus: 'synced' | 'gitea-ahead' | 'github-ahead' | 'unknown';
  };
  
  kubernetes?: {
    namespace: string;
    deploymentName: string;
    replicas: number;
    readyReplicas: number;
    image: string;
    imageTag: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    pods: Array<{
      name: string;
      status: string;
      ready: boolean;
      restarts: number;
    }>;
    services: Array<{
      name: string;
      type: string;
      clusterIP: string;
      externalIP?: string;
      ports: string;
    }>;
    ingress?: {
      host: string;
      path: string;
      tls: boolean;
    };
  };
  
  registry?: {
    image: string;
    tags: string[];
    lastPushed?: string;
    size?: string;
  };

  metrics?: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    latency: number;
  };

  observability?: {
    grafanaDashboardUrl?: string;
    grafanaExploreUrl?: string;
    prometheusUrl?: string;
    logsUrl?: string;
  };
  
  linked: boolean;
  crossPublished: boolean;
  lastSynced: string;
}

interface RegistryResponse {
  applications: Application[];
  summary: {
    total: number;
    linked: number;
    unlinked: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    giteaOnly: number;
    k8sOnly: number;
  };
  mappings: any[];
  timestamp: string;
}

export default function LiveApplicationsPage() {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  
  const { data, isLoading, error, refetch, isFetching } = useQuery<RegistryResponse>({
    queryKey: ["applications-registry", filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('filter', filter);
      const response = await fetch(`/api/applications/registry?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch applications");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const applications = data?.applications || [];
  const summary = data?.summary;
  const app = selectedApp 
    ? applications.find(a => a.id === selectedApp)
    : applications[0];
  
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "healthy": return "success";
      case "degraded": return "warning";
      case "unhealthy": return "error";
      default: return "secondary";
    }
  };

  const getWorkflowStatus = (status: string, conclusion?: string) => {
    if (status === 'completed') {
      return conclusion === 'success' ? 'success' : 'failed';
    }
    return status === 'in_progress' ? 'running' : 'pending';
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Card className="p-12 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Failed to load applications</h3>
          <p className="text-gray-400 mb-4">{(error as Error).message}</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Live Applications</h1>
          <p className="text-gray-400">
            Real-time view of Gitea repos and Kubernetes deployments
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline"
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-xs text-gray-400">Total</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{summary.linked}</p>
            <p className="text-xs text-gray-400">Linked</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{summary.unlinked}</p>
            <p className="text-xs text-gray-400">Unlinked</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{summary.healthy}</p>
            <p className="text-xs text-gray-400">Healthy</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{summary.degraded}</p>
            <p className="text-xs text-gray-400">Degraded</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{summary.unhealthy}</p>
            <p className="text-xs text-gray-400">Unhealthy</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{summary.giteaOnly}</p>
            <p className="text-xs text-gray-400">Gitea Only</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-500">{summary.k8sOnly}</p>
            <p className="text-xs text-gray-400">K8s Only</p>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All Apps</TabsTrigger>
          <TabsTrigger value="linked">
            <LinkIcon className="h-3 w-3 mr-1" />
            Linked
          </TabsTrigger>
          <TabsTrigger value="unlinked">
            <Unlink className="h-3 w-3 mr-1" />
            Unlinked
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-800 rounded w-3/4"></div>
                <div className="h-4 bg-gray-800 rounded w-full"></div>
                <div className="h-4 bg-gray-800 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : applications.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Application List */}
          <div className="lg:col-span-1 space-y-3">
            {applications.map((application) => (
              <Card
                key={application.id}
                className={`p-4 cursor-pointer transition-colors hover:border-gray-600 ${
                  selectedApp === application.id || (!selectedApp && applications[0]?.id === application.id)
                    ? 'border-blue-500'
                    : ''
                }`}
                onClick={() => setSelectedApp(application.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      application.kubernetes?.status === 'healthy' ? 'bg-green-500' :
                      application.kubernetes?.status === 'degraded' ? 'bg-yellow-500' :
                      application.kubernetes?.status === 'unhealthy' ? 'bg-red-500' :
                      'bg-gray-500'
                    }`} />
                    <h3 className="font-medium">{application.displayName}</h3>
                  </div>
                  <div className="flex gap-1">
                    {application.linked && (
                      <Badge variant="success" className="text-xs">
                        <LinkIcon className="h-2 w-2 mr-1" />
                        Linked
                      </Badge>
                    )}
                    {application.crossPublished && (
                      <Badge variant="secondary" className="text-xs">
                        <Github className="h-2 w-2 mr-1" />
                        GitHub
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3 text-xs text-gray-400">
                  {application.gitea && (
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      Gitea
                    </span>
                  )}
                  {application.kubernetes && (
                    <span className="flex items-center gap-1">
                      <Server className="h-3 w-3" />
                      K8s
                    </span>
                  )}
                  {application.registry && (
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Registry
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Application Details */}
          <div className="lg:col-span-2">
            {app ? (
              <Card className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      {app.displayName}
                      {app.kubernetes && (
                        <Badge variant={getStatusBadge(app.kubernetes.status) as any}>
                          {app.kubernetes.status}
                        </Badge>
                      )}
                    </h2>
                    {app.description && (
                      <p className="text-gray-400 mt-1">{app.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {app.observability?.grafanaDashboardUrl && (
                      <a 
                        href={app.observability.grafanaDashboardUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-gray-700 bg-transparent hover:bg-gray-800 transition-colors"
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Grafana
                      </a>
                    )}
                    {app.observability?.prometheusUrl && (
                      <a 
                        href={app.observability.prometheusUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-gray-700 bg-transparent hover:bg-gray-800 transition-colors"
                      >
                        <Activity className="h-4 w-4 mr-1" />
                        Prometheus
                      </a>
                    )}
                  </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="gitea" disabled={!app.gitea}>Gitea</TabsTrigger>
                    <TabsTrigger value="kubernetes" disabled={!app.kubernetes}>Kubernetes</TabsTrigger>
                    {app.metrics && <TabsTrigger value="metrics">Metrics</TabsTrigger>}
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Gitea Summary */}
                      {app.gitea && (
                        <Card className="p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <GitBranch className="h-4 w-4" />
                            Repository
                          </h4>
                          <div className="space-y-2 text-sm">
                            <a
                              href={app.gitea.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {app.gitea.owner}/{app.gitea.repo}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {app.gitea.lastCommit && (
                              <div className="p-2 bg-gray-900 rounded mt-2">
                                <code className="text-xs text-gray-300">
                                  {app.gitea.lastCommit.sha.substring(0, 7)}
                                </code>
                                <p className="text-gray-400 truncate mt-1">
                                  {app.gitea.lastCommit.message}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {app.gitea.lastCommit.author} - {formatDistanceToNow(new Date(app.gitea.lastCommit.date))} ago
                                </p>
                              </div>
                            )}
                          </div>
                        </Card>
                      )}

                      {/* K8s Summary */}
                      {app.kubernetes && (
                        <Card className="p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            Deployment
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Namespace:</span>
                              <span>{app.kubernetes.namespace}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Replicas:</span>
                              <span>{app.kubernetes.readyReplicas}/{app.kubernetes.replicas}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Image:</span>
                              <code className="text-xs">{app.kubernetes.imageTag}</code>
                            </div>
                          </div>
                        </Card>
                      )}

                      {/* GitHub Cross-Publish */}
                      {app.github && (
                        <Card className="p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Github className="h-4 w-4" />
                            GitHub Mirror
                          </h4>
                          <div className="space-y-2 text-sm">
                            <a
                              href={app.github.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {app.github.fullName}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <div className="flex gap-4 text-gray-400">
                              <span>{app.github.stars} stars</span>
                              <span>{app.github.forks} forks</span>
                            </div>
                            <Badge variant={
                              app.github.syncStatus === 'synced' ? 'success' :
                              app.github.syncStatus === 'gitea-ahead' ? 'warning' :
                              app.github.syncStatus === 'github-ahead' ? 'warning' :
                              'secondary'
                            }>
                              {app.github.syncStatus}
                            </Badge>
                          </div>
                        </Card>
                      )}

                      {/* CI/CD Status */}
                      {app.gitea?.workflows && app.gitea.workflows.length > 0 && (
                        <Card className="p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            CI/CD
                          </h4>
                          <div className="space-y-2">
                            {app.gitea.workflows.slice(0, 3).map((workflow) => (
                              <div key={workflow.id} className="flex items-center justify-between text-sm">
                                <span className="truncate">{workflow.name}</span>
                                <Badge variant={
                                  getWorkflowStatus(workflow.status, workflow.conclusion) === 'success' ? 'success' :
                                  getWorkflowStatus(workflow.status, workflow.conclusion) === 'failed' ? 'error' :
                                  getWorkflowStatus(workflow.status, workflow.conclusion) === 'running' ? 'default' :
                                  'secondary'
                                } className="text-xs">
                                  {getWorkflowStatus(workflow.status, workflow.conclusion)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="gitea" className="space-y-4">
                    {app.gitea && (
                      <>
                        <Card className="p-4">
                          <h4 className="font-medium mb-3">Repository Details</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">Owner:</span>
                              <p>{app.gitea.owner}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">Repository:</span>
                              <p>{app.gitea.repo}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">Default Branch:</span>
                              <p>{app.gitea.defaultBranch}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">URL:</span>
                              <a
                                href={app.gitea.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1"
                              >
                                Open in Gitea
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </Card>

                        {app.gitea.workflows && app.gitea.workflows.length > 0 && (
                          <Card className="p-4">
                            <h4 className="font-medium mb-3">Workflow Runs</h4>
                            <div className="space-y-2">
                              {app.gitea.workflows.map((workflow) => (
                                <div key={workflow.id} className="p-2 bg-gray-900 rounded flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{workflow.name}</p>
                                    <p className="text-xs text-gray-500">#{workflow.id}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={
                                      getWorkflowStatus(workflow.status, workflow.conclusion) === 'success' ? 'success' :
                                      getWorkflowStatus(workflow.status, workflow.conclusion) === 'failed' ? 'error' :
                                      getWorkflowStatus(workflow.status, workflow.conclusion) === 'running' ? 'default' :
                                      'secondary'
                                    }>
                                      {getWorkflowStatus(workflow.status, workflow.conclusion)}
                                    </Badge>
                                    <a
                                      href={workflow.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:underline"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="kubernetes" className="space-y-4">
                    {app.kubernetes && (
                      <>
                        <Card className="p-4">
                          <h4 className="font-medium mb-3">Deployment Details</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">Namespace:</span>
                              <p>{app.kubernetes.namespace}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">Deployment:</span>
                              <p>{app.kubernetes.deploymentName}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">Replicas:</span>
                              <p>{app.kubernetes.readyReplicas}/{app.kubernetes.replicas} ready</p>
                            </div>
                            <div>
                              <span className="text-gray-400">Status:</span>
                              <Badge variant={getStatusBadge(app.kubernetes.status) as any}>
                                {app.kubernetes.status}
                              </Badge>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-400">Image:</span>
                              <p className="font-mono text-xs break-all">
                                {app.kubernetes.image}:{app.kubernetes.imageTag}
                              </p>
                            </div>
                          </div>
                        </Card>

                        {app.kubernetes.pods.length > 0 && (
                          <Card className="p-4">
                            <h4 className="font-medium mb-3">Pods</h4>
                            <div className="space-y-2">
                              {app.kubernetes.pods.map((pod) => (
                                <div key={pod.name} className="p-2 bg-gray-900 rounded flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {pod.ready ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                                    )}
                                    <span className="font-mono text-sm">{pod.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm">
                                    <Badge variant={pod.status === 'Running' ? 'success' : 'warning'}>
                                      {pod.status}
                                    </Badge>
                                    {pod.restarts > 0 && (
                                      <span className="text-yellow-500">{pod.restarts} restarts</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        )}

                        {app.kubernetes.services.length > 0 && (
                          <Card className="p-4">
                            <h4 className="font-medium mb-3">Services</h4>
                            <div className="space-y-2">
                              {app.kubernetes.services.map((svc) => (
                                <div key={svc.name} className="p-2 bg-gray-900 rounded">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{svc.name}</span>
                                    <Badge variant="secondary">{svc.type}</Badge>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {svc.clusterIP} | {svc.ports}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {app.metrics && (
                    <TabsContent value="metrics" className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold">{app.metrics.cpu.toFixed(1)}%</p>
                          <p className="text-xs text-gray-400">CPU</p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold">{app.metrics.memory.toFixed(1)}%</p>
                          <p className="text-xs text-gray-400">Memory</p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold">{app.metrics.requests}</p>
                          <p className="text-xs text-gray-400">Requests/s</p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold text-red-500">{app.metrics.errors}</p>
                          <p className="text-xs text-gray-400">Errors/s</p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold">{app.metrics.latency}ms</p>
                          <p className="text-xs text-gray-400">Latency</p>
                        </Card>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>

                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last synced: {formatDistanceToNow(new Date(app.lastSynced))} ago
                  </span>
                  <span>ID: {app.id}</span>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <Layers className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select an application</h3>
                <p className="text-gray-400">
                  Choose an application from the list to view details
                </p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Layers className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No applications found</h3>
          <p className="text-gray-400 mb-6">
            No applications were discovered from Gitea or Kubernetes
          </p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </Card>
      )}

      {/* Timestamp */}
      {data?.timestamp && (
        <p className="text-xs text-gray-500 text-center">
          Data fetched at {new Date(data.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
