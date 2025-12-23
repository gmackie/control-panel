"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  GitBranch,
  GitCommit,
  ExternalLink,
  RefreshCw,
  Rocket,
  Server,
  Package,
  BarChart3,
  Activity,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface EnvironmentInfo {
  environment: string;
  status: string;
  currentCommitSha: string | null;
  currentCommitMessage: string | null;
  currentImageTag: string | null;
  replicas: number;
  readyReplicas: number;
  lastDeployedAt: string | null;
  lastDeployedBy: string | null;
  url: string | null;
}

interface AppDashboardData {
  success: boolean;
  data: {
    app: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      repositoryUrl: string | null;
      repositoryFullName: string | null;
      defaultBranch: string | null;
      language: string | null;
      framework: string | null;
      status: string;
      createdAt: string;
      updatedAt: string;
    };
    environments: EnvironmentInfo[];
    metrics: {
      totalCommits: number;
      totalDeployments: number;
      totalPipelines: number;
      successRate: number;
      lastActivityAt: string | null;
    };
    externalLinks: {
      gitea: string;
      harbor: string;
      grafana: string;
    };
    screenshotUrl: string | null;
  };
}

export default function AppDashboardPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);

  const { data, isLoading, error, refetch, isFetching } = useQuery<AppDashboardData>({
    queryKey: ["app-dashboard", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(params.id)}/dashboard`);
      if (!response.ok) throw new Error("Failed to fetch dashboard");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "deployed":
      case "running":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "unhealthy":
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "deploying":
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "deployed":
      case "running":
        return "bg-green-500/10 border-green-500/20 text-green-400";
      case "degraded":
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
      case "unhealthy":
      case "failed":
        return "bg-red-500/10 border-red-500/20 text-red-400";
      case "deploying":
        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
      default:
        return "bg-gray-500/10 border-gray-500/20 text-gray-400";
    }
  };

  const getEnvBadgeVariant = (env: string): "default" | "warning" | "error" | "secondary" => {
    switch (env) {
      case "production":
        return "error";
      case "staging":
        return "warning";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-48 bg-gray-800 rounded"></div>
            <div className="h-48 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Dashboard not available</h2>
          <p className="text-gray-400 mb-4">
            Could not load the dashboard for this application.
          </p>
          <Link href="/applications">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Applications
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { app, environments, metrics, externalLinks, screenshotUrl } = data.data;

  // Sort environments: production first, then staging
  const sortedEnvs = [...environments].sort((a, b) => {
    if (a.environment === "production") return -1;
    if (b.environment === "production") return 1;
    if (a.environment === "staging") return -1;
    if (b.environment === "staging") return 1;
    return 0;
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/applications" className="text-gray-400 hover:text-gray-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{app.name}</h1>
            <p className="text-gray-400 mt-1">
              {app.description || app.repositoryFullName || app.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {app.language || "Unknown"}
          </Badge>
          {app.framework && (
            <Badge variant="secondary" className="text-xs">
              {app.framework}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Screenshot & External Links */}
        <div className="lg:col-span-1 space-y-6">
          {/* Live Screenshot */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Live Preview
              </h2>
              {sortedEnvs.find(e => e.environment === "production")?.url && (
                <a
                  href={sortedEnvs.find(e => e.environment === "production")!.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  Visit Site
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
              {screenshotUrl ? (
                <img
                  src={screenshotUrl}
                  alt={`${app.name} screenshot`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No preview available</p>
                    <p className="text-xs text-gray-500 mt-1">Deploy to production to see preview</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* External Links */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Quick Links
            </h2>
            <div className="space-y-2">
              <a
                href={externalLinks.gitea}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <GitBranch className="h-5 w-5 text-orange-400" />
                  <div>
                    <p className="font-medium">Gitea Repository</p>
                    <p className="text-xs text-gray-500">View code & commits</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-gray-300" />
              </a>

              <a
                href={externalLinks.harbor}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="font-medium">Harbor Registry</p>
                    <p className="text-xs text-gray-500">Container images</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-gray-300" />
              </a>

              <a
                href={externalLinks.grafana}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="font-medium">Grafana Dashboard</p>
                    <p className="text-xs text-gray-500">Metrics & logs</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-gray-300" />
              </a>
            </div>
          </Card>

          {/* Quick Metrics */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Quick Stats
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-900/50 rounded-lg">
                <p className="text-2xl font-bold">{metrics.totalPipelines}</p>
                <p className="text-xs text-gray-500">Total Pipelines</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-lg">
                <p className="text-2xl font-bold">{metrics.successRate}%</p>
                <p className="text-xs text-gray-500">Success Rate</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-lg">
                <p className="text-2xl font-bold">{metrics.totalDeployments}</p>
                <p className="text-xs text-gray-500">Deployments</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-lg">
                <p className="text-2xl font-bold">{metrics.totalCommits}</p>
                <p className="text-xs text-gray-500">Commits</p>
              </div>
            </div>
            {metrics.lastActivityAt && (
              <p className="text-xs text-gray-500 mt-3 text-center">
                Last activity {formatDistanceToNow(new Date(metrics.lastActivityAt), { addSuffix: true })}
              </p>
            )}
          </Card>
        </div>

        {/* Right Column - Environment Status Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Environment Cards */}
          {sortedEnvs.map((env) => (
            <Card
              key={env.environment}
              className={`p-6 border-2 ${getStatusColor(env.status)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(env.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold capitalize">{env.environment}</h2>
                      <Badge variant={getEnvBadgeVariant(env.environment)}>
                        {env.status}
                      </Badge>
                    </div>
                    {env.url && (
                      <a
                        href={env.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                      >
                        {env.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm">
                    <Server className="h-4 w-4 text-gray-400" />
                    <span className={env.readyReplicas === env.replicas ? "text-green-400" : "text-yellow-400"}>
                      {env.readyReplicas}/{env.replicas} replicas
                    </span>
                  </div>
                </div>
              </div>

              {/* Deployed Commit Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current Deployment */}
                <div className="p-4 bg-black/20 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <GitCommit className="h-4 w-4" />
                    Deployed Commit
                  </h3>
                  {env.currentCommitSha || env.currentCommitMessage ? (
                    <div>
                      {env.currentCommitSha && (
                        <code className="text-sm font-mono bg-gray-800 px-2 py-1 rounded">
                          {env.currentCommitSha.substring(0, 7)}
                        </code>
                      )}
                      {env.currentCommitMessage && (
                        <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                          {env.currentCommitMessage}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No commit info available</p>
                  )}
                </div>

                {/* Image & Deployment Info */}
                <div className="p-4 bg-black/20 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Rocket className="h-4 w-4" />
                    Deployment Info
                  </h3>
                  {env.currentImageTag && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500">Image Tag</p>
                      <code className="text-sm font-mono">
                        {env.currentImageTag.length > 20
                          ? `${env.currentImageTag.substring(0, 20)}...`
                          : env.currentImageTag}
                      </code>
                    </div>
                  )}
                  {env.lastDeployedAt && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500">Deployed</p>
                      <p className="text-sm">
                        {formatDistanceToNow(new Date(env.lastDeployedAt), { addSuffix: true })}
                      </p>
                    </div>
                  )}
                  {env.lastDeployedBy && (
                    <div>
                      <p className="text-xs text-gray-500">By</p>
                      <p className="text-sm">{env.lastDeployedBy}</p>
                    </div>
                  )}
                  {!env.currentImageTag && !env.lastDeployedAt && (
                    <p className="text-sm text-gray-500">Not deployed</p>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800">
                <Button variant="outline" size="sm">
                  <Rocket className="h-4 w-4 mr-2" />
                  Deploy
                </Button>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rollback
                </Button>
                {env.url && (
                  <a href={env.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </Button>
                  </a>
                )}
                <Link href={`/applications/${params.id}`}>
                  <Button variant="ghost" size="sm" className="ml-auto">
                    View Details
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}

          {/* Recent Activity Summary */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-400" />
                Application Overview
              </h2>
              <Link href={`/applications/${params.id}`}>
                <Button variant="outline" size="sm">
                  Full Details
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                <GitBranch className="h-6 w-6 mx-auto mb-2 text-orange-400" />
                <p className="text-sm font-medium">{app.defaultBranch || "main"}</p>
                <p className="text-xs text-gray-500">Default Branch</p>
              </div>
              
              <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                <Server className="h-6 w-6 mx-auto mb-2 text-blue-400" />
                <p className="text-sm font-medium">{sortedEnvs.filter(e => e.status === "healthy").length}/{sortedEnvs.length}</p>
                <p className="text-xs text-gray-500">Healthy Envs</p>
              </div>
              
              <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                <Rocket className="h-6 w-6 mx-auto mb-2 text-green-400" />
                <p className="text-sm font-medium capitalize">{app.status}</p>
                <p className="text-xs text-gray-500">Overall Status</p>
              </div>
              
              <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                <Clock className="h-6 w-6 mx-auto mb-2 text-purple-400" />
                <p className="text-sm font-medium">
                  {app.updatedAt
                    ? formatDistanceToNow(new Date(app.updatedAt), { addSuffix: false })
                    : "—"}
                </p>
                <p className="text-xs text-gray-500">Last Updated</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
