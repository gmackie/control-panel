"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Users,
  Zap,
  AlertCircle,
  Cpu,
  HardDrive,
  Network,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface RealtimeMetrics {
  activeUsers: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  throughput: {
    in: string;
    out: string;
  };
}

export function RealtimeMetrics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [previousMetrics, setPreviousMetrics] = useState<RealtimeMetrics | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource("/api/metrics/stream");
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "connected") {
        setConnected(true);
      } else if (data.type === "metrics") {
        setPreviousMetrics(metrics);
        setMetrics(data.data);
      }
    };
    
    eventSource.onerror = () => {
      setConnected(false);
    };
    
    return () => {
      eventSource.close();
    };
  }, [metrics]);

  const getMetricTrend = (current: number, previous: number | undefined) => {
    if (!previous) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 1) return null;
    return diff > 0 ? "up" : "down";
  };

  const getMetricColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return "text-green-600";
    if (value <= thresholds.warning) return "text-yellow-600";
    return "text-red-600";
  };

  if (!metrics) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Real-time Metrics</h2>
        <Badge variant={connected ? "success" : "secondary"} className="text-xs">
          <div className={`h-2 w-2 rounded-full mr-1 ${connected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          {connected ? "Live" : "Disconnected"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Users */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Active Users</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{metrics.activeUsers}</span>
            {previousMetrics && getMetricTrend(metrics.activeUsers, previousMetrics.activeUsers) && (
              getMetricTrend(metrics.activeUsers, previousMetrics.activeUsers) === "up" ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )
            )}
          </div>
        </div>

        {/* Requests/sec */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Requests/sec</span>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{metrics.requestsPerSecond}</span>
          </div>
        </div>

        {/* Response Time */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Avg Response</span>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getMetricColor(metrics.avgResponseTime, { good: 50, warning: 100 })}`}>
              {metrics.avgResponseTime}ms
            </span>
          </div>
        </div>

        {/* Error Rate */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Error Rate</span>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getMetricColor(metrics.errorRate, { good: 0.5, warning: 1 })}`}>
              {metrics.errorRate}%
            </span>
          </div>
        </div>

        {/* CPU Usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">CPU Usage</span>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getMetricColor(metrics.cpuUsage, { good: 60, warning: 80 })}`}>
              {metrics.cpuUsage}%
            </span>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Memory</span>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getMetricColor(metrics.memoryUsage, { good: 70, warning: 85 })}`}>
              {metrics.memoryUsage}%
            </span>
          </div>
        </div>

        {/* Connections */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Connections</span>
            <Network className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{metrics.activeConnections}</span>
          </div>
        </div>

        {/* Throughput */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Throughput</span>
            <Network className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-sm">
            <div>↓ {metrics.throughput.in} MB/s</div>
            <div>↑ {metrics.throughput.out} MB/s</div>
          </div>
        </div>
      </div>
    </Card>
  );
}