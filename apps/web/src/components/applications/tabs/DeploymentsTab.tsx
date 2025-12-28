"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Rocket, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  Server,
  Container,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DeploymentInfo } from "@/types/unified-app";

interface DeploymentsTabProps {
  appId: string;
}

export function DeploymentsTab({ appId }: DeploymentsTabProps) {
  const [deployingTo, setDeployingTo] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: DeploymentInfo[] }>({
    queryKey: ["app-deployments", appId],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/deployments`);
      if (!response.ok) throw new Error("Failed to fetch deployments");
      return response.json();
    },
  });

  const deployMutation = useMutation({
    mutationFn: async (environment: string) => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment }),
      });
      if (!response.ok) throw new Error("Failed to trigger deployment");
      return response.json();
    },
    onSuccess: () => {
      setDeployingTo(null);
      refetch();
    },
    onError: () => {
      setDeployingTo(null);
    },
  });

  const deployments = data?.data || [];

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
        <p className="text-red-400">Failed to load deployments</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge variant="default" className="bg-green-600">Healthy</Badge>;
      case "degraded":
        return <Badge variant="default" className="bg-yellow-600">Degraded</Badge>;
      case "unhealthy":
        return <Badge variant="error">Unhealthy</Badge>;
      case "not_deployed":
        return <Badge variant="secondary">Not Deployed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEnvBadge = (env: string) => {
    switch (env) {
      case "production":
        return <Badge variant="error">Production</Badge>;
      case "staging":
        return <Badge variant="default" className="bg-yellow-600">Staging</Badge>;
      default:
        return <Badge variant="secondary">{env}</Badge>;
    }
  };

  const handleDeploy = (environment: string) => {
    setDeployingTo(environment);
    deployMutation.mutate(environment);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Deployments</h3>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleDeploy("staging")}
            disabled={!!deployingTo}
          >
            {deployingTo === "staging" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            Deploy to Staging
          </Button>
          <Button 
            size="sm" 
            onClick={() => handleDeploy("production")}
            disabled={!!deployingTo}
          >
            {deployingTo === "production" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            Deploy to Production
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {deployments.length === 0 ? (
        <Card className="p-6 text-center">
          <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No deployments found</p>
          <p className="text-sm text-gray-500 mt-2">
            Deploy your application to see it here
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {deployments.map((deployment) => (
            <Card key={`${deployment.namespace}-${deployment.name}`} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(deployment.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{deployment.name}</span>
                      {getEnvBadge(deployment.environment)}
                    </div>
                    <p className="text-sm text-gray-400">{deployment.namespace}</p>
                  </div>
                </div>
                {getStatusBadge(deployment.status)}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Replicas</p>
                  <p className="font-medium">
                    {deployment.readyReplicas}/{deployment.replicas}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Available</p>
                  <p className="font-medium">{deployment.availableReplicas || 0}</p>
                </div>
                <div>
                  <p className="text-gray-400">Version</p>
                  <p className="font-medium font-mono text-xs">
                    {deployment.currentVersion || "—"}
                  </p>
                </div>
              </div>

              {deployment.currentImage && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-400">Image</p>
                  <p className="text-xs font-mono truncate">{deployment.currentImage}</p>
                </div>
              )}

              {deployment.lastDeployedAt && (
                <div className="mt-2 text-xs text-gray-500">
                  Last deployed {formatDistanceToNow(new Date(deployment.lastDeployedAt), { addSuffix: true })}
                </div>
              )}

              {/* Pods */}
              {deployment.pods && deployment.pods.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-800">
                  <p className="text-sm text-gray-400 mb-2">Pods</p>
                  <div className="space-y-2">
                    {deployment.pods.map((pod) => (
                      <div key={pod.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Container className="h-3 w-3 text-gray-400" />
                          <span className="font-mono text-xs truncate max-w-[200px]">{pod.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {pod.ready ? (
                            <Badge variant="default" className="bg-green-600 text-xs">Ready</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{pod.status}</Badge>
                          )}
                          {pod.restarts > 0 && (
                            <span className="text-xs text-yellow-500">{pod.restarts} restarts</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
