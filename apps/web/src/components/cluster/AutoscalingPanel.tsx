"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  Settings, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Clock,
  Server,
  AlertCircle,
  CheckCircle
} from "lucide-react";

interface AutoscalingPolicy {
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  minNodes: number;
  maxNodes: number;
  targetCPUUtilization?: number;
  targetMemoryUtilization?: number;
  targetPodCount?: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

interface ClusterMetrics {
  cpuUsage: number;
  memoryUsage: number;
  podCount: number;
  nodeCount: number;
  timestamp: string;
}

export function AutoscalingPanel() {
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);

  const { data: autoscalingData, isLoading } = useQuery({
    queryKey: ['autoscaling'],
    queryFn: async () => {
      const response = await fetch('/api/cluster/autoscaling');
      if (!response.ok) throw new Error('Failed to fetch autoscaling data');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: policiesData } = useQuery({
    queryKey: ['autoscaling-policies'],
    queryFn: async () => {
      const response = await fetch('/api/cluster/autoscaling/policies');
      if (!response.ok) throw new Error('Failed to fetch policies');
      return response.json();
    },
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async ({ policyName, updates }: { policyName: string; updates: Partial<AutoscalingPolicy> }) => {
      const response = await fetch('/api/cluster/autoscaling', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyName, updates }),
      });
      if (!response.ok) throw new Error('Failed to update policy');
      return response.json();
    },
  });

  const policies = policiesData?.policies || [];
  const metrics = autoscalingData?.metrics || [];
  const health = autoscalingData?.health || { healthy: false };

  const latestMetrics = metrics[metrics.length - 1] as ClusterMetrics | undefined;

  return (
    <div className="space-y-6">
      {/* Autoscaling Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Autoscaling Status</h2>
          </div>
          <Badge variant={health.healthy ? "success" : "error"}>
            {health.healthy ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Inactive
              </>
            )}
          </Badge>
        </div>

        {latestMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-400">CPU Usage</p>
              <p className="text-2xl font-bold">{latestMetrics.cpuUsage}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">Memory Usage</p>
              <p className="text-2xl font-bold">{latestMetrics.memoryUsage}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">Pod Count</p>
              <p className="text-2xl font-bold">{latestMetrics.podCount}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">Node Count</p>
              <p className="text-2xl font-bold">{latestMetrics.nodeCount}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Scaling Policies */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold">Scaling Policies</h2>
        </div>

        <div className="space-y-4">
          {policies.map((policy: AutoscalingPolicy) => (
            <div 
              key={policy.name}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedPolicy === policy.name ? 'border-blue-500 bg-blue-950/20' : 'border-gray-800'
              }`}
              onClick={() => setSelectedPolicy(policy.name === selectedPolicy ? null : policy.name)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{policy.displayName}</h3>
                  <p className="text-sm text-gray-400">{policy.description}</p>
                </div>
                <Switch
                  checked={policy.enabled}
                  onCheckedChange={(checked) => {
                    updatePolicyMutation.mutate({
                      policyName: policy.name,
                      updates: { enabled: checked }
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {selectedPolicy === policy.name && (
                <div className="mt-4 space-y-4 border-t border-gray-800 pt-4">
                  {/* Node Limits */}
                  <div>
                    <label className="text-sm text-gray-400">Node Limits</label>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">Min: {policy.minNodes}</span>
                      </div>
                      <div className="flex-1">
                        <Slider
                          value={[policy.minNodes, policy.maxNodes]}
                          min={1}
                          max={20}
                          step={1}
                          onValueChange={([min, max]) => {
                            updatePolicyMutation.mutate({
                              policyName: policy.name,
                              updates: { minNodes: min, maxNodes: max }
                            });
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Max: {policy.maxNodes}</span>
                        <Server className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>

                  {/* Target Metrics */}
                  {policy.targetCPUUtilization && (
                    <div>
                      <label className="text-sm text-gray-400">Target CPU Utilization</label>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm w-12">{policy.targetCPUUtilization}%</span>
                        <Slider
                          value={[policy.targetCPUUtilization]}
                          min={10}
                          max={90}
                          step={5}
                          onValueChange={([value]) => {
                            updatePolicyMutation.mutate({
                              policyName: policy.name,
                              updates: { targetCPUUtilization: value }
                            });
                          }}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )}

                  {policy.targetMemoryUtilization && (
                    <div>
                      <label className="text-sm text-gray-400">Target Memory Utilization</label>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm w-12">{policy.targetMemoryUtilization}%</span>
                        <Slider
                          value={[policy.targetMemoryUtilization]}
                          min={10}
                          max={90}
                          step={5}
                          onValueChange={([value]) => {
                            updatePolicyMutation.mutate({
                              policyName: policy.name,
                              updates: { targetMemoryUtilization: value }
                            });
                          }}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* Thresholds */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Scale Up Threshold
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={policy.scaleUpThreshold * 100}
                          onChange={(e) => {
                            updatePolicyMutation.mutate({
                              policyName: policy.name,
                              updates: { scaleUpThreshold: parseFloat(e.target.value) / 100 }
                            });
                          }}
                          className="w-20 px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                        />
                        <span className="text-sm text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Scale Down Threshold
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={policy.scaleDownThreshold * 100}
                          onChange={(e) => {
                            updatePolicyMutation.mutate({
                              policyName: policy.name,
                              updates: { scaleDownThreshold: parseFloat(e.target.value) / 100 }
                            });
                          }}
                          className="w-20 px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                        />
                        <span className="text-sm text-gray-400">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Cooldown Periods */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Scale Up Cooldown
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={policy.scaleUpCooldown}
                          onChange={(e) => {
                            updatePolicyMutation.mutate({
                              policyName: policy.name,
                              updates: { scaleUpCooldown: parseInt(e.target.value) }
                            });
                          }}
                          className="w-20 px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                        />
                        <span className="text-sm text-gray-400">seconds</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Scale Down Cooldown
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={policy.scaleDownCooldown}
                          onChange={(e) => {
                            updatePolicyMutation.mutate({
                              policyName: policy.name,
                              updates: { scaleDownCooldown: parseInt(e.target.value) }
                            });
                          }}
                          className="w-20 px-2 py-1 bg-gray-900 border border-gray-800 rounded text-sm"
                        />
                        <span className="text-sm text-gray-400">seconds</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Scaling History */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold">Recent Scaling Events</h2>
        </div>

        <div className="space-y-2">
          {metrics.slice(-5).reverse().map((metric: ClusterMetrics, index: number) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  CPU: {metric.cpuUsage}% | Memory: {metric.memoryUsage}% | Nodes: {metric.nodeCount}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(metric.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}