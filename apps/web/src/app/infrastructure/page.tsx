"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Server,
  GitBranch,
  Plus,
  Activity,
  DollarSign,
  RefreshCw,
  Heart,
  TrendingUp,
  ExternalLink,
  Package,
  Globe,
  Box,
  Cloud,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
} from "lucide-react";
import { ClusterOverview } from "@/components/cluster/ClusterOverview";
import { NodeCard } from "@/components/cluster/NodeCard";
import { AddNodeModal } from "@/components/cluster/AddNodeModal";
import { AutoscalingPanel } from "@/components/cluster/AutoscalingPanel";
import { HealthDashboard } from "@/components/cluster/HealthDashboard";
import { CostDashboard } from "@/components/cluster/CostDashboard";
import { formatDistanceToNow } from "date-fns";

interface VPSServer {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  type: 'gitea' | 'cluster-node' | 'standalone';
  provider: 'hetzner';
  location: string;
  specs: {
    cpu: string;
    memory: string;
    disk: string;
  };
  services: Array<{
    name: string;
    status: 'running' | 'stopped' | 'unknown';
    port?: number;
  }>;
  uptime?: string;
  lastChecked: string;
  responseTime: number;
  monthlyPrice: number;
}

export default function InfrastructurePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddNode, setShowAddNode] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: vpsData, isLoading: vpsLoading, refetch: refetchVps } = useQuery({
    queryKey: ['infrastructure', 'vps'],
    queryFn: async () => {
      const response = await fetch('/api/infrastructure/vps');
      if (!response.ok) throw new Error('Failed to fetch VPS data');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const { data: clusterData, isLoading: clusterLoading, refetch: refetchCluster } = useQuery({
    queryKey: ['cluster'],
    queryFn: async () => {
      const response = await fetch('/api/cluster');
      if (!response.ok) throw new Error('Failed to fetch cluster info');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: k8sResources, isLoading: resourcesLoading, refetch: refetchResources } = useQuery({
    queryKey: ['k8s-resources'],
    queryFn: async () => {
      const response = await fetch('/api/k8s/deployments');
      if (!response.ok) throw new Error('Failed to fetch K8s resources');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const removeNodeMutation = useMutation({
    mutationFn: async (nodeName: string) => {
      const response = await fetch(`/api/cluster/nodes?name=${nodeName}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove node');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cluster'] }),
  });

  const powerActionMutation = useMutation({
    mutationFn: async ({ nodeName, action }: { nodeName: string; action: string }) => {
      const response = await fetch('/api/cluster/nodes/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeName, action }),
      });
      if (!response.ok) throw new Error('Failed to perform power action');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cluster'] }),
  });

  const handleRefreshAll = () => {
    refetchVps();
    refetchCluster();
    refetchResources();
  };

  const { cluster, stats } = clusterData || { cluster: { nodes: [] }, stats: {} };
  const servers: VPSServer[] = vpsData?.servers || [];
  const vpsSummary = vpsData?.summary || { total: 0, online: 0, totalMonthlyCost: 0 };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'running':
        return 'success';
      case 'offline':
      case 'stopped':
        return 'destructive';
      case 'degraded':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const totalMonthlyCost = vpsSummary.totalMonthlyCost || 0;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Infrastructure</h1>
          <p className="text-gray-400">
            Manage VPS servers and K3s cluster
          </p>
        </div>
        <Button onClick={handleRefreshAll} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">VPS Servers</span>
            <Cloud className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{vpsSummary.online}/{vpsSummary.total}</p>
          <p className="text-xs text-gray-500">online</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Cluster Nodes</span>
            <Server className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{cluster.nodes?.length || 0}</p>
          <p className="text-xs text-gray-500">K3s nodes</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Deployments</span>
            <Package className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{k8sResources?.deployments?.length || 0}</p>
          <p className="text-xs text-gray-500">running</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Monthly Cost</span>
            <DollarSign className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">${totalMonthlyCost.toFixed(2)}</p>
          <p className="text-xs text-gray-500">estimated</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="vps" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            VPS Servers
          </TabsTrigger>
          <TabsTrigger value="cluster" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            K3s Cluster
          </TabsTrigger>
          <TabsTrigger value="deployments" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Deployments
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Costs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-500" />
                  Hetzner VPS Servers
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("vps")}>
                  View All
                </Button>
              </div>
              <div className="space-y-3">
                {vpsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : servers.length > 0 ? (
                  servers.map((server) => (
                    <div key={server.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        {server.type === 'gitea' ? (
                          <GitBranch className="h-5 w-5 text-orange-500" />
                        ) : server.type === 'cluster-node' ? (
                          <Server className="h-5 w-5 text-green-500" />
                        ) : (
                          <Cloud className="h-5 w-5 text-blue-500" />
                        )}
                        <div>
                          <p className="font-medium">{server.name}</p>
                          <p className="text-xs text-gray-500">{server.hostname}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{server.responseTime}ms</span>
                        <Badge variant={getStatusColor(server.status) as any}>
                          {server.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No VPS servers found</p>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Server className="h-5 w-5 text-green-500" />
                  K3s Cluster
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("cluster")}>
                  View All
                </Button>
              </div>
              {clusterLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : cluster.nodes?.length > 0 ? (
                <div className="space-y-3">
                  {cluster.nodes.slice(0, 3).map((node: any) => (
                    <div key={node.name} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">{node.name}</p>
                          <p className="text-xs text-gray-500">{node.roles?.join(', ') || 'worker'}</p>
                        </div>
                      </div>
                      <Badge variant={node.status === 'Ready' ? 'success' : 'destructive'}>
                        {node.status}
                      </Badge>
                    </div>
                  ))}
                  {stats && (
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-800">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-400">{stats.cpuUsage || 0}%</p>
                        <p className="text-xs text-gray-500">CPU</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-400">{stats.memoryUsage || 0}%</p>
                        <p className="text-xs text-gray-500">Memory</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-400">{stats.podCount || 0}</p>
                        <p className="text-xs text-gray-500">Pods</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No cluster nodes found</p>
                  <Button size="sm" className="mt-3" onClick={() => setShowAddNode(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Node
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vps" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-500" />
              Hetzner VPS Servers
            </h3>
            <Button variant="outline" size="sm" onClick={() => refetchVps()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {vpsLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {servers.map((server) => (
                <Card key={server.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {server.type === 'gitea' ? (
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <GitBranch className="h-6 w-6 text-orange-500" />
                        </div>
                      ) : server.type === 'cluster-node' ? (
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <Server className="h-6 w-6 text-green-500" />
                        </div>
                      ) : (
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Cloud className="h-6 w-6 text-blue-500" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold">{server.name}</h4>
                        <p className="text-sm text-gray-500">{server.hostname}</p>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(server.status) as any}>
                      {server.status}
                    </Badge>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Network className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-400">IP:</span>
                      <span className="font-mono">{server.ip}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-400">Location:</span>
                      <span>{server.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-400">Response:</span>
                      <span>{server.responseTime}ms</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-gray-900 rounded-lg mb-4">
                    <div className="text-center">
                      <Cpu className="h-4 w-4 mx-auto text-blue-400 mb-1" />
                      <p className="text-xs text-gray-500">{server.specs.cpu}</p>
                    </div>
                    <div className="text-center">
                      <MemoryStick className="h-4 w-4 mx-auto text-green-400 mb-1" />
                      <p className="text-xs text-gray-500">{server.specs.memory}</p>
                    </div>
                    <div className="text-center">
                      <HardDrive className="h-4 w-4 mx-auto text-purple-400 mb-1" />
                      <p className="text-xs text-gray-500">{server.specs.disk}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Services</p>
                    <div className="flex flex-wrap gap-1">
                      {server.services.map((service, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {service.name}
                          {service.port && <span className="ml-1 text-gray-500">:{service.port}</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <span className="text-sm text-gray-500">
                      ${server.monthlyPrice}/mo
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`https://${server.hostname}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open
                      </a>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cluster" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">K3s Cluster</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchCluster()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowAddNode(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Node
              </Button>
            </div>
          </div>

          {stats && <ClusterOverview stats={stats} />}

          <Tabs defaultValue="nodes" className="space-y-4">
            <TabsList>
              <TabsTrigger value="nodes" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                Nodes
              </TabsTrigger>
              <TabsTrigger value="health" className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Health
              </TabsTrigger>
              <TabsTrigger value="autoscaling" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Autoscaling
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nodes" className="space-y-4">
              {clusterLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : cluster.nodes?.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {cluster.nodes.map((node: any) => (
                    <NodeCard
                      key={node.name}
                      node={node}
                      onRemove={(name) => {
                        if (confirm(`Remove node ${name}?`)) {
                          removeNodeMutation.mutate(name);
                        }
                      }}
                      onPowerAction={(name, action) => {
                        if (confirm(`${action} node ${name}?`)) {
                          powerActionMutation.mutate({ nodeName: name, action });
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Server className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No nodes found</h3>
                  <p className="text-gray-400 mb-4">Add your first node to get started</p>
                  <Button onClick={() => setShowAddNode(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Node
                  </Button>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="health">
              <HealthDashboard />
            </TabsContent>

            <TabsContent value="autoscaling">
              <AutoscalingPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold">Deployments</h3>
              <Badge variant="secondary">{k8sResources?.deployments?.length || 0} total</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchResources()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {resourcesLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : k8sResources?.deployments?.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {k8sResources.deployments.map((dep: any) => (
                <Card key={`${dep.namespace}/${dep.name}`} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{dep.name}</h4>
                      <Badge variant="outline" className="mt-1">{dep.namespace}</Badge>
                    </div>
                    <Badge variant={dep.readyReplicas === dep.replicas ? "success" : "warning"}>
                      {dep.readyReplicas}/{dep.replicas} ready
                    </Badge>
                  </div>
                  
                  {dep.ingress && (
                    <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
                      <Globe className="h-3 w-3" />
                      <a 
                        href={`https://${dep.ingress.host}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {dep.ingress.host}
                      </a>
                    </div>
                  )}
                  
                  {dep.image && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                      <Box className="h-3 w-3" />
                      <span className="truncate">{dep.image}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No deployments found</h3>
              <p className="text-gray-400">No deployments are running in this cluster</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="costs">
          <CostDashboard />
        </TabsContent>
      </Tabs>

      {showAddNode && (
        <AddNodeModal
          onClose={() => setShowAddNode(false)}
          onSuccess={() => {
            setShowAddNode(false);
            refetchCluster();
          }}
        />
      )}
    </div>
  );
}
