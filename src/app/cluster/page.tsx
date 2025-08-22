"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClusterOverview } from "@/components/cluster/ClusterOverview";
import { NodeCard } from "@/components/cluster/NodeCard";
import { AddNodeModal } from "@/components/cluster/AddNodeModal";
import { AutoscalingPanel } from "@/components/cluster/AutoscalingPanel";
import { HealthDashboard } from "@/components/cluster/HealthDashboard";
import { CostDashboard } from "@/components/cluster/CostDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  RefreshCw, 
  Server,
  AlertCircle,
  Settings,
  Activity,
  TrendingUp,
  Heart,
  DollarSign
} from "lucide-react";

export default function ClusterPage() {
  const queryClient = useQueryClient();
  const [showAddNode, setShowAddNode] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cluster'],
    queryFn: async () => {
      const response = await fetch('/api/cluster');
      if (!response.ok) {
        throw new Error('Failed to fetch cluster info');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load cluster information</p>
          </div>
          <Button onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const { cluster, stats } = data || { cluster: { nodes: [] }, stats: {} };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Cluster Management</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddNode(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Node
            </Button>
          </div>
        </div>
        <p className="text-gray-400">
          Manage your k3s cluster nodes and resources
        </p>
      </div>

      {/* Cluster Overview */}
      {stats && (
        <div className="mb-8">
          <ClusterOverview stats={stats} />
        </div>
      )}

      {/* Tabs for Nodes and Autoscaling */}
      <Tabs defaultValue="nodes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
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
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nodes" className="space-y-6">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold">Cluster Nodes</h2>
            <Badge variant="secondary">
              {cluster.nodes?.length || 0} total
            </Badge>
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
              <p className="text-gray-400 mb-4">
                Add your first node to get started
              </p>
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

        <TabsContent value="costs">
          <CostDashboard />
        </TabsContent>

        <TabsContent value="info" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Cluster Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400">Cluster Name</p>
                <p className="font-medium">{cluster.name || 'gmac-io-k3s'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">K3s Version</p>
                <p className="font-medium">{cluster.version || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">API Endpoint</p>
                <p className="font-mono text-sm">{cluster.endpoint || 'Not configured'}</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Node Modal */}
      {showAddNode && (
        <AddNodeModal
          onClose={() => setShowAddNode(false)}
          onSuccess={() => {
            setShowAddNode(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}