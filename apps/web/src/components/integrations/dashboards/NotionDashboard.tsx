"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ListTodo,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  GitBranch,
  GitPullRequest,
  Calendar,
  User,
} from "lucide-react";

interface NotionStats {
  total: number;
  byStatus: {
    not_started: number;
    in_progress: number;
    done: number;
    blocked: number;
    cancelled: number;
  };
  withAiSession: number;
  withPR: number;
  completionRate: number;
}

interface NotionTask {
  id: string;
  notionPageId: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  assignee: string | null;
  tags: string | null;
  notionUrl: string;
  aiSessionId: string | null;
  gitBranch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  updatedAt: string;
}

interface NotionConfig {
  id: string;
  notionDatabaseId: string;
  notionDatabaseName: string;
  notionDatabaseUrl: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

interface NotionDashboardData {
  stats: NotionStats;
  recentTasks: NotionTask[];
  configs: NotionConfig[];
}

export function NotionDashboard() {
  const [data, setData] = useState<NotionDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/notion?action=dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch Notion data");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Notion data");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/integrations/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      if (!response.ok) {
        throw new Error("Sync failed");
      }
      await fetchData();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "blocked":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <ListTodo className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "secondary" | "warning" | "error" | "outline"> = {
      done: "success",
      in_progress: "secondary",
      blocked: "warning",
      cancelled: "outline",
      not_started: "outline",
    };
    const labels: Record<string, string> = {
      done: "Done",
      in_progress: "In Progress",
      blocked: "Blocked",
      cancelled: "Cancelled",
      not_started: "Not Started",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return null;
    const colors: Record<string, string> = {
      urgent: "bg-red-500/20 text-red-400",
      high: "bg-orange-500/20 text-orange-400",
      medium: "bg-yellow-500/20 text-yellow-400",
      low: "bg-gray-500/20 text-gray-400",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${colors[priority] || colors.medium}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">
            Make sure NOTION_API_TOKEN is configured in your environment variables.
          </p>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const { stats, recentTasks, configs } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-white" />
            Notion Integration
          </h2>
          <p className="text-sm text-gray-400">Task management and AI session tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={triggerSync}
            disabled={isSyncing || configs.length === 0}
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Tasks
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <a
            href="https://notion.so"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Notion
            </Button>
          </a>
        </div>
      </div>

      {/* Task Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ListTodo className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-400">Total Tasks</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.byStatus.done}</p>
              <p className="text-sm text-gray-400">Completed</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.byStatus.in_progress}</p>
              <p className="text-sm text-gray-400">In Progress</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <GitBranch className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withAiSession}</p>
              <p className="text-sm text-gray-400">With AI Session</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <GitPullRequest className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withPR}</p>
              <p className="text-sm text-gray-400">With PR</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Completion Rate */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Completion Overview</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Completion Rate</span>
              <span className="font-semibold">{stats.completionRate}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-gray-600 rounded-full" />
              <span className="text-gray-400">Not Started: {stats.byStatus.not_started}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-gray-400">Blocked: {stats.byStatus.blocked}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Connected Databases */}
      {configs.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Connected Databases</h3>
          <div className="space-y-3">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{config.notionDatabaseName}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                      {config.syncEnabled ? (
                        <Badge variant="success" className="text-xs">Sync Enabled</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Sync Disabled</Badge>
                      )}
                      {config.lastSyncAt && (
                        <span>
                          Last sync: {new Date(config.lastSyncAt).toLocaleString()}
                        </span>
                      )}
                      {config.lastSyncStatus && (
                        <Badge 
                          variant={config.lastSyncStatus === "success" ? "success" : "error"}
                          className="text-xs"
                        >
                          {config.lastSyncStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {config.notionDatabaseUrl && (
                  <a
                    href={config.notionDatabaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {configs.length === 0 && (
        <Card className="p-6">
          <div className="text-center py-4">
            <FileText className="h-12 w-12 mx-auto text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Databases Connected</h3>
            <p className="text-gray-400 mb-4">
              Connect a Notion database to start syncing tasks.
            </p>
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Set Up Integration
              </Button>
            </a>
          </div>
        </Card>
      )}

      {/* Recent Tasks */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Tasks</h3>
          <span className="text-sm text-gray-400">
            Showing {recentTasks.length} most recent
          </span>
        </div>

        {recentTasks.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No tasks synced yet</p>
        ) : (
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {getStatusIcon(task.status)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{task.title}</p>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-1 flex-wrap">
                      {task.assignee && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.assignee}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {task.gitBranch && (
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {task.gitBranch}
                        </span>
                      )}
                      {task.prNumber && (
                        <a 
                          href={task.prUrl || "#"} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-blue-400"
                        >
                          <GitPullRequest className="h-3 w-3" />
                          PR #{task.prNumber}
                        </a>
                      )}
                      {parseTags(task.tags).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <a
                  href={task.notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 ml-4"
                >
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
