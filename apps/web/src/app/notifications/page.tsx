"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Filter,
  CheckCheck,
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  AlertOctagon,
} from "lucide-react";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import {
  Notification,
  NotificationStats,
  NotificationSeverity,
  NotificationCategory,
  NotificationStatus,
} from "@/lib/notifications/types";

const SEVERITY_OPTIONS: { value: NotificationSeverity; label: string; icon: typeof Info }[] = [
  { value: "info", label: "Info", icon: Info },
  { value: "warning", label: "Warning", icon: AlertTriangle },
  { value: "error", label: "Error", icon: AlertCircle },
  { value: "critical", label: "Critical", icon: AlertOctagon },
];

const CATEGORY_OPTIONS: { value: NotificationCategory; label: string }[] = [
  { value: "error", label: "Errors" },
  { value: "payment", label: "Payments" },
  { value: "security", label: "Security" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "deployment", label: "Deployments" },
  { value: "integration", label: "Integrations" },
  { value: "auth", label: "Authentication" },
];

const STATUS_OPTIONS: { value: NotificationStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "seen", label: "Seen" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "snoozed", label: "Snoozed" },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSeverities, setSelectedSeverities] = useState<NotificationSeverity[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<NotificationCategory[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<NotificationStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchNotifications = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;

      const params = new URLSearchParams({
        limit: "20",
        offset: currentOffset.toString(),
      });

      if (selectedSeverities.length > 0) {
        params.set("severities", selectedSeverities.join(","));
      }
      if (selectedCategories.length > 0) {
        params.set("categories", selectedCategories.join(","));
      }
      if (selectedStatuses.length > 0) {
        params.set("statuses", selectedStatuses.join(","));
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const response = await fetch(`/api/notifications?${params}`);
      if (response.ok) {
        const data = await response.json();
        const fetchedNotifications = (data.notifications || []).map((n: Notification & { createdAt: string; updatedAt: string }) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
        }));

        if (reset) {
          setNotifications(fetchedNotifications);
          setOffset(20);
        } else {
          setNotifications((prev) => [...prev, ...fetchedNotifications]);
          setOffset((prev) => prev + 20);
        }
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [offset, selectedSeverities, selectedCategories, selectedStatuses, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(true);
    fetchStats();
  }, [fetchNotifications, fetchStats, selectedSeverities, selectedCategories, selectedStatuses, searchQuery]);

  const handleAcknowledge = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "acknowledged" }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, status: "acknowledged" as const } : n
          )
        );
        fetchStats();
      }
    } catch (error) {
      console.error("Error acknowledging notification:", error);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, status: "resolved" as const } : n
          )
        );
        fetchStats();
      }
    } catch (error) {
      console.error("Error resolving notification:", error);
    }
  };

  const handleSnooze = async (id: string, until: Date) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozedUntil: until.toISOString() }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, status: "snoozed" as const, snoozedUntil: until } : n
          )
        );
        fetchStats();
      }
    } catch (error) {
      console.error("Error snoozing notification:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read" }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.status === "new" ? { ...n, status: "seen" as const } : n))
        );
        fetchStats();
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const toggleSeverity = (severity: NotificationSeverity) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
  };

  const toggleCategory = (category: NotificationCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const toggleStatus = (status: NotificationStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSelectedSeverities([]);
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setSearchQuery("");
  };

  const hasActiveFilters =
    selectedSeverities.length > 0 ||
    selectedCategories.length > 0 ||
    selectedStatuses.length > 0 ||
    searchQuery.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Bell className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-sm text-gray-400">
                {stats?.unread || 0} unread notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNotifications(true)}
              className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {selectedSeverities.length + selectedCategories.length + selectedStatuses.length}
                </span>
              )}
            </button>
            {stats && stats.unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-400 hover:text-gray-200 rounded-lg transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Unread</p>
              <p className="text-2xl font-bold text-blue-400">{stats.unread}</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Last 24h</p>
              <p className="text-2xl font-bold">{stats.last24h}</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Last 7 days</p>
              <p className="text-2xl font-bold">{stats.last7d}</p>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Severity */}
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">Severity</p>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => toggleSeverity(option.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedSeverities.includes(option.value)
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category */}
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => toggleCategory(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedCategories.includes(option.value)
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-sm text-gray-400 mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => toggleStatus(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedStatuses.includes(option.value)
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="space-y-4">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">
                No notifications
              </h3>
              <p className="text-gray-500">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onAcknowledge={handleAcknowledge}
                  onResolve={handleResolve}
                  onSnooze={handleSnooze}
                />
              ))}

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => fetchNotifications(false)}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
