"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  GitCommit,
  Rocket,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Box,
  Cpu,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { Deployment, Pod } from "@/types/deployments";
import { PipelineView } from "./PipelineView";
import { PodsList } from "./PodsList";

interface DeploymentsListProps {
  applicationId: string;
}

export function DeploymentsList({ applicationId }: DeploymentsListProps) {
  const [environment, setEnvironment] = useState<"staging" | "production">("production");

  const { data: deployments, isLoading, refetch } = useQuery<Deployment[]>({
    queryKey: ["deployments", applicationId, environment],
    queryFn: async () => {
      const response = await fetch(
        `/api/applications/${applicationId}/deployments?environment=${environment}`
      );
      if (!response.ok) throw new Error("Failed to fetch deployments");
      return response.json();
    },
  });

  const latestDeployment = deployments?.[0];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
      case "building":
      case "deploying":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "success";
      case "failed":
        return "error";
      case "pending":
      case "building":
      case "deploying":
        return "secondary";
      default:
        return "default";
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "success";
      case "degraded":
        return "warning";
      case "unhealthy":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={environment} onValueChange={(v) => setEnvironment(v as any)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="staging">Staging</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Rocket className="h-4 w-4 mr-2" />
              Deploy
            </Button>
          </div>
        </div>

        <TabsContent value={environment} className="space-y-6 mt-0">
          {/* Current Deployment */}
          {latestDeployment && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Current Deployment</h3>
                <Badge variant={getHealthColor(latestDeployment.health.status) as any}>
                  {latestDeployment.health.status}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Version</p>
                  <p className="font-medium">{latestDeployment.version}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {latestDeployment.imageTag}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Commit</p>
                  <div className="flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-gray-500" />
                    <code className="text-sm">{latestDeployment.commitSha.slice(0, 8)}</code>
                  </div>
                  {latestDeployment.commitMessage && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {latestDeployment.commitMessage}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(latestDeployment.status)}
                    <span className="capitalize">{latestDeployment.status}</span>
                  </div>
                  {latestDeployment.deployedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Deployed {new Date(latestDeployment.deployedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-400">Pods</p>
                  <p className="font-medium">{latestDeployment.pods.length} running</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {latestDeployment.pods.filter(p => p.ready).length} / {latestDeployment.pods.length} ready
                  </p>
                </div>
              </div>

              {/* Pod Status Summary */}
              <div className="mt-6 pt-6 border-t border-gray-800">
                <h4 className="font-medium mb-3">Pod Health</h4>
                <PodsList 
                  deploymentId={latestDeployment.id} 
                  pods={latestDeployment.pods}
                />
              </div>
            </Card>
          )}

          {/* Deployment History */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Deployment History</h3>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-800 rounded"></div>
                ))}
              </div>
            ) : deployments && deployments.length > 0 ? (
              <div className="space-y-3">
                {deployments.map((deployment) => (
                  <div
                    key={deployment.id}
                    className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-900/50 transition-colors cursor-pointer"
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(deployment.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{deployment.version}</span>
                        <Badge variant={getStatusColor(deployment.status) as any} className="text-xs">
                          {deployment.status}
                        </Badge>
                        <code className="text-xs text-gray-500">
                          {deployment.commitSha.slice(0, 8)}
                        </code>
                      </div>
                      {deployment.commitMessage && (
                        <p className="text-sm text-gray-400 mt-1">
                          {deployment.commitMessage}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(deployment.createdAt).toLocaleString()}
                        </span>
                        {deployment.deployedBy && (
                          <span>by {deployment.deployedBy}</span>
                        )}
                        {deployment.pipeline.duration && (
                          <span>{Math.round(deployment.pipeline.duration / 60)}m duration</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        View Pipeline
                      </Button>
                      {deployment.status === "running" && (
                        <Button variant="ghost" size="sm">
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Rocket className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No deployments yet</h3>
                <p className="text-gray-400 mb-4">
                  Deploy your application to {environment}
                </p>
                <Button>
                  <Rocket className="h-4 w-4 mr-2" />
                  Create First Deployment
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}