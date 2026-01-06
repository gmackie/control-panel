"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Loader2,
  ExternalLink,
  Settings,
  Plus,
  Info,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface AlertsTabProps {
  appId: string;
}

interface Alert {
  id: string;
  ruleName: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "firing" | "acknowledged" | "resolved";
  startedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  source: string;
  tags: Record<string, string>;
  runbookUrl?: string;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: string;
  enabled: boolean;
  triggerCount: number;
  lastTriggered?: string;
}

interface AlertsResponse {
  alerts: Alert[];
  rules: AlertRule[];
  summary: {
    firing: number;
    acknowledged: number;
    resolved24h: number;
  };
}

export function AlertsTab({ appId }: AlertsTabProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "firing" | "acknowledged" | "resolved">("all");

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: AlertsResponse }>({
    queryKey: ["app-alerts", appId],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/alerts`);
      if (!response.ok) throw new Error("Failed to fetch alerts");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/alerts/${alertId}/acknowledge`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to acknowledge alert");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-alerts", appId] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/alerts/${alertId}/resolve`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to resolve alert");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-alerts", appId] });
    },
  });

  const alertsData = data?.data;
  const alerts = alertsData?.alerts || [];
  const rules = alertsData?.rules || [];
  const summary = alertsData?.summary || { firing: 0, acknowledged: 0, resolved24h: 0 };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "all") return true;
    return alert.status === filter;
  });

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
        <p className="text-red-400">Failed to load alerts</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  const getSeverityIcon = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "info":
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical":
        return <Badge variant="error">Critical</Badge>;
      case "high":
        return <Badge variant="warning" className="bg-orange-600">High</Badge>;
      case "medium":
        return <Badge variant="warning">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      case "info":
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getStatusIcon = (status: Alert["status"]) => {
    switch (status) {
      case "firing":
        return <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />;
      case "acknowledged":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Application Alerts
        </h3>
        <div className="flex items-center gap-2">
          <Link href="/alerts">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              All Alerts
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card
          className={`p-4 cursor-pointer transition-colors ${
            filter === "firing" ? "border-red-500" : "hover:border-gray-700"
          }`}
          onClick={() => setFilter(filter === "firing" ? "all" : "firing")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Firing</p>
              <p className="text-2xl font-bold text-red-400">{summary.firing}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-colors ${
            filter === "acknowledged" ? "border-yellow-500" : "hover:border-gray-700"
          }`}
          onClick={() => setFilter(filter === "acknowledged" ? "all" : "acknowledged")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Acknowledged</p>
              <p className="text-2xl font-bold text-yellow-400">{summary.acknowledged}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-colors ${
            filter === "resolved" ? "border-green-500" : "hover:border-gray-700"
          }`}
          onClick={() => setFilter(filter === "resolved" ? "all" : "resolved")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Resolved (24h)</p>
              <p className="text-2xl font-bold text-green-400">{summary.resolved24h}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>
      </div>

      {filteredAlerts.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {filter === "all" ? "No Alerts" : `No ${filter} alerts`}
          </h3>
          <p className="text-gray-400">
            {filter === "all"
              ? "This application has no active alerts"
              : `No alerts with status "${filter}"`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(alert.status)}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{alert.ruleName}</h4>
                      {getSeverityBadge(alert.severity)}
                      <Badge variant="outline" className="text-xs">
                        {alert.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{alert.message}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Source: {alert.source}</span>
                      <span>
                        Started: {formatDistanceToNow(new Date(alert.startedAt), { addSuffix: true })}
                      </span>
                      {alert.acknowledgedAt && (
                        <span>
                          Acked: {formatDistanceToNow(new Date(alert.acknowledgedAt), { addSuffix: true })}
                          {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                        </span>
                      )}
                      {alert.runbookUrl && (
                        <a
                          href={alert.runbookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Runbook
                        </a>
                      )}
                    </div>

                    {Object.keys(alert.tags).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(alert.tags).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {alert.status === "firing" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                    >
                      {acknowledgeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Acknowledge"
                      )}
                    </Button>
                  )}
                  {alert.status !== "resolved" && (
                    <Button
                      size="sm"
                      onClick={() => resolveMutation.mutate(alert.id)}
                      disabled={resolveMutation.isPending}
                    >
                      {resolveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Resolve"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {rules.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Alert Rules for this Application</h4>
            <Link href="/alerts?tab=rules">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Manage Rules
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      rule.enabled ? "bg-green-500" : "bg-gray-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium text-sm">{rule.name}</p>
                    <p className="text-xs text-gray-400">{rule.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">
                    Triggered {rule.triggerCount} times
                  </span>
                  {rule.lastTriggered && (
                    <span className="text-xs text-gray-500">
                      Last: {formatDistanceToNow(new Date(rule.lastTriggered), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
