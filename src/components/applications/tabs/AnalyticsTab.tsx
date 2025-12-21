"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Users,
  Activity,
  Flag,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { AnalyticsMetrics } from "@/types/unified-app";

export function AnalyticsTab() {
  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: AnalyticsMetrics | null }>({
    queryKey: ["app-analytics"],
    queryFn: async () => {
      const response = await fetch("/api/apps/metrics/analytics");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
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
        <p className="text-red-400">Failed to load analytics</p>
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
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">PostHog integration not configured</p>
        <p className="text-sm text-gray-500 mt-2">
          Configure PostHog to see analytics data
        </p>
      </Card>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analytics (PostHog)</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unique Users (24h)</p>
              <p className="text-2xl font-bold">{formatNumber(metrics.uniqueUsers24h)}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unique Users (7d)</p>
              <p className="text-2xl font-bold">{formatNumber(metrics.uniqueUsers7d)}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Events (24h)</p>
              <p className="text-2xl font-bold">{formatNumber(metrics.totalEvents24h)}</p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Feature Flags</p>
              <p className="text-2xl font-bold">{metrics.activeFeatureFlags}</p>
            </div>
            <Flag className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* 30-day users */}
      <Card className="p-4">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Monthly Overview
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Unique Users (30d)</p>
            <p className="text-xl font-bold">{formatNumber(metrics.uniqueUsers30d)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Events (7d)</p>
            <p className="text-xl font-bold">{formatNumber(metrics.totalEvents7d)}</p>
          </div>
        </div>
      </Card>

      {/* Top Events */}
      {metrics.topEvents && metrics.topEvents.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-4">Top Events</h4>
          <div className="space-y-3">
            {metrics.topEvents.map((event, index) => (
              <div key={event.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 w-6">{index + 1}.</span>
                  <code className="bg-gray-800 px-2 py-1 rounded text-sm">{event.name}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{formatNumber(event.count)} events</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
