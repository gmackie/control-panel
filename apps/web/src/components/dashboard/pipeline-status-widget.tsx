"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  ExternalLink,
  GitBranch,
  GitCommit,
  Loader2,
  Package,
  Play,
  RefreshCw,
  Rocket,
  Server,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface PipelineRun {
  id: string;
  applicationId: string;
  applicationName?: string;
  workflowName: string;
  status: "pending" | "running" | "success" | "failure" | "cancelled";
  conclusion?: string;
  branch: string;
  event: string;
  triggeredBy?: string;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  url?: string;
}

interface Deployment {
  id: string;
  applicationId: string;
  applicationName?: string;
  environment: "staging" | "production";
  status: "pending" | "deploying" | "deployed" | "failed" | "rolled_back";
  imageTag: string;
  deployedBy?: string;
  createdAt: string;
  namespace?: string;
}

interface PipelineStats {
  success: boolean;
  data: {
    activePipelines: PipelineRun[];
    recentPipelines: PipelineRun[];
    recentDeployments: Deployment[];
    stats: {
      totalBuildsToday: number;
      successRate: number;
      avgBuildTime: number;
      deploymentsToday: number;
      stagingDeployments: number;
      productionDeployments: number;
    };
  };
  timestamp: string;
}

export function PipelineStatusWidget() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<PipelineStats>({
    queryKey: ["pipeline-status"],
    queryFn: async () => {
      const response = await fetch("/api/apps/metrics/pipelines");
      if (!response.ok) {
        // Return mock data if endpoint doesn't exist yet
        return {
          success: true,
          data: {
            activePipelines: [],
            recentPipelines: [],
            recentDeployments: [],
            stats: {
              totalBuildsToday: 0,
              successRate: 0,
              avgBuildTime: 0,
              deploymentsToday: 0,
              stagingDeployments: 0,
              productionDeployments: 0,
            },
          },
          timestamp: new Date().toISOString(),
        };
      }
      return response.json();
    },
    refetchInterval: 15000, // Refresh every 15 seconds for real-time updates
    retry: 1,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
      case "deployed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failure":
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
      case "deploying":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "pending":
        return <Clock className="h-4 w-4 text-gray-400" />;
      case "cancelled":
      case "rolled_back":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "success" | "error" | "warning" | "secondary" => {
    switch (status) {
      case "success":
      case "deployed":
        return "success";
      case "failure":
      case "failed":
        return "error";
      case "running":
      case "deploying":
        return "default";
      case "cancelled":
      case "rolled_back":
        return "warning";
      default:
        return "secondary";
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "-";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </Card>
    );
  }

  const stats = data?.data?.stats || {
    totalBuildsToday: 0,
    successRate: 0,
    avgBuildTime: 0,
    deploymentsToday: 0,
    stagingDeployments: 0,
    productionDeployments: 0,
  };

  const activePipelines = data?.data?.activePipelines || [];
  const recentPipelines = data?.data?.recentPipelines || [];
  const recentDeployments = data?.data?.recentDeployments || [];

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">CD Pipeline Status</h2>
          {activePipelines.length > 0 && (
            <Badge variant="default" className="ml-2">
              {activePipelines.length} Active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Link href="/pipeline">
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Builds Today</span>
          </div>
          <p className="text-xl font-bold">{stats.totalBuildsToday}</p>
        </div>
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-xs text-gray-400">Success Rate</span>
          </div>
          <p className="text-xl font-bold">{stats.successRate.toFixed(0)}%</p>
        </div>
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Avg Build Time</span>
          </div>
          <p className="text-xl font-bold">{formatDuration(stats.avgBuildTime)}</p>
        </div>
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Rocket className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-gray-400">Deployments</span>
          </div>
          <p className="text-xl font-bold">{stats.deploymentsToday}</p>
        </div>
      </div>

      {/* Active Pipelines */}
      {activePipelines.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Active Pipelines
          </h3>
          <div className="space-y-2">
            {activePipelines.slice(0, 3).map((pipeline) => (
              <div
                key={pipeline.id}
                className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    <span className="font-medium">
                      {pipeline.applicationName || pipeline.applicationId}
                    </span>
                    <Badge variant="default" className="text-xs">
                      {pipeline.workflowName}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <GitBranch className="h-3 w-3" />
                    {pipeline.branch}
                    {pipeline.url && (
                      <a
                        href={pipeline.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={50} className="h-1.5 flex-1" />
                  <span className="text-xs text-gray-500">
                    Started {formatDistanceToNow(new Date(pipeline.startedAt))} ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Pipelines */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Builds
          </h3>
          {recentPipelines.length > 0 ? (
            <div className="space-y-2">
              {recentPipelines.slice(0, 5).map((pipeline) => (
                <div
                  key={pipeline.id}
                  className="p-2 bg-gray-900/50 rounded flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(pipeline.status)}
                    <span className="text-sm truncate">
                      {pipeline.applicationName || pipeline.applicationId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={getStatusBadgeVariant(pipeline.status)}
                      className="text-xs"
                    >
                      {pipeline.status}
                    </Badge>
                    {pipeline.duration && (
                      <span className="text-xs text-gray-500">
                        {formatDuration(pipeline.duration)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-900/50 rounded text-center text-sm text-gray-500">
              No recent builds
            </div>
          )}
        </div>

        {/* Recent Deployments */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Recent Deployments
          </h3>
          {recentDeployments.length > 0 ? (
            <div className="space-y-2">
              {recentDeployments.slice(0, 5).map((deployment) => (
                <div
                  key={deployment.id}
                  className="p-2 bg-gray-900/50 rounded flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(deployment.status)}
                    <span className="text-sm truncate">
                      {deployment.applicationName || deployment.applicationId}
                    </span>
                    <Badge
                      variant={deployment.environment === "production" ? "error" : "warning"}
                      className="text-xs"
                    >
                      {deployment.environment}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">
                      {deployment.imageTag?.substring(0, 12)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-900/50 rounded text-center text-sm text-gray-500">
              No recent deployments
            </div>
          )}
        </div>
      </div>

      {/* Environment Status Footer */}
      <div className="mt-6 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-gray-400">Staging:</span>
              <span className="text-sm font-medium">{stats.stagingDeployments} today</span>
            </div>
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-400">Production:</span>
              <span className="text-sm font-medium">{stats.productionDeployments} today</span>
            </div>
          </div>
          <Link href="/deployments">
            <Button variant="ghost" size="sm" className="text-xs">
              View deployment history
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
