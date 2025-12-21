"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  GitCommit, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CommitInfo } from "@/types/unified-app";

interface CommitsTabProps {
  appId: string;
}

export function CommitsTab({ appId }: CommitsTabProps) {
  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: CommitInfo[] }>({
    queryKey: ["app-commits", appId],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/commits?limit=50`);
      if (!response.ok) throw new Error("Failed to fetch commits");
      return response.json();
    },
  });

  const commits = data?.data || [];

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
        <p className="text-red-400">Failed to load commits</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  const getPipelineStatusIcon = (status?: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failure":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getPipelineStatusBadge = (status?: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-600">Passed</Badge>;
      case "failure":
        return <Badge variant="error">Failed</Badge>;
      case "running":
        return <Badge variant="default" className="bg-blue-600">Running</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Commit History</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {commits.length === 0 ? (
        <Card className="p-6 text-center">
          <GitCommit className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No commits found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {commits.map((commit, index) => (
            <Card key={commit.sha} className="p-4 hover:bg-gray-900/50 transition-colors">
              <div className="flex items-start gap-4">
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                    {getPipelineStatusIcon(commit.pipelineStatus?.status) || (
                      <GitCommit className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  {index < commits.length - 1 && (
                    <div className="w-0.5 h-8 bg-gray-700 mt-2" />
                  )}
                </div>

                {/* Commit info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{commit.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                        <code className="bg-gray-800 px-2 py-0.5 rounded text-xs">
                          {commit.shortSha}
                        </code>
                        <span>by {commit.author.name}</span>
                        <span>•</span>
                        <span>
                          {commit.timestamp 
                            ? formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })
                            : "Unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getPipelineStatusBadge(commit.pipelineStatus?.status)}
                      {commit.url && (
                        <a href={commit.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pipeline details */}
                  {commit.pipelineStatus && (
                    <div className="mt-2 text-sm text-gray-400">
                      {commit.pipelineStatus.workflowName} #{commit.pipelineStatus.runNumber}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
