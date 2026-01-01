import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { ScopeBar } from "../components/ScopeBar";
import { useCurrentScope, useScopeStore } from "../stores/scope";
import { trpc } from "../lib/trpc";

type ActivityType = "pipeline" | "notification" | "deployment" | "alert";
type FilterType = "all" | "pipelines" | "notifications" | "deployments";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  timestamp: Date;
  status: "success" | "running" | "failed" | "pending" | "info" | "warning" | "critical";
  siteId?: string;
  siteName?: string;
  metadata?: {
    commitSha?: string;
    author?: string;
    repository?: string;
    category?: string;
    severity?: string;
    isUnread?: boolean;
  };
}

interface ActivitySection {
  title: string;
  data: ActivityItem[];
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

function ActivityItemCard({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "#22c55e";
      case "running":
        return "#3b82f6";
      case "failed":
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "pending":
        return "#6b7280";
      default:
        return "#3b82f6";
    }
  };

  const getTypeIcon = (type: ActivityType): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (type) {
      case "pipeline":
        return "git-commit";
      case "deployment":
        return "rocket";
      case "notification":
        return "notifications";
      case "alert":
        return "alert-circle";
    }
  };

  const getTypeLabel = (type: ActivityType) => {
    switch (type) {
      case "pipeline":
        return "Pipeline";
      case "deployment":
        return "Deploy";
      case "notification":
        return "Notification";
      case "alert":
        return "Alert";
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

  const statusColor = getStatusColor(item.status);
  const isUnread = item.metadata?.isUnread;

  return (
    <TouchableOpacity
      style={[styles.activityCard, isUnread && styles.unreadCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.typeIndicator, { backgroundColor: statusColor }]} />

      <View style={[styles.iconContainer, { backgroundColor: statusColor + "20" }]}>
        <Ionicons name={getTypeIcon(item.type)} size={20} color={statusColor} />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{getTypeLabel(item.type)}</Text>
          </View>
          <Text style={styles.timestamp}>{formatTimeAgo(item.timestamp)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>

        {item.metadata?.commitSha && (
          <View style={styles.metaRow}>
            <Text style={styles.commitSha}>{item.metadata.commitSha.substring(0, 7)}</Text>
            {item.metadata.author && (
              <Text style={styles.author}>by {item.metadata.author}</Text>
            )}
          </View>
        )}

        {item.siteName && (
          <View style={styles.siteTag}>
            <Ionicons name="business" size={10} color="#64748b" />
            <Text style={styles.siteText}>{item.siteName}</Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color="#475569" />
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.filterCount, active && styles.filterCountActive]}>
          <Text style={styles.filterCountText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function ActivityFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isGlobal, siteId } = useCurrentScope();
  const sites = useScopeStore((state) => state.sites);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [pipelinesData, setPipelinesData] = useState<ActivityItem[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);

  const notificationsQuery = trpc.notifications.list.useQuery({ limit: 30 });
  const statsQuery = trpc.notifications.stats.useQuery();

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/pipeline?action=journeys&limit=20`);
      if (!response.ok) return;
      const data = await response.json();

      const items: ActivityItem[] = (data.journeys || []).map((j: any) => ({
        id: `pipeline-${j.commit.sha}`,
        type: "pipeline" as const,
        title: j.commit.message,
        subtitle: j.commit.repository,
        timestamp: new Date(j.commit.timestamp),
        status: j.status,
        metadata: {
          commitSha: j.commit.sha,
          author: j.commit.author,
          repository: j.commit.repository,
        },
      }));

      setPipelinesData(items);
    } catch (error) {
      console.error("Error fetching pipelines:", error);
    } finally {
      setPipelinesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPipelines(), notificationsQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  }, [fetchPipelines, notificationsQuery, statsQuery]);

  const notificationItems: ActivityItem[] = useMemo(() => {
    return (notificationsQuery.data?.notifications || []).map((n) => ({
      id: `notification-${n.id}`,
      type: n.category === "deployment" ? "deployment" : "notification" as ActivityType,
      title: n.title,
      subtitle: n.message,
      timestamp: n.createdAt,
      status: n.severity === "critical" ? "critical" : n.severity === "warning" ? "warning" : "info",
      siteId: undefined,
      siteName: n.appName || undefined,
      metadata: {
        category: n.category,
        severity: n.severity,
        isUnread: n.status === "new",
      },
    }));
  }, [notificationsQuery.data]);

  const allActivities = useMemo(() => {
    let items: ActivityItem[] = [];

    if (filter === "all" || filter === "pipelines") {
      items = [...items, ...pipelinesData];
    }
    if (filter === "all" || filter === "notifications") {
      items = [...items, ...notificationItems.filter((i) => i.type === "notification")];
    }
    if (filter === "all" || filter === "deployments") {
      items = [...items, ...notificationItems.filter((i) => i.type === "deployment")];
    }

    if (!isGlobal && siteId) {
      items = items.filter((item) => !item.siteId || item.siteId === siteId);
    }

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return items;
  }, [filter, pipelinesData, notificationItems, isGlobal, siteId]);

  const sections: ActivitySection[] = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const todayItems: ActivityItem[] = [];
    const yesterdayItems: ActivityItem[] = [];
    const thisWeekItems: ActivityItem[] = [];
    const olderItems: ActivityItem[] = [];

    allActivities.forEach((item) => {
      if (item.timestamp >= today) {
        todayItems.push(item);
      } else if (item.timestamp >= yesterday) {
        yesterdayItems.push(item);
      } else if (item.timestamp >= weekAgo) {
        thisWeekItems.push(item);
      } else {
        olderItems.push(item);
      }
    });

    const result: ActivitySection[] = [];
    if (todayItems.length > 0) result.push({ title: "Today", data: todayItems });
    if (yesterdayItems.length > 0) result.push({ title: "Yesterday", data: yesterdayItems });
    if (thisWeekItems.length > 0) result.push({ title: "This Week", data: thisWeekItems });
    if (olderItems.length > 0) result.push({ title: "Older", data: olderItems });

    return result;
  }, [allActivities]);

  const handleItemPress = (item: ActivityItem) => {
    if (item.type === "notification" || item.type === "deployment") {
      const notificationId = item.id.replace("notification-", "");
      navigation.navigate("NotificationDetail", { id: notificationId });
    }
  };

  const unreadCount = statsQuery.data?.unread ?? 0;
  const isLoading = pipelinesLoading || notificationsQuery.isLoading;

  return (
    <View style={styles.container}>
      <ScopeBar />

      <View style={styles.filterRow}>
        <FilterChip
          label="All"
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterChip
          label="Pipelines"
          active={filter === "pipelines"}
          onPress={() => setFilter("pipelines")}
          count={pipelinesData.length}
        />
        <FilterChip
          label="Notifications"
          active={filter === "notifications"}
          onPress={() => setFilter("notifications")}
          count={unreadCount}
        />
        <FilterChip
          label="Deploys"
          active={filter === "deployments"}
          onPress={() => setFilter("deployments")}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading activity...</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ActivityItemCard item={item} onPress={() => handleItemPress(item)} />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={48} color="#475569" />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyText}>
                Pipeline runs and notifications will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: "#3b82f6",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94a3b8",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  filterCount: {
    backgroundColor: "#334155",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  unreadCard: {
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  typeIndicator: {
    width: 3,
    height: "100%",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  contentContainer: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: "#334155",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  timestamp: {
    fontSize: 11,
    color: "#64748b",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  commitSha: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#60a5fa",
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  author: {
    fontSize: 11,
    color: "#64748b",
  },
  siteTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  siteText: {
    fontSize: 10,
    color: "#64748b",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#94a3b8",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
});
