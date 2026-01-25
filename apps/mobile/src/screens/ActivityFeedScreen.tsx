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
import { trpc } from "../lib/trpc";
import { useTheme } from "../hooks/useTheme";

type ActivityType = "deployment" | "commit" | "alert" | "build" | "notification";
type FilterType = "all" | "deployments" | "commits" | "alerts" | "builds";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: Date;
  severity: string;
  appId?: string;
  appName?: string;
  environment?: string;
  actorName?: string;
  actorAvatar?: string;
}

interface ActivitySection {
  title: string;
  data: ActivityItem[];
}

function ActivityItemCard({
  item,
  onPress,
  colors,
}: {
  item: ActivityItem;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "success":
        return "#22c55e";
      case "info":
        return "#3b82f6";
      case "warning":
        return "#f59e0b";
      case "error":
      case "critical":
        return "#ef4444";
      default:
        return colors.textMuted;
    }
  };

  const getTypeIcon = (type: ActivityType): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (type) {
      case "deployment":
        return "rocket";
      case "commit":
        return "git-commit";
      case "alert":
        return "alert-circle";
      case "build":
        return "construct";
      default:
        return "notifications";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}d`;
  };

  const severityColor = getSeverityColor(item.severity);

  return (
    <TouchableOpacity
      style={[styles.activityCard, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.typeIndicator, { backgroundColor: severityColor }]} />

      <View style={[styles.iconContainer, { backgroundColor: severityColor + "20" }]}>
        <Ionicons name={getTypeIcon(item.type)} size={18} color={severityColor} />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textMuted }]}>
            {formatTimeAgo(item.timestamp)}
          </Text>
        </View>

        {item.description && (
          <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={1}>
            {item.description}
          </Text>
        )}

        <View style={styles.metaRow}>
          {item.appName && (
            <View style={[styles.appTag, { backgroundColor: colors.background }]}>
              <Text style={[styles.appText, { color: colors.textMuted }]}>{item.appName}</Text>
            </View>
          )}
          {item.environment && (
            <View style={[styles.envTag, { backgroundColor: colors.background }]}>
              <Text style={[styles.envText, { color: colors.textMuted }]}>{item.environment}</Text>
            </View>
          )}
          {item.actorName && (
            <Text style={[styles.actor, { color: colors.textMuted }]}>
              by {item.actorName}
            </Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        { backgroundColor: active ? colors.primary : colors.card },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: active ? "#fff" : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ActivityFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const activityQuery = trpc.activity.recent.useQuery({
    limit: 50,
    type: filter,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await activityQuery.refetch();
    setRefreshing(false);
  }, [activityQuery]);

  const activities: ActivityItem[] = useMemo(() => {
    return (activityQuery.data ?? []).map((event) => ({
      id: event.id,
      type: mapCategoryToType(event.category),
      title: event.title,
      description: event.description ?? undefined,
      timestamp: new Date(event.timestamp),
      severity: event.severity,
      appId: event.appId ?? undefined,
      appName: event.appName ?? undefined,
      environment: event.environment ?? undefined,
      actorName: event.actorName ?? undefined,
      actorAvatar: event.actorAvatar ?? undefined,
    }));
  }, [activityQuery.data]);

  const sections: ActivitySection[] = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const todayItems: ActivityItem[] = [];
    const yesterdayItems: ActivityItem[] = [];
    const thisWeekItems: ActivityItem[] = [];
    const olderItems: ActivityItem[] = [];

    activities.forEach((item) => {
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
  }, [activities]);

  const handleItemPress = (item: ActivityItem) => {
    if (item.appId) {
      navigation.navigate("ApplicationDetail", { id: item.appId });
    } else if (item.type === "alert") {
      navigation.navigate("AlertDetail", { id: item.id });
    }
  };

  const isLoading = activityQuery.isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.filterRow}>
        <FilterChip
          label="All"
          active={filter === "all"}
          onPress={() => setFilter("all")}
          colors={colors}
        />
        <FilterChip
          label="Deployments"
          active={filter === "deployments"}
          onPress={() => setFilter("deployments")}
          colors={colors}
        />
        <FilterChip
          label="Commits"
          active={filter === "commits"}
          onPress={() => setFilter("commits")}
          colors={colors}
        />
        <FilterChip
          label="Alerts"
          active={filter === "alerts"}
          onPress={() => setFilter("alerts")}
          colors={colors}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading activity...
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ActivityItemCard
              item={item}
              onPress={() => handleItemPress(item)}
              colors={colors}
            />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No activity yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Deployments, commits, and alerts will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function mapCategoryToType(category: string): ActivityType {
  switch (category) {
    case "deployment":
    case "deploy":
      return "deployment";
    case "commit":
    case "push":
      return "commit";
    case "alert":
    case "notification":
      return "alert";
    case "build":
    case "ci":
    case "workflow":
      return "build";
    default:
      return "notification";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingVertical: 10,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  typeIndicator: {
    width: 3,
    height: "100%",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  contentContainer: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 11,
  },
  description: {
    fontSize: 12,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  appTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  appText: {
    fontSize: 10,
    fontWeight: "500",
  },
  envTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  envText: {
    fontSize: 10,
    fontWeight: "500",
  },
  actor: {
    fontSize: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
