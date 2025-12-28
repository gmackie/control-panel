"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Rocket,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  GitCommit,
  User,
  Calendar,
  Filter,
  ChevronRight,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";

interface Deployment {
  id: string;
  application: string;
  applicationSlug: string;
  environment: "production" | "staging" | "development";
  status: "success" | "failed" | "pending" | "rolling_back" | "rolled_back";
  version: string;
  commit?: {
    sha: string;
    message: string;
    author: string;
  };
  timestamp: string;
  duration?: number;
  replicas?: {
    ready: number;
    total: number;
  };
  previousVersion?: string;
  triggeredBy?: string;
  rollbackOf?: string;
}

export default function DeploymentTimelinePage() {
  const [filter, setFilter] = useState({
    environment: "all",
    status: "all",
    application: "",
    timeRange: "7d",
  });

  // Fetch deployments
  const { data: deploymentsData, isLoading, refetch } = useQuery({
    queryKey: ["deployment-timeline", filter],
    queryFn: async () => {
      // In a real app, this would fetch from the API with filters
      const response = await fetch(`/api/deployments?limit=50`);
      if (!response.ok) {
        // Return mock data if API not available
        return generateMockDeployments();
      }
      const data = await response.json();
      return data.deployments || generateMockDeployments();
    },
  });

  const deployments: Deployment[] = deploymentsData || [];

  // Filter deployments
  const filteredDeployments = deployments.filter((d) => {
    if (filter.environment !== "all" && d.environment !== filter.environment) return false;
    if (filter.status !== "all" && d.status !== filter.status) return false;
    if (filter.application && !d.application.toLowerCase().includes(filter.application.toLowerCase())) return false;
    return true;
  });

  // Group by date
  const groupedByDate = filteredDeployments.reduce((acc, deployment) => {
    const date = format(new Date(deployment.timestamp), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(deployment);
    return acc;
  }, {} as Record<string, Deployment[]>);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />;
      case "rolling_back":
        return <RotateCcw className="h-5 w-5 text-orange-500 animate-spin" />;
      case "rolled_back":
        return <RotateCcw className="h-5 w-5 text-orange-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="success">Success</Badge>;
      case "failed":
        return <Badge variant="error">Failed</Badge>;
      case "pending":
        return <Badge variant="warning">In Progress</Badge>;
      case "rolling_back":
        return <Badge variant="warning">Rolling Back</Badge>;
      case "rolled_back":
        return <Badge variant="secondary">Rolled Back</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEnvBadge = (env: string) => {
    switch (env) {
      case "production":
        return <Badge variant="error">{env}</Badge>;
      case "staging":
        return <Badge variant="warning">{env}</Badge>;
      case "development":
        return <Badge variant="secondary">{env}</Badge>;
      default:
        return <Badge variant="outline">{env}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/deployments" className="text-gray-400 hover:text-gray-200">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Deployment Timeline</h1>
          </div>
          <p className="text-gray-400">
            Visual history of all deployments across environments
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search applications..."
                value={filter.application}
                onChange={(e) => setFilter({ ...filter, application: e.target.value })}
                className="w-full"
              />
            </div>
            <Select
              value={filter.environment}
              onValueChange={(v) => setFilter({ ...filter, environment: v })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filter.status}
              onValueChange={(v) => setFilter({ ...filter, status: v })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rolled_back">Rolled Back</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filter.timeRange}
              onValueChange={(v) => setFilter({ ...filter, timeRange: v })}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase">Total Deployments</p>
              <p className="text-2xl font-bold">{filteredDeployments.length}</p>
            </div>
            <Rocket className="h-8 w-8 text-blue-500 opacity-20" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase">Success Rate</p>
              <p className="text-2xl font-bold text-green-500">
                {filteredDeployments.length > 0
                  ? Math.round(
                      (filteredDeployments.filter((d) => d.status === "success").length /
                        filteredDeployments.length) *
                        100
                    )
                  : 0}
                %
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase">Failed</p>
              <p className="text-2xl font-bold text-red-500">
                {filteredDeployments.filter((d) => d.status === "failed").length}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-500 opacity-20" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase">Rollbacks</p>
              <p className="text-2xl font-bold text-orange-500">
                {filteredDeployments.filter((d) => d.status === "rolled_back").length}
              </p>
            </div>
            <RotateCcw className="h-8 w-8 text-orange-500 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </Card>
      ) : filteredDeployments.length === 0 ? (
        <Card className="p-8">
          <div className="text-center text-gray-400">
            <Rocket className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No deployments found matching your filters</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByDate)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([date, dayDeployments]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(date), "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="flex-1 h-px bg-gray-800" />
                  <Badge variant="secondary">{dayDeployments.length} deployments</Badge>
                </div>

                {/* Deployments for this day */}
                <div className="relative pl-8 space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-800" />

                  {dayDeployments
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((deployment) => (
                      <div key={deployment.id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-5 top-4 w-4 h-4 rounded-full bg-gray-900 border-2 border-gray-700 flex items-center justify-center">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              deployment.status === "success"
                                ? "bg-green-500"
                                : deployment.status === "failed"
                                ? "bg-red-500"
                                : deployment.status === "pending"
                                ? "bg-yellow-500 animate-pulse"
                                : "bg-gray-500"
                            }`}
                          />
                        </div>

                        {/* Deployment Card */}
                        <Card className="hover:border-gray-700 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              {/* Left: Main info */}
                              <div className="flex items-start gap-3">
                                {getStatusIcon(deployment.status)}
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Link
                                      href={`/applications/${deployment.applicationSlug}`}
                                      className="font-medium hover:underline"
                                    >
                                      {deployment.application}
                                    </Link>
                                    {getEnvBadge(deployment.environment)}
                                    {getStatusBadge(deployment.status)}
                                    {deployment.rollbackOf && (
                                      <Badge variant="outline" className="text-orange-400">
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Rollback
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-400 mt-1">
                                    Deployed version{" "}
                                    <code className="text-xs bg-gray-800 px-1.5 py-0.5 rounded">
                                      {deployment.version}
                                    </code>
                                    {deployment.previousVersion && (
                                      <>
                                        {" "}from{" "}
                                        <code className="text-xs bg-gray-800 px-1.5 py-0.5 rounded">
                                          {deployment.previousVersion}
                                        </code>
                                      </>
                                    )}
                                  </p>
                                  {deployment.commit && (
                                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                                      <GitCommit className="h-3 w-3" />
                                      <code className="text-xs">{deployment.commit.sha.slice(0, 7)}</code>
                                      <span className="truncate max-w-[300px]">
                                        {deployment.commit.message}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right: Meta info */}
                              <div className="text-right text-sm text-gray-400 shrink-0">
                                <p className="font-mono">
                                  {format(new Date(deployment.timestamp), "HH:mm:ss")}
                                </p>
                                <p className="text-xs">
                                  {formatDistanceToNow(new Date(deployment.timestamp), {
                                    addSuffix: true,
                                  })}
                                </p>
                                {deployment.duration && (
                                  <p className="text-xs mt-1">
                                    Duration: {Math.round(deployment.duration / 1000)}s
                                  </p>
                                )}
                                {deployment.triggeredBy && (
                                  <div className="flex items-center justify-end gap-1 mt-1 text-xs">
                                    <User className="h-3 w-3" />
                                    {deployment.triggeredBy}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Replicas status */}
                            {deployment.replicas && deployment.status === "success" && (
                              <div className="mt-3 pt-3 border-t border-gray-800">
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                  <span>Replicas:</span>
                                  <span className={deployment.replicas.ready === deployment.replicas.total ? "text-green-500" : "text-yellow-500"}>
                                    {deployment.replicas.ready}/{deployment.replicas.total} ready
                                  </span>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// Generate mock deployments for demo
function generateMockDeployments(): Deployment[] {
  const apps = [
    { name: "Control Panel", slug: "control-panel" },
    { name: "Web App", slug: "web-app" },
    { name: "API Server", slug: "api-server" },
    { name: "Auth Service", slug: "auth-service" },
    { name: "Payments", slug: "payments" },
  ];

  const environments: Deployment["environment"][] = ["production", "staging", "development"];
  const statuses: Deployment["status"][] = ["success", "success", "success", "failed", "rolled_back"];
  const users = ["gmackie", "ci-bot", "deploy-bot"];

  const deployments: Deployment[] = [];
  const now = new Date();

  for (let i = 0; i < 25; i++) {
    const app = apps[Math.floor(Math.random() * apps.length)];
    const hoursAgo = Math.floor(Math.random() * 168); // Last 7 days
    const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    deployments.push({
      id: `deploy-${i}`,
      application: app.name,
      applicationSlug: app.slug,
      environment: environments[Math.floor(Math.random() * environments.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      version: `v1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 100)}`,
      commit: {
        sha: Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10),
        message: ["Fix bug in auth flow", "Add new feature", "Update dependencies", "Refactor code", "Performance improvements"][Math.floor(Math.random() * 5)],
        author: users[Math.floor(Math.random() * users.length)],
      },
      timestamp: timestamp.toISOString(),
      duration: Math.floor(Math.random() * 120000) + 30000,
      replicas: {
        ready: Math.floor(Math.random() * 3) + 1,
        total: 3,
      },
      triggeredBy: users[Math.floor(Math.random() * users.length)],
    });
  }

  return deployments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
