"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  GitBranch,
  GitCommit,
  PlayCircle,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Settings,
  Shield,
  Activity,
  DollarSign,
  Server,
  Layers,
  FileCode,
} from "lucide-react";
import { UnifiedApplication, ApplicationDeployment } from "@/lib/infrastructure/types";
import { formatDistanceToNow } from "date-fns";

interface UnifiedApplicationViewProps {
  applicationId: string;
}

export function UnifiedApplicationView({ applicationId }: UnifiedApplicationViewProps) {
  const [selectedDeployment, setSelectedDeployment] = useState<string>();

  const { data: app, isLoading, refetch } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${applicationId}/unified`);
      if (!response.ok) throw new Error("Failed to fetch application");
      return response.json() as Promise<UnifiedApplication>;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-32 bg-gray-800 rounded" />
        <div className="animate-pulse h-64 bg-gray-800 rounded" />
      </div>
    );
  }

  if (!app) {
    return (
      <Card className="p-6">
        <p className="text-gray-400">Application not found</p>
      </Card>
    );
  }

  const deployment = selectedDeployment
    ? app.deployments.find((d) => d.id === selectedDeployment)
    : app.deployments[0];

  return (
    <div className="space-y-6">
      {/* Application Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              {app.name}
              <Badge variant="secondary">{app.type}</Badge>
            </h2>
            {app.description && (
              <p className="text-gray-400 mt-1">{app.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {app.language && (
                <span className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  {app.language}
                </span>
              )}
              {app.framework && (
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {app.framework}
                </span>
              )}
              <span>
                Updated {formatDistanceToNow(new Date(app.updated))} ago
              </span>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Deployment Selector */}
        {app.deployments.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-400">Deployments:</span>
            {app.deployments.map((dep) => (
              <Button
                key={dep.id}
                variant={selectedDeployment === dep.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDeployment(dep.id)}
                className="gap-2"
              >
                <Server className="h-3 w-3" />
                {dep.infrastructureType === "k3s" ? "K3s" : "Gitea VPS"}
                <Badge
                  variant={
                    dep.status === "running"
                      ? "success"
                      : dep.status === "failed"
                      ? "error"
                      : "warning"
                  }
                >
                  {dep.environment}
                </Badge>
              </Button>
            ))}
          </div>
        )}
      </Card>

      {deployment && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="git">Git & CI/CD</TabsTrigger>
            <TabsTrigger value="registry">Registry</TabsTrigger>
            <TabsTrigger value="runtime">Runtime</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Card */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Status</span>
                  {deployment.status === "running" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : deployment.status === "failed" ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <p className="text-2xl font-bold capitalize">{deployment.status}</p>
                <p className="text-sm text-gray-500">
                  {deployment.environment} environment
                </p>
              </Card>

              {/* Version Card */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Version</span>
                  <Package className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold font-mono">{deployment.version}</p>
                <p className="text-sm text-gray-500">
                  Deployed {formatDistanceToNow(new Date(deployment.updated))} ago
                </p>
              </Card>

              {/* Infrastructure Card */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Infrastructure</span>
                  <Server className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold">
                  {deployment.infrastructureType === "k3s" ? "K3s Cluster" : "Gitea VPS"}
                </p>
                {deployment.url && (
                  <a
                    href={deployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Visit app
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Card>

              {/* Cost Card */}
              {app.cost && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Monthly Cost</span>
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold">
                    ${app.cost.total.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1 text-sm">
                    <span
                      className={
                        app.cost.trend === "up"
                          ? "text-red-500"
                          : app.cost.trend === "down"
                          ? "text-green-500"
                          : "text-gray-500"
                      }
                    >
                      {app.cost.trend === "up" ? "↑" : app.cost.trend === "down" ? "↓" : "→"}
                    </span>
                    <span className="text-gray-500">vs last month</span>
                  </div>
                </Card>
              )}
            </div>

            {/* Quick Actions */}
            <Card className="p-4">
              <h3 className="font-medium mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Redeploy
                </Button>
                <Button size="sm" variant="outline">
                  <GitBranch className="h-4 w-4 mr-2" />
                  Change Branch
                </Button>
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
                <Button size="sm" variant="outline" className="text-red-500">
                  Stop Application
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="git" className="space-y-4">
            {/* Repository Info */}
            {app.repository && (
              <Card className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Repository
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Provider:</span>
                    <span className="capitalize">{app.repository.provider}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">URL:</span>
                    <a
                      href={app.repository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm flex items-center gap-1"
                    >
                      {app.repository.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Default Branch:</span>
                    <Badge variant="secondary">{app.repository.defaultBranch}</Badge>
                  </div>
                  {app.repository.lastCommit && (
                    <div className="mt-3 p-3 bg-gray-900 rounded">
                      <div className="flex items-start gap-2">
                        <GitCommit className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-mono">
                            {app.repository.lastCommit.sha.substring(0, 7)}
                          </p>
                          <p className="text-sm text-gray-300 mt-1">
                            {app.repository.lastCommit.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            by {app.repository.lastCommit.author} •{" "}
                            {formatDistanceToNow(new Date(app.repository.lastCommit.date))} ago
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* CI/CD Info */}
            {deployment.cicd && (
              <Card className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  CI/CD Pipeline
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Provider:</span>
                    <span className="capitalize">
                      {deployment.cicd.provider.replace("-", " ")}
                    </span>
                  </div>
                  {deployment.cicd.workflowId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Workflow:</span>
                      <span>{deployment.cicd.workflowId}</span>
                    </div>
                  )}
                  {deployment.cicd.runId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Run ID:</span>
                      <span>#{deployment.cicd.runId}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Status:</span>
                    <Badge
                      variant={
                        deployment.cicd.conclusion === "success"
                          ? "success"
                          : deployment.cicd.conclusion === "failure"
                          ? "error"
                          : "warning"
                      }
                    >
                      {deployment.cicd.status}
                    </Badge>
                  </div>
                  {deployment.cicd.duration && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Duration:</span>
                      <span>{Math.round(deployment.cicd.duration / 1000)}s</span>
                    </div>
                  )}
                </div>
                <Button className="w-full mt-3" variant="outline" size="sm">
                  View Logs
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="registry" className="space-y-4">
            {deployment.registry ? (
              <Card className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Container Registry
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Provider:</span>
                    <span className="capitalize">{deployment.registry.provider}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Image:</span>
                    <code className="text-sm bg-gray-900 px-2 py-1 rounded">
                      {deployment.registry.image}:{deployment.registry.tag}
                    </code>
                  </div>
                  {deployment.registry.digest && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Digest:</span>
                      <code className="text-xs font-mono">
                        {deployment.registry.digest.substring(0, 12)}...
                      </code>
                    </div>
                  )}
                  {deployment.registry.size && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Size:</span>
                      <span>{(deployment.registry.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                  )}
                  {deployment.registry.layers && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Layers:</span>
                      <span>{deployment.registry.layers}</span>
                    </div>
                  )}
                </div>

                {deployment.registry.vulnerabilities && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Security Scan
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 bg-red-500/10 rounded">
                        <p className="text-2xl font-bold text-red-500">
                          {deployment.registry.vulnerabilities.critical}
                        </p>
                        <p className="text-xs text-gray-400">Critical</p>
                      </div>
                      <div className="text-center p-2 bg-orange-500/10 rounded">
                        <p className="text-2xl font-bold text-orange-500">
                          {deployment.registry.vulnerabilities.high}
                        </p>
                        <p className="text-xs text-gray-400">High</p>
                      </div>
                      <div className="text-center p-2 bg-yellow-500/10 rounded">
                        <p className="text-2xl font-bold text-yellow-500">
                          {deployment.registry.vulnerabilities.medium}
                        </p>
                        <p className="text-xs text-gray-400">Medium</p>
                      </div>
                      <div className="text-center p-2 bg-gray-500/10 rounded">
                        <p className="text-2xl font-bold text-gray-500">
                          {deployment.registry.vulnerabilities.low}
                        </p>
                        <p className="text-xs text-gray-400">Low</p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-6 text-center text-gray-400">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No registry information available</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="runtime" className="space-y-4">
            {deployment.runtime ? (
              <>
                <Card className="p-4">
                  <h3 className="font-medium mb-3">Resource Usage</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">CPU</span>
                        <span className="text-sm">
                          {deployment.runtime.cpu.usage} / {deployment.runtime.cpu.limit} cores
                        </span>
                      </div>
                      <Progress
                        value={(deployment.runtime.cpu.usage / deployment.runtime.cpu.limit) * 100}
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">Memory</span>
                        <span className="text-sm">
                          {deployment.runtime.memory.usage} / {deployment.runtime.memory.limit} MB
                        </span>
                      </div>
                      <Progress
                        value={
                          (deployment.runtime.memory.usage / deployment.runtime.memory.limit) * 100
                        }
                        className="h-2"
                      />
                    </div>
                    {deployment.runtime.storage && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-400">Storage</span>
                          <span className="text-sm">
                            {deployment.runtime.storage.usage} / {deployment.runtime.storage.size} GB
                          </span>
                        </div>
                        <Progress
                          value={
                            (deployment.runtime.storage.usage / deployment.runtime.storage.size) *
                            100
                          }
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-medium mb-3">Replicas</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Running Instances:</span>
                    <span className="text-2xl font-bold">{deployment.runtime.replicas}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline">
                      Scale Up
                    </Button>
                    <Button size="sm" variant="outline">
                      Scale Down
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-6 text-center text-gray-400">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No runtime information available</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            {app.monitoring ? (
              <>
                <Card className="p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Monitoring
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Provider:</span>
                      <span className="capitalize">{app.monitoring.provider}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Status:</span>
                      <Badge variant={app.monitoring.enabled ? "success" : "secondary"}>
                        {app.monitoring.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    {app.monitoring.dashboardUrl && (
                      <Button
                        className="w-full mt-2"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(app.monitoring!.dashboardUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Dashboard
                      </Button>
                    )}
                  </div>
                </Card>

                {app.monitoring.alerts.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Active Alerts</h3>
                    <div className="space-y-2">
                      {app.monitoring.alerts.map((alert, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-2 bg-gray-900 rounded"
                        >
                          {alert.status === "firing" ? (
                            <AlertCircle
                              className={`h-4 w-4 mt-0.5 ${
                                alert.severity === "critical"
                                  ? "text-red-500"
                                  : alert.severity === "warning"
                                  ? "text-yellow-500"
                                  : "text-blue-500"
                              }`}
                            />
                          ) : (
                            <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{alert.name}</p>
                            <p className="text-sm text-gray-400">{alert.message}</p>
                          </div>
                          <Badge
                            variant={
                              alert.severity === "critical"
                                ? "error"
                                : alert.severity === "warning"
                                ? "warning"
                                : "default"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-6 text-center text-gray-400">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Monitoring not configured</p>
                <Button className="mt-4" variant="outline">
                  Enable Monitoring
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}