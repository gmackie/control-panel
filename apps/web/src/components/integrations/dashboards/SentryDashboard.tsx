"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Bug,
  AlertCircle,
  AlertOctagon,
  Users,
  Activity,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  GitBranch,
} from "lucide-react";

interface SentryStats {
  totalProjects: number;
  activeProjects: number;
  totalIssues: number;
  unresolvedIssues: number;
  newIssues24h: number;
  newIssues7d: number;
  fatalIssues: number;
  errorIssues: number;
  warningIssues: number;
  highPriorityIssues: number;
  mediumPriorityIssues: number;
  totalAffectedUsers: number;
  totalOccurrences: number;
  errors24h: number;
  errors7d: number;
  issuesByProject: Record<string, number>;
  regressions: number;
  totalTeams: number;
  totalReleases: number;
  recentReleases: Array<{
    version: string;
    date: string;
    newIssues: number;
    authors: number;
  }>;
  releasesWithNewIssues: number;
  topIssues: Array<{
    id: string;
    shortId: string;
    title: string;
    level: string;
    userCount: number;
    count: string;
    project: string;
  }>;
}

export function SentryDashboard() {
  const [stats, setStats] = useState<SentryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/sentry?action=stats");
      if (!response.ok) {
        throw new Error("Failed to fetch Sentry stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Sentry data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleIssueAction = async (issueId: string, action: "resolve" | "ignore") => {
    setActionLoading(issueId);
    try {
      const response = await fetch("/api/integrations/sentry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "resolve" ? "resolve-issue" : "ignore-issue",
          issueId,
        }),
      });
      if (response.ok) {
        fetchStats();
      }
    } catch (err) {
      console.error("Failed to update issue:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "fatal":
        return <AlertOctagon className="h-4 w-4 text-red-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bug className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "fatal":
        return <Badge variant="error">Fatal</Badge>;
      case "error":
        return <Badge variant="error">Error</Badge>;
      case "warning":
        return <Badge variant="warning">Warning</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
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
            Make sure SENTRY_AUTH_TOKEN and SENTRY_ORG are configured in your environment variables.
          </p>
          <Button onClick={fetchStats} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Sentry Error Tracking
          </h2>
          <p className="text-sm text-gray-400">Monitor errors, issues, and releases</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <a
            href="https://sentry.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Sentry
            </Button>
          </a>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <Bug className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unresolvedIssues}</p>
              <p className="text-sm text-gray-400">Unresolved Issues</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">+{stats.newIssues24h}</p>
              <p className="text-sm text-gray-400">New (24h)</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalAffectedUsers.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Users Affected</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalOccurrences.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Total Events</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Severity & Priority */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">By Severity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-red-600" />
                <span className="text-gray-400">Fatal</span>
              </div>
              <span className="font-bold text-red-600">{stats.fatalIssues}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-gray-400">Error</span>
              </div>
              <span className="font-bold text-red-500">{stats.errorIssues}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-gray-400">Warning</span>
              </div>
              <span className="font-bold text-yellow-500">{stats.warningIssues}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">By Priority</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">High Priority</span>
              <Badge variant="error">{stats.highPriorityIssues}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Medium Priority</span>
              <Badge variant="warning">{stats.mediumPriorityIssues}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Regressions</span>
              <Badge variant="error">{stats.regressions}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Issues */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Issues by Impact</h3>
          <a
            href="https://sentry.io/issues/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              View All
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </a>
        </div>

        {stats.topIssues.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No issues found</p>
        ) : (
          <div className="space-y-3">
            {stats.topIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getLevelIcon(issue.level)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-500">{issue.shortId}</code>
                      {getLevelBadge(issue.level)}
                    </div>
                    <p className="text-sm font-medium truncate">{issue.title}</p>
                    <p className="text-xs text-gray-500">{issue.project}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{issue.userCount} users</p>
                    <p className="text-xs text-gray-500">{issue.count} events</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleIssueAction(issue.id, "resolve")}
                      disabled={actionLoading === issue.id}
                      title="Resolve"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleIssueAction(issue.id, "ignore")}
                      disabled={actionLoading === issue.id}
                      title="Ignore"
                    >
                      <XCircle className="h-4 w-4 text-gray-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Releases */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Releases</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {stats.releasesWithNewIssues} with new issues
            </span>
          </div>
        </div>

        {stats.recentReleases.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No releases found</p>
        ) : (
          <div className="space-y-3">
            {stats.recentReleases.map((release, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <GitBranch className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="font-medium font-mono text-sm">{release.version}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(release.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {release.newIssues > 0 ? (
                    <Badge variant="error">{release.newIssues} new issues</Badge>
                  ) : (
                    <Badge variant="success">Clean release</Badge>
                  )}
                  <span className="text-sm text-gray-500">
                    {release.authors} contributor{release.authors !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Projects & Teams */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Issues by Project</h3>
          {Object.keys(stats.issuesByProject).length === 0 ? (
            <p className="text-gray-400">No project data</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.issuesByProject)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([project, count]) => (
                  <div key={project} className="flex items-center justify-between">
                    <span className="text-gray-400 truncate">{project}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Overview</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Projects</span>
              <span className="font-medium">{stats.totalProjects}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Active Projects</span>
              <span className="font-medium">{stats.activeProjects}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Teams</span>
              <span className="font-medium">{stats.totalTeams}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Releases</span>
              <span className="font-medium">{stats.totalReleases}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
