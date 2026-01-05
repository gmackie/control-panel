"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckSquare,
  Circle,
  Clock,
  ExternalLink,
  FolderKanban,
  RefreshCw,
  Target,
} from "lucide-react";
import Link from "next/link";

interface TasksOverview {
  user: { id: string; name: string | null; email: string } | null;
  workspaces: Array<{ id: string; name: string; slug: string }>;
  projects: Array<{
    project: {
      id: string;
      name: string;
      key: string;
      color: string | null;
      status: string;
    };
    issueCount: number;
    completedCount: number;
  }>;
  issues: Array<{
    id: string;
    identifier: string;
    title: string;
    status: string;
    priority: string;
    type: string;
    project?: { id: string; name: string; key: string; color: string | null };
    assignee?: { id: string; name: string | null; avatarUrl: string | null } | null;
  }>;
  stats: {
    totalIssues: number;
    openIssues: number;
    completedIssues: number;
    totalProjects: number;
    activeCycles: number;
  } | null;
  summary: {
    totalWorkspaces: number;
    totalProjects: number;
    totalIssues: number;
    openIssues: number;
    completedIssues: number;
  };
}

const statusIcons: Record<string, { icon: typeof Circle; color: string }> = {
  backlog: { icon: Circle, color: "text-gray-400" },
  todo: { icon: Circle, color: "text-blue-400" },
  in_progress: { icon: Clock, color: "text-yellow-400" },
  in_review: { icon: Clock, color: "text-purple-400" },
  done: { icon: CheckSquare, color: "text-green-400" },
  canceled: { icon: Circle, color: "text-red-400" },
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/50",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  low: "bg-gray-500/20 text-gray-400 border-gray-500/50",
  no_priority: "bg-gray-800 text-gray-500 border-gray-700",
};

export function TasksWidget() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<TasksOverview>({
    queryKey: ["tasks-overview"],
    queryFn: async () => {
      const response = await fetch("/api/integrations/linear-clone?endpoint=overview");
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
    refetchInterval: 30000,
    retry: 2,
  });

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
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold">Tasks</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 bg-red-950/30 border border-red-800/50 rounded-lg text-center">
          <p className="text-sm text-red-400">Failed to load tasks from tasks.gmac.io</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const stats = data?.stats || data?.summary || {
    totalIssues: 0,
    openIssues: 0,
    completedIssues: 0,
    totalProjects: 0,
  };

  const issues = data?.issues || [];
  const projects = data?.projects || [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold">Tasks</h2>
          <Badge variant="secondary" className="ml-2 text-xs">
            tasks.gmac.io
          </Badge>
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
          <a href="https://tasks.gmac.io" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Open
              <ExternalLink className="h-4 w-4 ml-1" />
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-indigo-400" />
            <span className="text-xs text-gray-400">Total</span>
          </div>
          <p className="text-xl font-bold">{stats.totalIssues}</p>
        </div>
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Circle className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Open</span>
          </div>
          <p className="text-xl font-bold">{stats.openIssues}</p>
        </div>
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="h-4 w-4 text-green-400" />
            <span className="text-xs text-gray-400">Done</span>
          </div>
          <p className="text-xl font-bold">{stats.completedIssues}</p>
        </div>
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-gray-400">Projects</span>
          </div>
          <p className="text-xl font-bold">{projects.length || stats.totalProjects}</p>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Issues</h3>
        {issues.length > 0 ? (
          <div className="space-y-2">
            {issues.slice(0, 5).map((issue) => {
              const StatusIcon = statusIcons[issue.status]?.icon || Circle;
              const statusColor = statusIcons[issue.status]?.color || "text-gray-400";
              
              return (
                <div
                  key={issue.id}
                  className="p-3 bg-gray-900/50 rounded-lg flex items-center justify-between hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusColor}`} />
                    <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                      {issue.identifier}
                    </span>
                    <span className="text-sm truncate">{issue.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {issue.priority !== "no_priority" && (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${priorityColors[issue.priority] || priorityColors.no_priority}`}
                      >
                        {issue.priority}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-gray-900/50 rounded-lg text-center text-sm text-gray-500">
            No issues found
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div className="pt-4 border-t border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Projects</h3>
          <div className="flex flex-wrap gap-2">
            {projects.slice(0, 4).map((p) => (
              <Badge
                key={p.project.id}
                variant="secondary"
                className="text-xs"
                style={{
                  borderLeftWidth: "3px",
                  borderLeftColor: p.project.color || "#6366f1",
                }}
              >
                {p.project.name}
                <span className="ml-1 text-gray-500">
                  ({p.completedCount}/{p.issueCount})
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
