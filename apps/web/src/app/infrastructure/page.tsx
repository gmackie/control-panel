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
  Shield,
  Layers,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Container,
  Route,
  Workflow,
  Zap,
  Database,
  MessageSquare,
  Bell,
  Radio,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Image,
  Disc,
} from "lucide-react";
import { ClusterOverview } from "@/components/cluster/ClusterOverview";
import { NodeCard } from "@/components/cluster/NodeCard";
import { AddNodeModal } from "@/components/cluster/AddNodeModal";
import { AutoscalingPanel } from "@/components/cluster/AutoscalingPanel";
import { HealthDashboard } from "@/components/cluster/HealthDashboard";
import { PodHealthTable } from "@/components/cluster/PodHealthTable";
import { CostDashboard } from "@/components/cluster/CostDashboard";
import { formatDistanceToNow } from "date-fns";

interface SystemMetrics {
  cpu: { usage: number; cores: number; loadAvg: [number, number, number] };
  memory: { total: number; used: number; available: number; usagePercent: number };
  disk: { total: number; used: number; available: number; usagePercent: number };
  uptime: string;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  memory?: string;
  pid?: number;
  description?: string;
}

interface NginxSite {
  name: string;
  enabled: boolean;
  serverNames: string[];
  listenPorts: number[];
  proxyPass?: string;
  sslEnabled: boolean;
  configFile: string;
}

interface ContainerStatus {
  name: string;
  status: 'running' | 'stopped' | 'unhealthy' | 'unknown';
  health?: string;
  uptime?: string;
  image?: string;
}

interface AppStatus {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
}

interface VPSServer {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  type: 'gitea' | 'cluster-node' | 'standalone';
  provider: 'hetzner';
  location: string;
  specs: { cpu: string; memory: string; disk: string };
  reachable: boolean;
  responseTime: number;
  monthlyPrice: number;
  systemMetrics?: SystemMetrics;
  services: ServiceStatus[];
  containers: ContainerStatus[];
  nginxSites?: NginxSite[];
  apps?: AppStatus[];
  error?: string;
}

interface K8sNamespaceSummary {
  name: string;
  podCount: number;
  runningPods: number;
  deploymentCount: number;
  serviceCount: number;
  ingressCount: number;
}

interface K8sPodSummary {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  node?: string;
  ip?: string;
}

interface K8sDeploymentSummary {
  name: string;
  namespace: string;
  replicas: string;
  ready: number;
  available: number;
  age: string;
  image?: string;
  ingress?: { host: string; tls: boolean };
}

interface K8sServiceSummary {
  name: string;
  namespace: string;
  type: string;
  ports: string;
  selector?: string;
}

interface K8sIngressSummary {
  name: string;
  namespace: string;
  hosts: string[];
  tls: boolean;
  paths: Array<{ path: string; service: string; port: number }>;
}

interface K8sResourcesData {
  namespaces: K8sNamespaceSummary[];
  pods: K8sPodSummary[];
  deployments: K8sDeploymentSummary[];
  services: K8sServiceSummary[];
  ingresses: K8sIngressSummary[];
  summary: {
    namespaces: number;
    pods: { total: number; running: number; pending: number; failed: number };
    deployments: { total: number; healthy: number };
    services: number;
    ingresses: number;
  };
}

// Hetzner Types
interface HetznerServer {
  id: number;
  name: string;
  status: string;
  publicIp?: string;
  type?: string;
  cores?: number;
  memory?: number;
  disk?: number;
  location?: string;
  datacenter?: string;
  labels?: Record<string, string>;
  created: string;
  monthlyPrice: number;
  project?: string;
}

interface HetznerVolume {
  id: number;
  name: string;
  size: number;
  status: string;
  server: number | null;
  location?: string;
  labels?: Record<string, string>;
  created: string;
  project?: string;
}

interface HetznerLoadBalancer {
  id: number;
  name: string;
  publicIp?: string;
  type?: string;
  location?: string;
  targets: number;
  services: number;
  healthyTargets: number;
  labels?: Record<string, string>;
  created: string;
}

interface HetznerFloatingIP {
  id: number;
  name: string;
  ip: string;
  type: string;
  server: number | null;
  location?: string;
  blocked: boolean;
  labels?: Record<string, string>;
  created: string;
}

interface HetznerNetwork {
  id: number;
  name: string;
  ipRange: string;
  subnets: number;
  servers: number;
  labels?: Record<string, string>;
  created: string;
}

interface HetznerSnapshot {
  id: number;
  description: string;
  diskSize: number;
  status: string;
  createdFrom?: string;
  labels?: Record<string, string>;
  created: string;
}

interface HetznerProject {
  id: string;
  name: string;
  serverCount: number;
}

interface HetznerResourcesData {
  servers: HetznerServer[];
  volumes: HetznerVolume[];
  loadBalancers: HetznerLoadBalancer[];
  floatingIPs: HetznerFloatingIP[];
  networks: HetznerNetwork[];
  snapshots: HetznerSnapshot[];
  projects?: HetznerProject[];
  costs: {
    totalMonthly: number;
    totalHourly: number;
    byResourceType: Record<string, number>;
    byLocation: Record<string, number>;
    byProject?: Record<string, number>;
    untagged: number;
    currency: string;
  };
  health: {
    healthy?: boolean;
    status?: string;
    issues: Array<{ type: string; message: string; project?: string }>;
  };
  summary: {
    projects?: number;
    servers: { total: number; running: number; stopped: number };
    volumes: { total: number; totalSizeGB: number; attached: number };
    loadBalancers: { total: number };
    floatingIPs: { total: number; assigned: number };
    networks: { total: number };
    snapshots: { total: number; totalSizeGB: number };
  };
  lastUpdated: string;
}

// AWS Types
interface AWSLambdaFunction {
  name: string;
  arn: string;
  runtime: string;
  memorySize: number;
  timeout: number;
  codeSize: number;
  state: string;
  lastModified: string;
  description: string;
  handler: string;
}

interface AWSS3Bucket {
  name: string;
  region: string;
  creationDate: string;
  sizeBytes?: number;
  objectCount?: number;
}

interface AWSSQSQueue {
  name: string;
  url: string;
  messagesAvailable: number;
  messagesInFlight: number;
  messagesDelayed: number;
  isFifo: boolean;
  visibilityTimeout: number;
  delaySeconds: number;
}

interface AWSSNSTopic {
  name: string;
  arn: string;
  displayName?: string;
  subscriptionCount: number;
}

interface AWSIoTThing {
  name: string;
  arn: string;
  typeName?: string;
  attributes: Record<string, string>;
}

interface AWSCloudWatchAlarm {
  name: string;
  arn: string;
  description?: string;
  state: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
  stateReason: string;
  metric: string;
  namespace: string;
  threshold: number;
  comparison: string;
  actionsEnabled: boolean;
}

interface AWSCostByService {
  service: string;
  cost: number;
  currency: string;
}

interface AWSResourcesData {
  lambda: AWSLambdaFunction[];
  s3: AWSS3Bucket[];
  sqs: AWSSQSQueue[];
  sns: AWSSNSTopic[];
  iot: AWSIoTThing[];
  alarms: AWSCloudWatchAlarm[];
  costs: {
    currentMonth: number;
    lastMonth: number;
    forecast: number;
    byService: AWSCostByService[];
    byApplication: Array<{ application: string; cost: number }>;
    currency: string;
  };
  summary: {
    lambda: { total: number; active: number; inactive: number };
    s3: { total: number };
    sqs: { total: number; fifo: number; standard: number; totalMessages: number };
    sns: { total: number; totalSubscriptions: number };
    iot: { total: number };
    alarms: { total: number; ok: number; alarm: number; insufficientData: number };
  };
  lastUpdated: string;
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

  const { data: k8sResources, isLoading: resourcesLoading, refetch: refetchResources } = useQuery<K8sResourcesData>({
    queryKey: ['k8s-resources'],
    queryFn: async () => {
      const response = await fetch('/api/k8s/resources');
      if (!response.ok) throw new Error('Failed to fetch K8s resources');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: hetznerData, isLoading: hetznerLoading, refetch: refetchHetzner } = useQuery<HetznerResourcesData>({
    queryKey: ['hetzner-resources'],
    queryFn: async () => {
      const response = await fetch('/api/infrastructure/hetzner');
      if (!response.ok) throw new Error('Failed to fetch Hetzner resources');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const { data: awsData, isLoading: awsLoading, refetch: refetchAws } = useQuery<AWSResourcesData>({
    queryKey: ['aws-resources'],
    queryFn: async () => {
      const response = await fetch('/api/infrastructure/aws');
      if (!response.ok) throw new Error('Failed to fetch AWS resources');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

  const toggleServerExpand = (serverId: string) => {
    setExpandedServers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serverId)) {
        newSet.delete(serverId);
      } else {
        newSet.add(serverId);
      }
      return newSet;
    });
  };

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
    refetchHetzner();
    refetchAws();
  };

  const { cluster, stats } = clusterData || { cluster: { nodes: [] }, stats: {} };
  const servers: VPSServer[] = vpsData?.servers || [];
  const vpsSummary = vpsData?.summary || { total: 0, online: 0, totalMonthlyCost: 0 };

  const getStatusColor = (status: string): 'success' | 'destructive' | 'warning' | 'secondary' => {
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" role="region" aria-label="Infrastructure statistics">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">VPS Servers</span>
            <Cloud className="h-4 w-4 text-blue-500" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold">{vpsSummary.online}/{vpsSummary.total}</p>
          <p className="text-xs text-gray-500">online</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Cluster Nodes</span>
            <Server className="h-4 w-4 text-green-500" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold">{cluster.nodes?.length || 0}</p>
          <p className="text-xs text-gray-500">K3s nodes</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Deployments</span>
            <Package className="h-4 w-4 text-purple-500" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold">{k8sResources?.deployments?.length || 0}</p>
          <p className="text-xs text-gray-500">running</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Monthly Cost</span>
            <DollarSign className="h-4 w-4 text-yellow-500" aria-hidden="true" />
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
          <TabsTrigger value="hetzner" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Hetzner
          </TabsTrigger>
          <TabsTrigger value="aws" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            AWS
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
                        <Badge variant={getStatusColor(server.status)}>
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
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-500" />
                Hetzner VPS Servers
              </h3>
              {vpsSummary.services && (
                <Badge variant="outline">
                  {vpsSummary.services.running}/{vpsSummary.services.total} services
                </Badge>
              )}
            </div>
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
            <div className="space-y-6">
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
                        <h4 className="font-semibold text-lg">{server.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{server.hostname}</span>
                          <span>•</span>
                          <span className="font-mono">{server.ip}</span>
                          <span>•</span>
                          <span>{server.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{server.responseTime}ms</span>
                      <Badge variant={getStatusColor(server.status)}>
                        {server.status}
                      </Badge>
                    </div>
                  </div>

                  {server.error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                      {server.error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-gray-400">CPU</span>
                      </div>
                      <p className="text-xl font-semibold">
                        {server.systemMetrics?.cpu.usage.toFixed(1) || '—'}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {server.specs.cpu} • Load: {server.systemMetrics?.cpu.loadAvg.map(l => l.toFixed(2)).join(', ') || '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MemoryStick className="h-4 w-4 text-green-400" />
                        <span className="text-sm text-gray-400">Memory</span>
                      </div>
                      <p className="text-xl font-semibold">
                        {server.systemMetrics?.memory.usagePercent || '—'}%
                      </p>
                      <p className="text-xs text-gray-500">{server.specs.memory}</p>
                    </div>
                    <div className="p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive className="h-4 w-4 text-purple-400" />
                        <span className="text-sm text-gray-400">Disk</span>
                      </div>
                      <p className="text-xl font-semibold">
                        {server.systemMetrics?.disk.usagePercent || '—'}%
                      </p>
                      <p className="text-xs text-gray-500">{server.specs.disk}</p>
                    </div>
                    <div className="p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm text-gray-400">Uptime</span>
                      </div>
                      <p className="text-sm font-medium">
                        {server.systemMetrics?.uptime || '—'}
                      </p>
                      <p className="text-xs text-gray-500">${server.monthlyPrice}/mo</p>
                    </div>
                  </div>

                  {server.apps && server.apps.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Applications</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {server.apps.map((app, idx) => (
                          <a 
                            key={idx}
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">{app.name}</span>
                            </div>
                            <Badge 
                              variant={app.status === 'healthy' ? 'success' : app.status === 'unhealthy' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {app.status}
                            </Badge>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {server.services.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">
                        Systemd Services ({server.services.filter(s => s.status === 'running').length}/{server.services.length} running)
                      </p>
                      <div className="space-y-1">
                        {server.services.map((service, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-gray-900 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Workflow className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">{service.name}</span>
                              {service.description && (
                                <span className="text-xs text-gray-500 hidden md:inline">— {service.description}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {service.memory && (
                                <span className="text-xs text-gray-500">{service.memory}</span>
                              )}
                              <Badge 
                                variant={service.status === 'running' ? 'success' : service.status === 'failed' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {service.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {server.nginxSites && server.nginxSites.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">
                        Nginx Sites ({server.nginxSites.length})
                      </p>
                      <div className="space-y-2">
                        {server.nginxSites.map((site, idx) => (
                          <div key={idx} className="p-3 bg-gray-900 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Route className="h-4 w-4 text-cyan-400" />
                                <span className="font-medium">{site.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {site.sslEnabled ? (
                                  <Badge variant="success" className="text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    SSL
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    <Unlock className="h-3 w-3 mr-1" />
                                    HTTP
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
                              {site.serverNames.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  <span>{site.serverNames.join(', ')}</span>
                                </div>
                              )}
                              {site.proxyPass && (
                                <div className="flex items-center gap-1">
                                  <Network className="h-3 w-3" />
                                  <span className="font-mono">{site.proxyPass}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {server.containers.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Docker Containers</p>
                      <div className="space-y-2">
                        {server.containers.map((container, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-gray-900 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Box className="h-4 w-4 text-blue-400" />
                              <span className="text-sm font-medium">{container.name}</span>
                              {container.uptime && (
                                <span className="text-xs text-gray-500">Up {container.uptime}</span>
                              )}
                            </div>
                            <Badge 
                              variant={container.status === 'running' ? 'success' : container.status === 'unhealthy' ? 'warning' : 'destructive'}
                              className="text-xs"
                            >
                              {container.health || container.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-4 border-t border-gray-800">
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
              <div className="mt-6">
                <PodHealthTable />
              </div>
            </TabsContent>

            <TabsContent value="autoscaling">
              <AutoscalingPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold">Kubernetes Resources</h3>
              {k8sResources?.summary && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{k8sResources.summary.namespaces} namespaces</Badge>
                  <Badge variant="outline">{k8sResources.summary.pods.running}/{k8sResources.summary.pods.total} pods</Badge>
                </div>
              )}
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
          ) : (
            <Tabs defaultValue="namespaces" className="space-y-4">
              <TabsList>
                <TabsTrigger value="namespaces" className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Namespaces
                </TabsTrigger>
                <TabsTrigger value="pods" className="flex items-center gap-2">
                  <Container className="h-4 w-4" />
                  Pods
                </TabsTrigger>
                <TabsTrigger value="deployments" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Deployments
                </TabsTrigger>
                <TabsTrigger value="services" className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Services
                </TabsTrigger>
                <TabsTrigger value="ingresses" className="flex items-center gap-2">
                  <Route className="h-4 w-4" />
                  Ingresses
                </TabsTrigger>
              </TabsList>

              <TabsContent value="namespaces" className="space-y-4">
                {k8sResources?.namespaces && k8sResources.namespaces.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {k8sResources.namespaces.map((ns) => (
                      <Card key={ns.name} className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers className="h-5 w-5 text-purple-400" />
                          <h4 className="font-semibold truncate">{ns.name}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center justify-between p-2 bg-gray-900 rounded">
                            <span className="text-gray-400">Pods</span>
                            <Badge variant={ns.runningPods === ns.podCount ? "success" : "warning"} className="text-xs">
                              {ns.runningPods}/{ns.podCount}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-gray-900 rounded">
                            <span className="text-gray-400">Deploy</span>
                            <span className="font-medium">{ns.deploymentCount}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-gray-900 rounded">
                            <span className="text-gray-400">Services</span>
                            <span className="font-medium">{ns.serviceCount}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-gray-900 rounded">
                            <span className="text-gray-400">Ingress</span>
                            <span className="font-medium">{ns.ingressCount}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Layers className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No namespaces found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="pods" className="space-y-4">
                {k8sResources?.pods && k8sResources.pods.length > 0 ? (
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-900 border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Namespace</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Ready</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Restarts</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Age</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Node</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {k8sResources.pods.map((pod) => (
                            <tr key={`${pod.namespace}/${pod.name}`} className="hover:bg-gray-900/50">
                              <td className="px-4 py-3 font-medium truncate max-w-[200px]">{pod.name}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs">{pod.namespace}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Badge 
                                  variant={pod.status === 'Running' ? 'success' : pod.status === 'Pending' ? 'warning' : 'destructive'}
                                  className="text-xs"
                                >
                                  {pod.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-400">{pod.ready}</td>
                              <td className="px-4 py-3">
                                <span className={pod.restarts > 5 ? 'text-yellow-400' : 'text-gray-400'}>
                                  {pod.restarts}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-400">{pod.age}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[150px]">{pod.node || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-12 text-center">
                    <Container className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No pods found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="deployments" className="space-y-4">
                {k8sResources?.deployments && k8sResources.deployments.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {k8sResources.deployments.map((dep) => (
                      <Card key={`${dep.namespace}/${dep.name}`} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{dep.name}</h4>
                            <Badge variant="outline" className="mt-1 text-xs">{dep.namespace}</Badge>
                          </div>
                          <Badge variant={dep.ready === dep.available ? "success" : "warning"} className="text-xs">
                            {dep.replicas}
                          </Badge>
                        </div>
                        
                        {dep.ingress && (
                          <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
                            <Globe className="h-3 w-3" />
                            <a 
                              href={`https://${dep.ingress.host}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline truncate"
                            >
                              {dep.ingress.host}
                            </a>
                            {dep.ingress.tls && <Lock className="h-3 w-3 text-green-400" />}
                          </div>
                        )}
                        
                        {dep.image && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                            <Box className="h-3 w-3" />
                            <span className="truncate">{dep.image}</span>
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500 mt-2">Age: {dep.age}</div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No deployments found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="services" className="space-y-4">
                {k8sResources?.services && k8sResources.services.length > 0 ? (
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-900 border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Namespace</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Type</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Ports</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Selector</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {k8sResources.services.map((svc) => (
                            <tr key={`${svc.namespace}/${svc.name}`} className="hover:bg-gray-900/50">
                              <td className="px-4 py-3 font-medium">{svc.name}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs">{svc.namespace}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="secondary" className="text-xs">{svc.type}</Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{svc.ports || '—'}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[200px]">{svc.selector || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-12 text-center">
                    <Network className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No services found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="ingresses" className="space-y-4">
                {k8sResources?.ingresses && k8sResources.ingresses.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {k8sResources.ingresses.map((ing) => (
                      <Card key={`${ing.namespace}/${ing.name}`} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{ing.name}</h4>
                            <Badge variant="outline" className="mt-1 text-xs">{ing.namespace}</Badge>
                          </div>
                          {ing.tls ? (
                            <Badge variant="success" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              TLS
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">HTTP</Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {ing.hosts.map((host, idx) => (
                            <a
                              key={idx}
                              href={`https://${host}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-blue-400 hover:underline"
                            >
                              <Globe className="h-3 w-3" />
                              {host}
                            </a>
                          ))}
                        </div>
                        
                        {ing.paths.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-800">
                            <p className="text-xs text-gray-500 mb-2">Paths:</p>
                            <div className="space-y-1">
                              {ing.paths.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                                  <span className="font-mono">{p.path}</span>
                                  <span>→</span>
                                  <span>{p.service}:{p.port}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Route className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No ingresses found</p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="costs">
          <CostDashboard />
        </TabsContent>

        <TabsContent value="hetzner" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-semibold">Hetzner Cloud Resources</h3>
              {hetznerData?.summary && (
                <div className="flex items-center gap-2">
                  {hetznerData.summary.projects && hetznerData.summary.projects > 1 && (
                    <Badge variant="secondary">{hetznerData.summary.projects} projects</Badge>
                  )}
                  <Badge variant="outline">{hetznerData.summary.servers.running}/{hetznerData.summary.servers.total} servers</Badge>
                  <Badge variant="outline">{hetznerData.summary.volumes.total} volumes</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchHetzner()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {hetznerLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : hetznerData ? (
            <Tabs defaultValue="servers" className="space-y-4">
              <TabsList>
                <TabsTrigger value="servers" className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Servers ({hetznerData.summary.servers.total})
                </TabsTrigger>
                <TabsTrigger value="volumes" className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Volumes ({hetznerData.summary.volumes.total})
                </TabsTrigger>
                <TabsTrigger value="load-balancers" className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Load Balancers ({hetznerData.summary.loadBalancers.total})
                </TabsTrigger>
                <TabsTrigger value="networking" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Networking
                </TabsTrigger>
                <TabsTrigger value="hetzner-costs" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Costs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="servers" className="space-y-4">
                {hetznerData.servers.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {hetznerData.servers.map((server) => (
                      <Card key={`${server.project}-${server.id}`} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Server className="h-5 w-5 text-red-400" />
                            <div>
                              <h4 className="font-semibold">{server.name}</h4>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{server.type}</span>
                                {server.project && (
                                  <Badge variant="outline" className="text-xs">{server.project}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant={server.status === 'running' ? 'success' : 'destructive'}>
                            {server.status}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">IP</span>
                            <span className="font-mono text-xs">{server.publicIp || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Location</span>
                            <span>{server.location} ({server.datacenter})</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Specs</span>
                            <span>{server.cores} vCPU / {server.memory}GB / {server.disk}GB</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Cost</span>
                            <span className="text-green-400">€{server.monthlyPrice.toFixed(2)}/mo</span>
                          </div>
                        </div>
                        {server.labels && Object.keys(server.labels).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-800">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(server.labels).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}: {value}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Server className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No Hetzner servers found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="volumes" className="space-y-4">
                {hetznerData.volumes.length > 0 ? (
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-900 border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Size</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Attached To</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Location</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {hetznerData.volumes.map((volume) => (
                            <tr key={volume.id} className="hover:bg-gray-900/50">
                              <td className="px-4 py-3 font-medium">{volume.name}</td>
                              <td className="px-4 py-3">{volume.size} GB</td>
                              <td className="px-4 py-3">
                                <Badge variant={volume.status === 'available' ? 'success' : 'secondary'}>
                                  {volume.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-400">
                                {volume.server ? `Server #${volume.server}` : 'Unattached'}
                              </td>
                              <td className="px-4 py-3 text-gray-400">{volume.location || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-12 text-center">
                    <HardDrive className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No volumes found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="load-balancers" className="space-y-4">
                {hetznerData.loadBalancers.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {hetznerData.loadBalancers.map((lb) => (
                      <Card key={lb.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Network className="h-5 w-5 text-blue-400" />
                            <div>
                              <h4 className="font-semibold">{lb.name}</h4>
                              <span className="text-xs text-gray-500">{lb.type}</span>
                            </div>
                          </div>
                          <Badge variant={lb.healthyTargets === lb.targets ? 'success' : 'warning'}>
                            {lb.healthyTargets}/{lb.targets} healthy
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">IP</span>
                            <span className="font-mono text-xs">{lb.publicIp || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Location</span>
                            <span>{lb.location}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Services</span>
                            <span>{lb.services}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Network className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No load balancers found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="networking" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Floating IPs ({hetznerData.floatingIPs.length})
                    </h4>
                    {hetznerData.floatingIPs.length > 0 ? (
                      <div className="space-y-2">
                        {hetznerData.floatingIPs.map((ip) => (
                          <Card key={ip.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-mono text-sm">{ip.ip}</span>
                                <span className="text-xs text-gray-500 ml-2">({ip.type})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {ip.blocked && <Badge variant="destructive" className="text-xs">Blocked</Badge>}
                                <Badge variant={ip.server ? 'success' : 'secondary'} className="text-xs">
                                  {ip.server ? `Server #${ip.server}` : 'Unassigned'}
                                </Badge>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="p-6 text-center">
                        <p className="text-gray-400 text-sm">No floating IPs</p>
                      </Card>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Network className="h-4 w-4" />
                      Private Networks ({hetznerData.networks.length})
                    </h4>
                    {hetznerData.networks.length > 0 ? (
                      <div className="space-y-2">
                        {hetznerData.networks.map((network) => (
                          <Card key={network.id} className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{network.name}</span>
                              <span className="font-mono text-xs text-gray-400">{network.ipRange}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{network.subnets} subnets</span>
                              <span>{network.servers} servers</span>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="p-6 text-center">
                        <p className="text-gray-400 text-sm">No private networks</p>
                      </Card>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Snapshots ({hetznerData.snapshots.length})
                  </h4>
                  {hetznerData.snapshots.length > 0 ? (
                    <Card className="overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-900 border-b border-gray-800">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-gray-400">Description</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-400">Size</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-400">Created From</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-400">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {hetznerData.snapshots.map((snapshot) => (
                              <tr key={snapshot.id} className="hover:bg-gray-900/50">
                                <td className="px-4 py-3">{snapshot.description || '—'}</td>
                                <td className="px-4 py-3">{snapshot.diskSize} GB</td>
                                <td className="px-4 py-3">
                                  <Badge variant={snapshot.status === 'available' ? 'success' : 'secondary'}>
                                    {snapshot.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-gray-400">{snapshot.createdFrom || '—'}</td>
                                <td className="px-4 py-3 text-gray-400">
                                  {formatDistanceToNow(new Date(snapshot.created), { addSuffix: true })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  ) : (
                    <Card className="p-6 text-center">
                      <p className="text-gray-400 text-sm">No snapshots</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="hetzner-costs" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-gray-400">Monthly Cost</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {hetznerData.costs.currency === 'EUR' ? '€' : '$'}{hetznerData.costs.totalMonthly.toFixed(2)}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-gray-400">Hourly Cost</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {hetznerData.costs.currency === 'EUR' ? '€' : '$'}{hetznerData.costs.totalHourly.toFixed(4)}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm text-gray-400">Untagged</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {hetznerData.costs.currency === 'EUR' ? '€' : '$'}{hetznerData.costs.untagged.toFixed(2)}
                    </p>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {hetznerData.costs.byProject && Object.keys(hetznerData.costs.byProject).length > 1 && (
                    <Card className="p-4">
                      <h4 className="font-medium mb-4">Cost by Project</h4>
                      <div className="space-y-2">
                        {Object.entries(hetznerData.costs.byProject).map(([project, cost]) => (
                          <div key={project} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                            <span>{project}</span>
                            <span className="font-mono">
                              {hetznerData.costs.currency === 'EUR' ? '€' : '$'}{(cost as number).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  <Card className="p-4">
                    <h4 className="font-medium mb-4">Cost by Resource Type</h4>
                    <div className="space-y-2">
                      {Object.entries(hetznerData.costs.byResourceType).map(([type, cost]) => (
                        <div key={type} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                          <span className="capitalize">{type}</span>
                          <span className="font-mono">
                            {hetznerData.costs.currency === 'EUR' ? '€' : '$'}{(cost as number).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="font-medium mb-4">Cost by Location</h4>
                    <div className="space-y-2">
                      {Object.entries(hetznerData.costs.byLocation).map(([location, cost]) => (
                        <div key={location} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                          <span>{location}</span>
                          <span className="font-mono">
                            {hetznerData.costs.currency === 'EUR' ? '€' : '$'}{(cost as number).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="p-12 text-center">
              <Server className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load Hetzner resources</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="aws" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-orange-400" />
              <h3 className="text-lg font-semibold">AWS Resources</h3>
              {awsData?.summary && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{awsData.summary.lambda.total} Lambda</Badge>
                  <Badge variant="outline">{awsData.summary.s3.total} S3</Badge>
                  <Badge variant="outline">{awsData.summary.sqs.total} SQS</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchAws()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {awsLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : awsData ? (
            <Tabs defaultValue="lambda" className="space-y-4">
              <TabsList>
                <TabsTrigger value="lambda" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Lambda ({awsData.summary.lambda.total})
                </TabsTrigger>
                <TabsTrigger value="s3" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  S3 ({awsData.summary.s3.total})
                </TabsTrigger>
                <TabsTrigger value="sqs" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SQS ({awsData.summary.sqs.total})
                </TabsTrigger>
                <TabsTrigger value="sns" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  SNS ({awsData.summary.sns.total})
                </TabsTrigger>
                <TabsTrigger value="iot" className="flex items-center gap-2">
                  <Radio className="h-4 w-4" />
                  IoT ({awsData.summary.iot.total})
                </TabsTrigger>
                <TabsTrigger value="alarms" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Alarms ({awsData.summary.alarms.total})
                </TabsTrigger>
                <TabsTrigger value="aws-costs" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Costs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lambda" className="space-y-4">
                {awsData.lambda.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {awsData.lambda.map((fn) => (
                      <Card key={fn.arn} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-yellow-400" />
                            <div>
                              <h4 className="font-semibold truncate max-w-[180px]">{fn.name}</h4>
                              <span className="text-xs text-gray-500">{fn.runtime}</span>
                            </div>
                          </div>
                          <Badge variant={fn.state === 'Active' ? 'success' : fn.state === 'Pending' ? 'warning' : 'destructive'}>
                            {fn.state}
                          </Badge>
                        </div>
                        {fn.description && (
                          <p className="text-xs text-gray-400 mb-3 line-clamp-2">{fn.description}</p>
                        )}
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Memory</span>
                            <span>{fn.memorySize} MB</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Timeout</span>
                            <span>{fn.timeout}s</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Code Size</span>
                            <span>{(fn.codeSize / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
                          Modified: {formatDistanceToNow(new Date(fn.lastModified), { addSuffix: true })}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Zap className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No Lambda functions found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="s3" className="space-y-4">
                {awsData.s3.length > 0 ? (
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-900 border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Bucket Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Region</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Size</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Objects</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {awsData.s3.map((bucket) => (
                            <tr key={bucket.name} className="hover:bg-gray-900/50">
                              <td className="px-4 py-3 font-medium">{bucket.name}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs">{bucket.region}</Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-400">
                                {bucket.sizeBytes ? `${(bucket.sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB` : '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-400">{bucket.objectCount?.toLocaleString() || '—'}</td>
                              <td className="px-4 py-3 text-gray-400">
                                {formatDistanceToNow(new Date(bucket.creationDate), { addSuffix: true })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-12 text-center">
                    <Database className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No S3 buckets found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="sqs" className="space-y-4">
                {awsData.sqs.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {awsData.sqs.map((queue) => (
                      <Card key={queue.url} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-purple-400" />
                            <div>
                              <h4 className="font-semibold">{queue.name}</h4>
                            </div>
                          </div>
                          <Badge variant={queue.isFifo ? 'secondary' : 'outline'}>
                            {queue.isFifo ? 'FIFO' : 'Standard'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-gray-900 rounded">
                            <p className="text-lg font-bold text-green-400">{queue.messagesAvailable}</p>
                            <p className="text-xs text-gray-500">Available</p>
                          </div>
                          <div className="p-2 bg-gray-900 rounded">
                            <p className="text-lg font-bold text-yellow-400">{queue.messagesInFlight}</p>
                            <p className="text-xs text-gray-500">In Flight</p>
                          </div>
                          <div className="p-2 bg-gray-900 rounded">
                            <p className="text-lg font-bold text-blue-400">{queue.messagesDelayed}</p>
                            <p className="text-xs text-gray-500">Delayed</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
                          <span>Visibility: {queue.visibilityTimeout}s</span>
                          <span>Delay: {queue.delaySeconds}s</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No SQS queues found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="sns" className="space-y-4">
                {awsData.sns.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {awsData.sns.map((topic) => (
                      <Card key={topic.arn} className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Bell className="h-5 w-5 text-pink-400" />
                          <h4 className="font-semibold truncate">{topic.name}</h4>
                        </div>
                        {topic.displayName && (
                          <p className="text-sm text-gray-400 mb-2">{topic.displayName}</p>
                        )}
                        <div className="flex items-center justify-between p-2 bg-gray-900 rounded">
                          <span className="text-gray-400">Subscriptions</span>
                          <span className="font-bold">{topic.subscriptionCount}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Bell className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No SNS topics found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="iot" className="space-y-4">
                {awsData.iot.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {awsData.iot.map((thing) => (
                      <Card key={thing.arn} className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Radio className="h-5 w-5 text-cyan-400" />
                          <h4 className="font-semibold">{thing.name}</h4>
                        </div>
                        {thing.typeName && (
                          <Badge variant="outline" className="mb-2">{thing.typeName}</Badge>
                        )}
                        {Object.keys(thing.attributes).length > 0 && (
                          <div className="space-y-1 mt-2">
                            {Object.entries(thing.attributes).slice(0, 3).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-xs">
                                <span className="text-gray-400">{key}</span>
                                <span className="truncate max-w-[120px]">{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Radio className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No IoT things found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="alarms" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Card className="p-4 flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-400" />
                    <div>
                      <p className="text-2xl font-bold">{awsData.summary.alarms.ok}</p>
                      <p className="text-sm text-gray-400">OK</p>
                    </div>
                  </Card>
                  <Card className="p-4 flex items-center gap-3">
                    <XCircle className="h-8 w-8 text-red-400" />
                    <div>
                      <p className="text-2xl font-bold">{awsData.summary.alarms.alarm}</p>
                      <p className="text-sm text-gray-400">Alarm</p>
                    </div>
                  </Card>
                  <Card className="p-4 flex items-center gap-3">
                    <HelpCircle className="h-8 w-8 text-yellow-400" />
                    <div>
                      <p className="text-2xl font-bold">{awsData.summary.alarms.insufficientData}</p>
                      <p className="text-sm text-gray-400">Insufficient Data</p>
                    </div>
                  </Card>
                </div>

                {awsData.alarms.length > 0 ? (
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-900 border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">State</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Metric</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Condition</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {awsData.alarms.map((alarm) => (
                            <tr key={alarm.arn} className="hover:bg-gray-900/50">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium">{alarm.name}</p>
                                  {alarm.description && (
                                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{alarm.description}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge 
                                  variant={alarm.state === 'OK' ? 'success' : alarm.state === 'ALARM' ? 'destructive' : 'warning'}
                                >
                                  {alarm.state}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-400">
                                <span className="font-mono text-xs">{alarm.namespace}/{alarm.metric}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-400">
                                {alarm.comparison} {alarm.threshold}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={alarm.actionsEnabled ? 'success' : 'secondary'} className="text-xs">
                                  {alarm.actionsEnabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-12 text-center">
                    <AlertTriangle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No CloudWatch alarms found</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="aws-costs" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-gray-400">Current Month</span>
                    </div>
                    <p className="text-2xl font-bold">${awsData.costs.currentMonth.toFixed(2)}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-gray-400">Last Month</span>
                    </div>
                    <p className="text-2xl font-bold">${awsData.costs.lastMonth.toFixed(2)}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                      <span className="text-sm text-gray-400">Forecast</span>
                    </div>
                    <p className="text-2xl font-bold">${awsData.costs.forecast.toFixed(2)}</p>
                  </Card>
                </div>

                <Card className="p-4">
                  <h4 className="font-medium mb-4">Cost by Service</h4>
                  {awsData.costs.byService.length > 0 ? (
                    <div className="space-y-2">
                      {awsData.costs.byService.slice(0, 10).map((item) => (
                        <div key={item.service} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                          <span className="text-sm truncate max-w-[200px]">{item.service}</span>
                          <span className="font-mono">${item.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm text-center py-4">No cost data available</p>
                  )}
                </Card>

                {awsData.costs.byApplication.length > 0 && (
                  <Card className="p-4">
                    <h4 className="font-medium mb-4">Cost by Application</h4>
                    <div className="space-y-2">
                      {awsData.costs.byApplication.map((item) => (
                        <div key={item.application} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                          <span>{item.application}</span>
                          <span className="font-mono">${item.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="p-12 text-center">
              <Cloud className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load AWS resources. Check if AWS credentials are configured.</p>
            </Card>
          )}
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
