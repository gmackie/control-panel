"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  GitCommit, 
  Rocket, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  Activity,
  Clock,
  Tag,
  GitPullRequest,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: "commit" | "deployment" | "pipeline" | "release" | "alert";
  action: string;
  message: string;
  actor?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  status?: "success" | "failure" | "pending" | "running";
}

interface ActivityTabProps {
  appId: string;
}

export function ActivityTab({ appId }: ActivityTabProps) {
  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: ActivityItem[] }>({
    queryKey: ["app-activity", appId],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/activity?limit=50`);
      if (!response.ok) throw new Error("Failed to fetch activity");
      return response.json();
    },
    refetchInterval: 15000, // Refresh every 15 seconds for real-time updates
  });

  const activities = data?.data || [];

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
        <p className="text-red-400">Failed to load activity</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  const getActivityIcon = (type: string, status?: string) => {
    switch (type) {
      case "commit":
        return <GitCommit className="h-4 w-4 text-blue-500" />;
      case "deployment":
        if (status === "success") return <Rocket className="h-4 w-4 text-green-500" />;
        if (status === "failure") return <Rocket className="h-4 w-4 text-red-500" />;
        if (status === "running") return <Rocket className="h-4 w-4 text-blue-500" />;
        return <Rocket className="h-4 w-4 text-yellow-500" />;
      case "pipeline":
        if (status === "success") return <CheckCircle className="h-4 w-4 text-green-500" />;
        if (status === "failure") return <XCircle className="h-4 w-4 text-red-500" />;
        if (status === "running") return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        return <Play className="h-4 w-4 text-yellow-500" />;
      case "release":
        return <Tag className="h-4 w-4 text-purple-500" />;
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "commit":
        return "border-blue-500/30 bg-blue-500/5";
      case "deployment":
        return "border-green-500/30 bg-green-500/5";
      case "pipeline":
        return "border-yellow-500/30 bg-yellow-500/5";
      case "release":
        return "border-purple-500/30 bg-purple-500/5";
      case "alert":
        return "border-orange-500/30 bg-orange-500/5";
      default:
        return "border-gray-500/30 bg-gray-500/5";
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "commit":
        return <Badge variant="secondary" className="text-xs bg-blue-900/50">Commit</Badge>;
      case "deployment":
        return <Badge variant="secondary" className="text-xs bg-green-900/50">Deploy</Badge>;
      case "pipeline":
        return <Badge variant="secondary" className="text-xs bg-yellow-900/50">Pipeline</Badge>;
      case "release":
        return <Badge variant="secondary" className="text-xs bg-purple-900/50">Release</Badge>;
      case "alert":
        return <Badge variant="secondary" className="text-xs bg-orange-900/50">Alert</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Activity Feed</h3>
          <Badge variant="secondary" className="text-xs">
            Auto-refreshing
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {activities.length === 0 ? (
        <Card className="p-6 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No recent activity</p>
          <p className="text-sm text-gray-500 mt-2">
            Activity will appear here when commits, deployments, or pipeline runs occur
          </p>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-800" />
          
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type, activity.status)}
                </div>

                {/* Activity content */}
                <Card className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTypeBadge(activity.type)}
                        <span className="font-medium">{activity.action}</span>
                        {activity.status && (
                          <Badge 
                            variant={
                              activity.status === "success" ? "default" :
                              activity.status === "failure" ? "error" :
                              "secondary"
                            }
                            className={`text-xs ${activity.status === "success" ? "bg-green-600" : ""}`}
                          >
                            {activity.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                        {activity.message}
                      </p>
                      {activity.metadata && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {activity.metadata.branch && (
                            <span className="flex items-center gap-1">
                              <GitPullRequest className="h-3 w-3" />
                              {activity.metadata.branch}
                            </span>
                          )}
                          {activity.metadata.sha && (
                            <code className="bg-gray-800 px-1.5 py-0.5 rounded">
                              {activity.metadata.sha.substring(0, 7)}
                            </code>
                          )}
                          {activity.metadata.environment && (
                            <Badge variant="secondary" className="text-xs">
                              {activity.metadata.environment}
                            </Badge>
                          )}
                          {activity.metadata.duration && (
                            <span>{activity.metadata.duration}s</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end text-right shrink-0">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </div>
                      {activity.actor && (
                        <span className="text-xs text-gray-500 mt-1">
                          by {activity.actor}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
