"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MetricsTabProps {
  appId: string;
}

interface AppMetrics {
  cpu: {
    usage: number;
    limit: string;
    request: string;
  };
  memory: {
    usage: number;
    usedBytes: number;
    limitBytes: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
    rxRate: number;
    txRate: number;
  };
  requests: {
    total: number;
    rate: number;
    errorRate: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
  };
  pods: {
    running: number;
    total: number;
    restarts: number;
  };
  uptime: number;
  lastUpdated: string;
}

export function MetricsTab({ appId }: MetricsTabProps) {
  const [timeRange, setTimeRange] = useState("1h");

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: AppMetrics | null }>({
    queryKey: ["app-metrics", appId, timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/metrics?range=${timeRange}`);
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const metrics = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-red-400">Failed to load metrics</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="p-6 text-center">
        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">No metrics available</p>
        <p className="text-sm text-gray-500 mt-2">
          Deploy your application to see resource metrics
        </p>
      </Card>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const formatRate = (rate: number) => {
    if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/s`;
    return `${rate.toFixed(1)}/s`;
  };

  const getUsageColor = (usage: number) => {
    if (usage >= 90) return "text-red-500";
    if (usage >= 70) return "text-yellow-500";
    return "text-green-500";
  };

  const getUsageBadge = (usage: number) => {
    if (usage >= 90) return <Badge variant="error">Critical</Badge>;
    if (usage >= 70) return <Badge variant="warning">Warning</Badge>;
    return <Badge variant="default" className="bg-green-600">Healthy</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Resource Metrics</h3>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">Last 15m</SelectItem>
              <SelectItem value="1h">Last 1h</SelectItem>
              <SelectItem value="6h">Last 6h</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {metrics.lastUpdated && (
        <p className="text-sm text-gray-500">
          Last updated: {formatDistanceToNow(new Date(metrics.lastUpdated), { addSuffix: true })}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">CPU</span>
            </div>
            {getUsageBadge(metrics.cpu.usage)}
          </div>
          <p className={`text-3xl font-bold ${getUsageColor(metrics.cpu.usage)}`}>
            {metrics.cpu.usage.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {metrics.cpu.request} requested / {metrics.cpu.limit} limit
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MemoryStick className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium">Memory</span>
            </div>
            {getUsageBadge(metrics.memory.usage)}
          </div>
          <p className={`text-3xl font-bold ${getUsageColor(metrics.memory.usage)}`}>
            {metrics.memory.usage.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatBytes(metrics.memory.usedBytes)} / {formatBytes(metrics.memory.limitBytes)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Pods</span>
            </div>
            <Badge variant={metrics.pods.running === metrics.pods.total ? "default" : "warning"}>
              {metrics.pods.running}/{metrics.pods.total}
            </Badge>
          </div>
          <p className="text-3xl font-bold">
            {metrics.pods.running}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {metrics.pods.restarts} total restarts
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyan-500" />
              <span className="text-sm font-medium">Uptime</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-green-500">
            {metrics.uptime.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Last {timeRange}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Network className="h-5 w-5 text-blue-500" />
            Network Traffic
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> Received
              </p>
              <p className="text-xl font-bold">{formatBytes(metrics.network.rxBytes)}</p>
              <p className="text-xs text-gray-500">{formatBytes(metrics.network.rxRate)}/s</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Transmitted
              </p>
              <p className="text-xl font-bold">{formatBytes(metrics.network.txBytes)}</p>
              <p className="text-xs text-gray-500">{formatBytes(metrics.network.txRate)}/s</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            Request Metrics
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-xl font-bold">{metrics.requests.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{formatRate(metrics.requests.rate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg Latency</p>
              <p className="text-xl font-bold">{metrics.requests.avgLatency}ms</p>
              <p className="text-xs text-gray-500">p95: {metrics.requests.p95Latency}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Error Rate</p>
              <p className={`text-xl font-bold ${metrics.requests.errorRate > 5 ? 'text-red-500' : metrics.requests.errorRate > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                {metrics.requests.errorRate.toFixed(2)}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {metrics.requests.errorRate > 5 && (
        <Card className="p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-red-400">High Error Rate Detected</p>
              <p className="text-sm text-gray-400">
                Error rate is above 5%. Check the Errors tab for details.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
