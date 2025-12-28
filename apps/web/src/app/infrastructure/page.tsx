"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { InfrastructureSwitcher } from "@/components/infrastructure/InfrastructureSwitcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Server,
  GitBranch,
  Plus,
  Activity,
  DollarSign,
  Shield,
  Settings,
  AlertCircle,
  RefreshCw,
  Heart,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { Infrastructure } from "@/lib/infrastructure/types";
import { ClusterOverview } from "@/components/cluster/ClusterOverview";
import { NodeCard } from "@/components/cluster/NodeCard";
import { AddNodeModal } from "@/components/cluster/AddNodeModal";
import { AutoscalingPanel } from "@/components/cluster/AutoscalingPanel";
import { HealthDashboard } from "@/components/cluster/HealthDashboard";
import { CostDashboard } from "@/components/cluster/CostDashboard";

export default function InfrastructurePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedInfra, setSelectedInfra] = useState<Infrastructure>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<"k3s" | "gitea-vps">();
  const [showAddNode, setShowAddNode] = useState(false);

  const { data: clusterData, isLoading: clusterLoading, refetch: refetchCluster } = useQuery({
    queryKey: ['cluster'],
    queryFn: async () => {
      const response = await fetch('/api/cluster');
      if (!response.ok) {
        throw new Error('Failed to fetch cluster info');
      }
      return response.json();
    },
    enabled: selectedInfra?.type === 'k3s',
    refetchInterval: 30000,
  });

  const removeNodeMutation = useMutation({
    mutationFn: async (nodeName: string) => {
      const response = await fetch(`/api/cluster/nodes?name=${nodeName}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to remove node');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster'] });
    },
  });

  const powerActionMutation = useMutation({
    mutationFn: async ({ nodeName, action }: { nodeName: string; action: string }) => {
      const response = await fetch('/api/cluster/nodes/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeName, action }),
      });
      if (!response.ok) {
        throw new Error('Failed to perform power action');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster'] });
    },
  });

  const handleInfraSelect = (infrastructure: Infrastructure) => {
    setSelectedInfra(infrastructure);
  };

  const handleCreateNew = () => {
    setShowCreateDialog(true);
  };

  const { cluster, stats } = clusterData || { cluster: { nodes: [] }, stats: {} };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Infrastructure</h1>
        <p className="text-gray-400">
          Manage your K3s clusters and Gitea VPS instances
        </p>
      </div>

      <InfrastructureSwitcher
        selectedId={selectedInfra?.id}
        onSelect={handleInfraSelect}
        onCreateNew={handleCreateNew}
      />

      {selectedInfra && selectedInfra.type === "k3s" && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{selectedInfra.name}</h2>
              <Badge variant="success">{selectedInfra.status}</Badge>
            </div>
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

          <Tabs defaultValue="nodes" className="mt-6 space-y-4">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
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
              <TabsTrigger value="costs" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Costs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nodes" className="space-y-6">
              {clusterLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-gray-400" />
                    <h3 className="text-lg font-semibold">Cluster Nodes</h3>
                    <Badge variant="secondary">{cluster.nodes?.length || 0} total</Badge>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {cluster.nodes?.map((node: any) => (
                      <NodeCard
                        key={node.name}
                        node={node}
                        onRemove={(name) => {
                          if (confirm(`Are you sure you want to remove node ${name}?`)) {
                            removeNodeMutation.mutate(name);
                          }
                        }}
                        onPowerAction={(name, action) => {
                          if (confirm(`Are you sure you want to ${action} node ${name}?`)) {
                            powerActionMutation.mutate({ nodeName: name, action });
                          }
                        }}
                      />
                    ))}
                  </div>

                  {(!cluster.nodes || cluster.nodes.length === 0) && (
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
                </>
              )}
            </TabsContent>

            <TabsContent value="health">
              <HealthDashboard />
            </TabsContent>

            <TabsContent value="autoscaling">
              <AutoscalingPanel />
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
      )}

      {selectedInfra && selectedInfra.type === "gitea-vps" && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{selectedInfra.name}</h2>
              <Badge variant="success">{selectedInfra.status}</Badge>
            </div>
            <Button variant="outline" onClick={() => window.open(selectedInfra.endpoint, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Gitea
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Type</span>
                <GitBranch className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold">Gitea VPS</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Status</span>
                <Activity className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold capitalize">{selectedInfra.status}</p>
            </Card>

            {selectedInfra.cost && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Monthly Cost</span>
                  <DollarSign className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold">${selectedInfra.cost.monthly.toFixed(2)}</p>
              </Card>
            )}
          </div>

          {selectedInfra.config.type === "gitea-vps" && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Features</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-900 rounded">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="font-medium">Actions</p>
                  <p className="text-sm text-gray-400">
                    {selectedInfra.config.features.actions ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-900 rounded">
                  <Server className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">Registry</p>
                  <p className="text-sm text-gray-400">
                    {selectedInfra.config.features.registry ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-900 rounded">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <p className="font-medium">Packages</p>
                  <p className="text-sm text-gray-400">
                    {selectedInfra.config.features.packages ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-900 rounded">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <p className="font-medium">LFS</p>
                  <p className="text-sm text-gray-400">
                    {selectedInfra.config.features.lfs ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {!selectedInfra && (
        <div className="mt-8">
          <Card className="p-12 text-center">
            <Server className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Select Infrastructure</h3>
            <p className="text-gray-400 mb-4">
              Choose an infrastructure above or create a new one
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Infrastructure
            </Button>
          </Card>
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Infrastructure</DialogTitle>
            <DialogDescription>
              Choose the type of infrastructure you want to create
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card
              className={`p-6 cursor-pointer transition-all ${
                createType === "k3s"
                  ? "ring-2 ring-blue-500"
                  : "hover:ring-1 hover:ring-gray-600"
              }`}
              onClick={() => setCreateType("k3s")}
            >
              <Server className="h-12 w-12 mb-3 text-blue-500" />
              <h3 className="font-semibold mb-1">K3s Cluster</h3>
              <p className="text-sm text-gray-400">
                Lightweight Kubernetes for production workloads
              </p>
            </Card>
            <Card
              className={`p-6 cursor-pointer transition-all ${
                createType === "gitea-vps"
                  ? "ring-2 ring-blue-500"
                  : "hover:ring-1 hover:ring-gray-600"
              }`}
              onClick={() => setCreateType("gitea-vps")}
            >
              <GitBranch className="h-12 w-12 mb-3 text-green-500" />
              <h3 className="font-semibold mb-1">Gitea VPS</h3>
              <p className="text-sm text-gray-400">
                Self-hosted Git service with CI/CD
              </p>
            </Card>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setCreateType(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!createType}
              onClick={() => {
                setShowCreateDialog(false);
                router.push(`/infrastructure/create?type=${createType}`);
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
