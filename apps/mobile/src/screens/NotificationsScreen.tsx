import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "../lib/trpc";

interface NotificationItemProps {
  id: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  status: string;
  createdAt: Date;
  appName?: string | null;
  onPress: () => void;
  onMarkAsRead: () => void;
}

function NotificationItem({
  title,
  message,
  category,
  severity,
  status,
  createdAt,
  appName,
  onPress,
  onMarkAsRead,
}: NotificationItemProps) {
  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "info":
        return "#3b82f6";
      default:
        return "#22c55e";
    }
  };

  const getCategoryIcon = (cat: string): keyof typeof Ionicons.glyphMap => {
    switch (cat) {
      case "deployment":
        return "rocket";
      case "alert":
        return "alert-circle";
      case "security":
        return "shield";
      case "system":
        return "server";
      case "integration":
        return "git-network";
      default:
        return "notifications";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const isUnread = status === "new";

  return (
    <TouchableOpacity
      style={[styles.notificationItem, isUnread && styles.unreadItem]}
      onPress={onPress}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: getSeverityColor(severity) + "20" },
        ]}
      >
        <Ionicons
          name={getCategoryIcon(category)}
          size={24}
          color={getSeverityColor(severity)}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        <View style={styles.meta}>
          {appName && (
            <>
              <Ionicons name="cube" size={12} color="#64748b" />
              <Text style={styles.metaText}>{appName}</Text>
              <Text style={styles.separator}>•</Text>
            </>
          )}
          <Text style={styles.metaText}>{formatTimeAgo(createdAt)}</Text>
        </View>
      </View>
      {isUnread && (
        <TouchableOpacity
          style={styles.markReadButton}
          onPress={(e) => {
            e.stopPropagation();
            onMarkAsRead();
          }}
        >
          <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function NotificationsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");

  const notificationsQuery = trpc.notifications.list.useQuery({
    limit: 50,
    statuses: filter === "unread" ? ["new"] : undefined,
  });
  const statsQuery = trpc.notifications.stats.useQuery();
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([notificationsQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  }, [notificationsQuery, statsQuery]);

  const handleMarkAsRead = async (id: string) => {
    await markAsReadMutation.mutateAsync(id);
    await notificationsQuery.refetch();
    await statsQuery.refetch();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync();
    await notificationsQuery.refetch();
    await statsQuery.refetch();
  };

  const notifications = notificationsQuery.data?.notifications ?? [];
  const stats = statsQuery.data;

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.total ?? 0}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#3b82f6" }]}>
            {stats?.unread ?? 0}
          </Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#22c55e" }]}>
            {stats?.last24h ?? 0}
          </Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === "all" && styles.activeFilterTab]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "all" && styles.activeFilterText,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "unread" && styles.activeFilterTab,
          ]}
          onPress={() => setFilter("unread")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "unread" && styles.activeFilterText,
            ]}
          >
            Unread
          </Text>
          {(stats?.unread ?? 0) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{stats?.unread}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {(stats?.unread ?? 0) > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            id={item.id}
            title={item.title}
            message={item.message}
            category={item.category}
            severity={item.severity}
            status={item.status}
            createdAt={item.createdAt}
            appName={item.appName}
            onPress={() => console.log("Open notification:", item.id)}
            onMarkAsRead={() => handleMarkAsRead(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off" size={48} color="#64748b" />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>
              {filter === "unread"
                ? "You're all caught up!"
                : "You don't have any notifications yet"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#1e293b",
    borderRadius: 12,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#1e293b",
  },
  activeFilterTab: {
    backgroundColor: "#3b82f6",
  },
  filterText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "500",
  },
  activeFilterText: {
    color: "#fff",
  },
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    color: "#3b82f6",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  notificationItem: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  unreadItem: {
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
    marginLeft: 8,
  },
  message: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  metaText: {
    color: "#64748b",
    fontSize: 12,
    marginLeft: 4,
  },
  separator: {
    color: "#64748b",
    marginHorizontal: 6,
  },
  markReadButton: {
    justifyContent: "center",
    paddingLeft: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
