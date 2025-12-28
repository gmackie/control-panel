"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchUsageMetrics } from "@/lib/api";
import { BarChart3, TrendingUp, Activity, Zap } from "lucide-react";

export default function UsageAnalytics() {
  const { data: usage, isLoading } = useQuery({
    queryKey: ["usage-metrics"],
    queryFn: fetchUsageMetrics,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="card-header">Usage Analytics</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1099511627776)
      return `${(bytes / 1099511627776).toFixed(1)} TB`;
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="card">
      <h2 className="card-header flex items-center">
        <BarChart3 className="h-5 w-5 mr-2 text-blue-500" />
        Usage Analytics
      </h2>

      {/* API Usage */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Requests</span>
            <Activity className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">
            {formatNumber(usage?.requests || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Avg Response: {usage?.avgResponseTime || 0}ms
          </p>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Error Rate</span>
            <Zap className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">
            {(usage?.errorRate || 0).toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Unique Users: {usage?.uniqueUsers || 0}
          </p>
        </div>
      </div>

      {/* Top API Endpoints */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3">Top API Endpoints</h3>
        <div className="space-y-2">
          {usage?.topEndpoints?.map((endpoint: any, index: number) => (
            <div
              key={endpoint.path}
              className="flex items-center justify-between"
            >
              <div className="flex items-center space-x-3 flex-1">
                <span className="text-xs text-gray-500 w-6">#{index + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-mono text-gray-300">
                    {endpoint.path}
                  </p>
                  <div className="mt-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${
                          (endpoint.count /
                            (usage.topEndpoints[0]?.count || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-medium">
                  {formatNumber(endpoint.count)}
                </p>
                <p className="text-xs text-gray-400">
                  {endpoint.avgTime}ms avg
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h3 className="text-sm font-medium mb-3">Performance Metrics</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded bg-gray-800/30">
            <span className="text-sm">P95 Response Time</span>
            <span className="text-sm font-medium">
              {usage?.p95ResponseTime || 0}ms
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-gray-800/30">
            <span className="text-sm">P99 Response Time</span>
            <span className="text-sm font-medium">
              {usage?.p99ResponseTime || 0}ms
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
