"use client";

import { Card } from "@/components/ui/card";
import { Activity, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { ActivityStats as ActivityStatsType } from "@/lib/activity/types";

interface ActivityStatsProps {
  stats: ActivityStatsType | null;
  isLoading?: boolean;
}

export function ActivityStats({ stats, isLoading }: ActivityStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-8 bg-gray-700 rounded w-3/4" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const errorCount = (stats.bySeverity?.error || 0) + (stats.bySeverity?.critical || 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Activity className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Total Events</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Clock className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.last24h.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Last 24 Hours</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.last7d.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Last 7 Days</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{errorCount.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Errors/Critical</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
