"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle,
  Clock,
  Rocket,
  Server,
  XCircle,
} from "lucide-react";

interface DashboardStats {
  success: boolean;
  data: {
    applications: {
      total: number;
      byStatus: Record<string, number>;
      healthPercentage: number;
    };
    alerts: {
      firing: number;
      critical: number;
      warning: number;
      info: number;
    };
    deployments: {
      recent: Array<{
        id: string;
        applicationId: string;
        environment: string;
        status: string;
        imageTag: string;
        deployedBy: string;
        createdAt: string;
      }>;
    };
    summary: {
      totalApplications: number;
      healthyApplications: number;
      degradedApplications: number;
      unhealthyApplications: number;
      firingAlerts: number;
      criticalAlerts: number;
    };
  };
  timestamp: string;
}

export function DashboardStats() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/apps/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              <div className="h-8 bg-gray-700 rounded w-1/3"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats?.success) {
    return (
      <Card className="p-4 border-yellow-600/50">
        <div className="flex items-center gap-2 text-yellow-500">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Unable to load dashboard statistics</span>
        </div>
      </Card>
    );
  }

  const { summary, alerts } = stats.data;

  const statCards = [
    {
      label: "Total Applications",
      value: summary.totalApplications,
      icon: Box,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Healthy Apps",
      value: summary.healthyApplications,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      badge: summary.totalApplications > 0 
        ? `${Math.round((summary.healthyApplications / summary.totalApplications) * 100)}%`
        : null,
      badgeColor: "bg-green-600",
    },
    {
      label: "Active Alerts",
      value: alerts.firing,
      icon: alerts.critical > 0 ? XCircle : alerts.warning > 0 ? AlertTriangle : Activity,
      color: alerts.critical > 0 ? "text-red-500" : alerts.warning > 0 ? "text-yellow-500" : "text-green-500",
      bgColor: alerts.critical > 0 ? "bg-red-500/10" : alerts.warning > 0 ? "bg-yellow-500/10" : "bg-green-500/10",
      badge: alerts.critical > 0 ? `${alerts.critical} critical` : null,
      badgeColor: "bg-red-600",
    },
    {
      label: "Recent Deployments",
      value: stats.data.deployments.recent.length,
      icon: Rocket,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  {stat.label}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  {stat.badge && (
                    <Badge className={stat.badgeColor} variant="secondary">
                      {stat.badge}
                    </Badge>
                  )}
                </div>
              </div>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Status Breakdown */}
      {summary.totalApplications > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Application Status Breakdown</h3>
            <span className="text-xs text-gray-400">
              Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-300">
                Healthy: {summary.healthyApplications}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm text-gray-300">
                Degraded: {summary.degradedApplications}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-gray-300">
                Unhealthy: {summary.unhealthyApplications}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-sm text-gray-300">
                Unknown: {summary.totalApplications - summary.healthyApplications - summary.degradedApplications - summary.unhealthyApplications}
              </span>
            </div>
          </div>
          
          {/* Progress bar showing health distribution */}
          <div className="mt-3 h-2 rounded-full bg-gray-700 overflow-hidden flex">
            <div 
              className="bg-green-500 h-full" 
              style={{ width: `${(summary.healthyApplications / summary.totalApplications) * 100}%` }}
            />
            <div 
              className="bg-yellow-500 h-full" 
              style={{ width: `${(summary.degradedApplications / summary.totalApplications) * 100}%` }}
            />
            <div 
              className="bg-red-500 h-full" 
              style={{ width: `${(summary.unhealthyApplications / summary.totalApplications) * 100}%` }}
            />
          </div>
        </Card>
      )}

      {/* Alert Summary */}
      {alerts.firing > 0 && (
        <Card className="p-4 border-yellow-600/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="font-medium">Active Alerts</span>
            </div>
            <div className="flex items-center gap-3">
              {alerts.critical > 0 && (
                <Badge variant="error">{alerts.critical} Critical</Badge>
              )}
              {alerts.warning > 0 && (
                <Badge variant="warning">{alerts.warning} Warning</Badge>
              )}
              {alerts.info > 0 && (
                <Badge variant="secondary">{alerts.info} Info</Badge>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
