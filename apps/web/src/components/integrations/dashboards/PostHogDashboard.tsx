"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Flag,
  Users,
  Activity,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Eye,
  LayoutDashboard,
  Layers,
} from "lucide-react";

interface PostHogStats {
  // Feature Flags
  totalFeatureFlags: number;
  activeFeatureFlags: number;
  inactiveFeatureFlags: number;
  experimentsRunning: number;

  // Events
  totalEventTypes: number;
  totalEvents30d: number;
  topEvents: Array<{
    name: string;
    count: number;
  }>;
  recentEventBreakdown: Record<string, number>;

  // Insights & Dashboards
  savedInsights: number;
  dashboards: number;
  pinnedDashboards: number;

  // Cohorts
  cohorts: number;
  totalCohortUsers: number;

  // Persons
  trackedPersons: number;

  // Feature flags list (for toggle actions)
  featureFlags?: Array<{
    id: number;
    key: string;
    name: string;
    active: boolean;
    rollout_percentage: number | null;
  }>;
}

export function PostHogDashboard() {
  const [stats, setStats] = useState<PostHogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<number | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/posthog?action=stats");
      if (!response.ok) {
        throw new Error("Failed to fetch PostHog stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PostHog data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleToggleFlag = async (flagId: number, currentActive: boolean) => {
    setToggleLoading(flagId);
    try {
      const response = await fetch("/api/integrations/posthog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-flag",
          flagId,
          active: !currentActive,
        }),
      });
      if (response.ok) {
        // Refresh stats to get updated flag status
        fetchStats();
      }
    } catch (err) {
      console.error("Failed to toggle feature flag:", err);
    } finally {
      setToggleLoading(null);
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
            Make sure POSTHOG_API_KEY and POSTHOG_PROJECT_ID are configured in your environment variables.
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

  const topRecentEvents = Object.entries(stats.recentEventBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            PostHog Analytics
          </h2>
          <p className="text-sm text-gray-400">Product analytics, feature flags, and experiments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <a
            href="https://app.posthog.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open PostHog
            </Button>
          </a>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalEvents30d.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Events (30d)</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Flag className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats.activeFeatureFlags}
                <span className="text-sm text-gray-500 font-normal">/{stats.totalFeatureFlags}</span>
              </p>
              <p className="text-sm text-gray-400">Active Flags</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.trackedPersons.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Tracked Users</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.experimentsRunning}</p>
              <p className="text-sm text-gray-400">Experiments</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Feature Flags & Top Events */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Feature Flags */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Flag className="h-5 w-5 text-green-500" />
              Feature Flags
            </h3>
            <a
              href="https://app.posthog.com/feature_flags"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </a>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Active</span>
              <Badge variant="success">{stats.activeFeatureFlags}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Inactive</span>
              <Badge variant="outline">{stats.inactiveFeatureFlags}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Experiments</span>
              <Badge variant="warning">{stats.experimentsRunning}</Badge>
            </div>
          </div>

          {stats.featureFlags && stats.featureFlags.length > 0 && (
            <div className="border-t border-gray-800 pt-4 mt-4">
              <p className="text-sm text-gray-400 mb-3">Quick Toggle</p>
              <div className="space-y-2">
                {stats.featureFlags.slice(0, 5).map((flag) => (
                  <div
                    key={flag.id}
                    className="flex items-center justify-between p-2 bg-gray-900 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{flag.key}</p>
                      {flag.rollout_percentage !== null && (
                        <p className="text-xs text-gray-500">
                          {flag.rollout_percentage}% rollout
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleFlag(flag.id, flag.active)}
                      disabled={toggleLoading === flag.id}
                      className={flag.active ? "text-green-500" : "text-gray-500"}
                    >
                      {toggleLoading === flag.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : flag.active ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Top Events (30d) */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Top Events (30d)
            </h3>
            <Badge variant="outline">{stats.totalEventTypes} types</Badge>
          </div>

          {stats.topEvents.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No event data</p>
          ) : (
            <div className="space-y-3">
              {stats.topEvents.slice(0, 8).map((event, i) => {
                const maxCount = stats.topEvents[0]?.count || 1;
                const percentage = Math.round((event.count / maxCount) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300 truncate font-mono text-xs">
                        {event.name}
                      </span>
                      <span className="text-gray-400 ml-2">
                        {event.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Events & Insights */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Event Breakdown */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-500" />
              Recent Activity
            </h3>
          </div>

          {topRecentEvents.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No recent events</p>
          ) : (
            <div className="space-y-2">
              {topRecentEvents.map(([eventName, count], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-gray-900 rounded-lg"
                >
                  <span className="text-sm font-mono text-gray-300 truncate">
                    {eventName}
                  </span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Insights & Dashboards */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-cyan-500" />
              Insights & Dashboards
            </h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Saved Insights</span>
                <span className="text-2xl font-bold">{stats.savedInsights}</span>
              </div>
              <a
                href="https://app.posthog.com/insights"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                View insights →
              </a>
            </div>

            <div className="p-4 bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Dashboards</span>
                <div className="text-right">
                  <span className="text-2xl font-bold">{stats.dashboards}</span>
                  {stats.pinnedDashboards > 0 && (
                    <span className="text-sm text-gray-500 ml-2">
                      ({stats.pinnedDashboards} pinned)
                    </span>
                  )}
                </div>
              </div>
              <a
                href="https://app.posthog.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                View dashboards →
              </a>
            </div>
          </div>
        </Card>
      </div>

      {/* Cohorts */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" />
            Cohorts
          </h3>
          <a
            href="https://app.posthog.com/cohorts"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm">
              Manage Cohorts
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </a>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-3xl font-bold text-indigo-500">{stats.cohorts}</p>
            <p className="text-sm text-gray-400">Total Cohorts</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-3xl font-bold text-purple-500">
              {stats.totalCohortUsers.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400">Users in Cohorts</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
