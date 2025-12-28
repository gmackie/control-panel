"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  RefreshCw,
  Timer,
  GitBranch,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PipelineRun } from "@/types/unified-app";

interface PipelinesTabProps {
  appId: string;
}

export function PipelinesTab({ appId }: PipelinesTabProps) {
  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: PipelineRun[] }>({
    queryKey: ["app-pipelines", appId],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/pipelines?limit=20`);
      if (!response.ok) throw new Error("Failed to fetch pipelines");
      return response.json();
    },
  });

  const pipelines = data?.data || [];

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
        <p className="text-red-400">Failed to load pipelines</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  const getStatusIcon = (status: string, conclusion?: string) => {
    if (status === "in_progress" || status === "running") {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    if (status === "queued" || status === "pending" || status === "waiting") {
      return <Clock className="h-5 w-5 text-yellow-500" />;
    }
    if (conclusion === "success") {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (conclusion === "failure") {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return <Clock className="h-5 w-5 text-gray-500" />;
  };

  const getStatusBadge = (status: string, conclusion?: string) => {
    if (status === "in_progress" || status === "running") {
      return <Badge variant="default" className="bg-blue-600">Running</Badge>;
    }
    if (status === "queued" || status === "pending" || status === "waiting") {
      return <Badge variant="secondary">Pending</Badge>;
    }
    if (conclusion === "success") {
      return <Badge variant="default" className="bg-green-600">Success</Badge>;
    }
    if (conclusion === "failure") {
        return <Badge variant="error">Failed</Badge>;
    }
    if (conclusion === "cancelled") {
      return <Badge variant="secondary">Cancelled</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">CI/CD Pipelines</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {pipelines.length === 0 ? (
        <Card className="p-6 text-center">
          <Play className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No pipeline runs found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id} className="p-4 hover:bg-gray-900/50 transition-colors">
              <div className="flex items-center gap-4">
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {getStatusIcon(pipeline.status, pipeline.conclusion)}
                </div>

                {/* Pipeline info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pipeline.workflowName}</span>
                    <span className="text-gray-400">#{pipeline.runNumber}</span>
                    {getStatusBadge(pipeline.status, pipeline.conclusion)}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      <span>{pipeline.branch}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                        {pipeline.commitSha?.substring(0, 7)}
                      </code>
                    </div>
                    {pipeline.triggeredBy && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{pipeline.triggeredBy}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration and time */}
                <div className="flex-shrink-0 text-right text-sm">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Timer className="h-3 w-3" />
                    <span>{formatDuration(pipeline.duration)}</span>
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    {pipeline.startedAt 
                      ? formatDistanceToNow(new Date(pipeline.startedAt), { addSuffix: true })
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Pipeline stages */}
              {pipeline.stages && pipeline.stages.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <div className="flex items-center gap-2">
                    {pipeline.stages.map((stage, index) => (
                      <div key={stage.name} className="flex items-center">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800 text-xs">
                          {stage.status === "success" && <CheckCircle className="h-3 w-3 text-green-500" />}
                          {stage.status === "failure" && <XCircle className="h-3 w-3 text-red-500" />}
                          {stage.status === "running" && <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />}
                          {(stage.status === "pending" || stage.status === "skipped") && <Clock className="h-3 w-3 text-gray-500" />}
                          <span>{stage.name}</span>
                        </div>
                        {index < pipeline.stages.length - 1 && (
                          <div className="w-4 h-0.5 bg-gray-700" />
                        )}
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
