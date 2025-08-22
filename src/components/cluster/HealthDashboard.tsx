"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  TrendingDown,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NodeStatus {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

interface HealthAlert {
  id: string;
  nodeName: string;
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface NodeMetrics {
  nodeName: string;
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  conditions: {
    ready: boolean;
    memoryPressure: boolean;
    diskPressure: boolean;
    pidPressure: boolean;
    networkUnavailable: boolean;
  };
  resources: {
    cpu: {
      usage: number;
      percentage: number;
    };
    memory: {
      usage: number;
      percentage: number;
    };
    pods: {
      current: number;
      capacity: number;
      percentage: number;
    };
  };
}

export function HealthDashboard() {
  const [realtimeMetrics, setRealtimeMetrics] = useState<Map<string, NodeMetrics>>(new Map());
  const [activeAlerts, setActiveAlerts] = useState<HealthAlert[]>([]);

  const { data: healthData, isLoading } = useQuery({
    queryKey: ['cluster-health'],
    queryFn: async () => {
      const response = await fetch('/api/cluster/health');
      if (!response.ok) throw new Error('Failed to fetch health data');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Set up real-time event stream
  useEffect(() => {
    const eventSource = new EventSource('/api/cluster/health/stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'metrics':
          setRealtimeMetrics(prev => {
            const updated = new Map(prev);
            updated.set(data.nodeName, data.metrics);
            return updated;
          });
          break;
        case 'alert':
          setActiveAlerts(prev => [...prev, data.data]);
          break;
        case 'alertResolved':
          setActiveAlerts(prev => prev.filter(a => a.id !== data.data.id));
          break;
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const summary = healthData?.summary || {};
  const alerts = healthData?.alerts || activeAlerts;
  
  // Calculate cluster health stats
  const nodeStatuses = Object.values(summary) as NodeStatus['status'][];
  const healthyNodes = nodeStatuses.filter(s => s === 'healthy').length;
  const warningNodes = nodeStatuses.filter(s => s === 'warning').length;
  const criticalNodes = nodeStatuses.filter(s => s === 'critical').length;
  const totalNodes = nodeStatuses.length;

  const getStatusIcon = (status: NodeStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: NodeStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success">Healthy</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning</Badge>;
      case 'critical':
        return <Badge variant="error">Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cluster Health Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Cluster Health Overview</h2>
          </div>
          <Badge variant={healthyNodes === totalNodes ? "success" : warningNodes > 0 ? "warning" : "error"}>
            {healthyNodes === totalNodes ? "All Systems Operational" : "Issues Detected"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-2xl font-bold">{healthyNodes}</p>
            <p className="text-sm text-gray-400">Healthy Nodes</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold">{warningNodes}</p>
            <p className="text-sm text-gray-400">Warning Nodes</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-2xl font-bold">{criticalNodes}</p>
            <p className="text-sm text-gray-400">Critical Nodes</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Server className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-2xl font-bold">{totalNodes}</p>
            <p className="text-sm text-gray-400">Total Nodes</p>
          </div>
        </div>
      </Card>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Active Alerts ({alerts.length})
          </h3>
          {alerts.map((alert: HealthAlert) => (
            <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{alert.nodeName}</span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                </span>
              </AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Node Status Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="h-5 w-5 text-gray-400" />
          Node Health Status
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(summary).map(([nodeName, status]) => {
            const metrics = realtimeMetrics.get(nodeName);
            
            return (
              <Card key={nodeName} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status as NodeStatus['status'])}
                    <h4 className="font-medium">{nodeName}</h4>
                  </div>
                  {getStatusBadge(status as NodeStatus['status'])}
                </div>

                {metrics && (
                  <div className="space-y-3">
                    {/* CPU Usage */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400 flex items-center gap-1">
                          <Cpu className="h-3 w-3" />
                          CPU Usage
                        </span>
                        <span className="text-sm font-medium">
                          {metrics.resources.cpu.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={metrics.resources.cpu.percentage} 
                        className="h-2"
                      />
                    </div>

                    {/* Memory Usage */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400 flex items-center gap-1">
                          <MemoryStick className="h-3 w-3" />
                          Memory Usage
                        </span>
                        <span className="text-sm font-medium">
                          {metrics.resources.memory.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={metrics.resources.memory.percentage} 
                        className="h-2"
                      />
                    </div>

                    {/* Pod Count */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400 flex items-center gap-1">
                          <Server className="h-3 w-3" />
                          Pod Count
                        </span>
                        <span className="text-sm font-medium">
                          {metrics.resources.pods.current} / {metrics.resources.pods.capacity}
                        </span>
                      </div>
                      <Progress 
                        value={metrics.resources.pods.percentage} 
                        className="h-2"
                      />
                    </div>

                    {/* Conditions */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {metrics.conditions.memoryPressure && (
                        <Badge variant="warning" className="text-xs">
                          Memory Pressure
                        </Badge>
                      )}
                      {metrics.conditions.diskPressure && (
                        <Badge variant="warning" className="text-xs">
                          <HardDrive className="h-3 w-3 mr-1" />
                          Disk Pressure
                        </Badge>
                      )}
                      {metrics.conditions.networkUnavailable && (
                        <Badge variant="error" className="text-xs">
                          <Network className="h-3 w-3 mr-1" />
                          Network Issue
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Resource Trends */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold">Resource Trends</h3>
        </div>
        <p className="text-sm text-gray-400">
          Real-time resource monitoring shows current utilization across all nodes
        </p>
      </Card>
    </div>
  );
}