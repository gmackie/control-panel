"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Bug, 
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  RefreshCw,
  Users,
  TrendingUp,
} from "lucide-react";
import { ErrorMetrics } from "@/types/unified-app";

export function ErrorsTab() {
  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: ErrorMetrics | null }>({
    queryKey: ["app-errors"],
    queryFn: async () => {
      const response = await fetch("/api/apps/metrics/errors");
      if (!response.ok) throw new Error("Failed to fetch errors");
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
        <p className="text-red-400">Failed to load error metrics</p>
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
        <Bug className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Sentry integration not configured</p>
        <p className="text-sm text-gray-500 mt-2">
          Configure Sentry to see error tracking data
        </p>
      </Card>
    );
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "fatal":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "warning":
        return <Info className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "fatal":
        return <Badge variant="error">Fatal</Badge>;
      case "error":
        return <Badge variant="warning">Error</Badge>;
      case "warning":
        return <Badge variant="secondary">Warning</Badge>;
      default:
        return <Badge variant="secondary">{level}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Error Tracking (Sentry)</h3>
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
              <p className="text-sm text-gray-400">Total Issues</p>
              <p className="text-2xl font-bold">{metrics.totalIssues}</p>
            </div>
            <Bug className="h-8 w-8 text-gray-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unresolved</p>
              <p className="text-2xl font-bold text-red-400">{metrics.unresolvedIssues}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">New (24h)</p>
              <p className="text-2xl font-bold text-yellow-400">{metrics.newIssues24h}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Affected Users</p>
              <p className="text-2xl font-bold">{metrics.affectedUsers}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Severity breakdown */}
      <Card className="p-4">
        <h4 className="font-medium mb-4">Issues by Severity</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-gray-400">Critical/Fatal</p>
              <p className="text-xl font-bold">{metrics.critical}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-gray-400">Error</p>
              <p className="text-xl font-bold">{metrics.error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-400">Warning</p>
              <p className="text-xl font-bold">{metrics.warning}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Top Issues */}
      {metrics.topIssues && metrics.topIssues.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Top Issues</h4>
          {metrics.topIssues.map((issue) => (
            <Card key={issue.id} className="p-4 hover:bg-gray-900/50 transition-colors">
              <div className="flex items-start gap-3">
                {getLevelIcon(issue.level)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{issue.title}</span>
                    {getLevelBadge(issue.level)}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                    <span>{issue.shortId}</span>
                    <span>{issue.count} events</span>
                    <span>{issue.userCount} users affected</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
