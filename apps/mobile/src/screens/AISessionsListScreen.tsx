import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type SessionStatus =
  | "pending"
  | "cloning"
  | "analyzing"
  | "fixing"
  | "testing"
  | "review"
  | "approved"
  | "merged"
  | "failed"
  | "cancelled";

interface AISession {
  id: string;
  issueSource: string;
  issueId: string;
  issueTitle: string;
  issueSeverity?: string;
  applicationName?: string;
  repositoryUrl: string;
  branch: string;
  agentType: string;
  status: SessionStatus;
  prNumber?: number;
  prUrl?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

type FilterType = "active" | "completed" | "all";

function SessionCard({
  session,
  onPress,
}: {
  session: AISession;
  onPress: () => void;
}) {
  const getStatusInfo = (status: SessionStatus) => {
    const statusMap: Record<SessionStatus, { color: string; icon: string; label: string }> = {
      pending: { color: "#6b7280", icon: "time", label: "Pending" },
      cloning: { color: "#3b82f6", icon: "git-branch", label: "Cloning" },
      analyzing: { color: "#8b5cf6", icon: "search", label: "Analyzing" },
      fixing: { color: "#f59e0b", icon: "hammer", label: "Fixing" },
      testing: { color: "#06b6d4", icon: "flask", label: "Testing" },
      review: { color: "#ec4899", icon: "eye", label: "Review Needed" },
      approved: { color: "#22c55e", icon: "checkmark-circle", label: "Approved" },
      merged: { color: "#22c55e", icon: "git-merge", label: "Merged" },
      failed: { color: "#ef4444", icon: "close-circle", label: "Failed" },
      cancelled: { color: "#6b7280", icon: "ban", label: "Cancelled" },
    };
    return statusMap[status] || statusMap.pending;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const statusInfo = getStatusInfo(session.status);
  const isActive = ["pending", "cloning", "analyzing", "fixing", "testing", "review"].includes(
    session.status
  );

  return (
    <TouchableOpacity style={styles.sessionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.statusIndicator, { backgroundColor: statusInfo.color }]} />

      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <View style={styles.agentBadge}>
            <Ionicons name="flash" size={12} color="#22c55e" />
            <Text style={styles.agentText}>{session.agentType}</Text>
          </View>
          <Text style={styles.timestamp}>{formatTimeAgo(session.createdAt)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {session.issueTitle}
        </Text>

        <View style={styles.sourceRow}>
          <Ionicons
            name={session.issueSource === "sentry" ? "bug" : "analytics"}
            size={12}
            color="#64748b"
          />
          <Text style={styles.sourceText}>{session.issueSource}</Text>
          {session.applicationName && (
            <>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.appName}>{session.applicationName}</Text>
            </>
          )}
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + "20" }]}>
            <Ionicons
              name={statusInfo.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={statusInfo.color}
            />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>

          {isActive && (
            <ActivityIndicator size="small" color={statusInfo.color} style={styles.spinner} />
          )}

          {session.prNumber && (
            <View style={styles.prBadge}>
              <Ionicons name="git-pull-request" size={12} color="#22c55e" />
              <Text style={styles.prText}>#{session.prNumber}</Text>
            </View>
          )}
        </View>
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

export function AISessionsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [filter, setFilter] = useState<FilterType>("active");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inReview: 0,
    completed: 0,
    failed: 0,
  });

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/ai-dev?action=list&limit=50`);
      if (!response.ok) throw new Error("Failed to fetch sessions");

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Error fetching AI sessions:", err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/ai-dev?action=stats`);
      if (!response.ok) return;

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([fetchSessions(), fetchStats()]);
  }, [fetchSessions, fetchStats]);

  useFocusEffect(
    useCallback(() => {
      loadData().finally(() => setLoading(false));

      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filteredSessions = useMemo(() => {
    const activeStatuses = ["pending", "cloning", "analyzing", "fixing", "testing", "review"];
    const completedStatuses = ["approved", "merged", "failed", "cancelled"];

    switch (filter) {
      case "active":
        return sessions.filter((s) => activeStatuses.includes(s.status));
      case "completed":
        return sessions.filter((s) => completedStatuses.includes(s.status));
      default:
        return sessions;
    }
  }, [sessions, filter]);

  const counts = useMemo(() => {
    const activeStatuses = ["pending", "cloning", "analyzing", "fixing", "testing", "review"];
    const completedStatuses = ["approved", "merged", "failed", "cancelled"];

    return {
      active: sessions.filter((s) => activeStatuses.includes(s.status)).length,
      completed: sessions.filter((s) => completedStatuses.includes(s.status)).length,
      all: sessions.length,
    };
  }, [sessions]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading AI sessions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.inReview}</Text>
          <Text style={styles.statLabel}>Review</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: "#22c55e" }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: "#ef4444" }]}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <FilterChip
          label="Active"
          active={filter === "active"}
          onPress={() => setFilter("active")}
          count={counts.active}
        />
        <FilterChip
          label="Completed"
          active={filter === "completed"}
          onPress={() => setFilter("completed")}
          count={counts.completed}
        />
        <FilterChip
          label="All"
          active={filter === "all"}
          onPress={() => setFilter("all")}
          count={counts.all}
        />
      </View>

      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onPress={() => navigation.navigate("AISessionDetail", { sessionId: item.id })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="flash-off" size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No AI sessions</Text>
            <Text style={styles.emptyText}>
              {filter === "active"
                ? "No active AI fix sessions. Start one from the Issues tab!"
                : "No completed sessions yet."}
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
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  statusIndicator: {
    width: 4,
    height: "100%",
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  agentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22c55e20",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  agentText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22c55e",
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
    marginBottom: 6,
    lineHeight: 20,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  sourceText: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "capitalize",
  },
  dotSeparator: {
    color: "#475569",
    fontSize: 11,
  },
  appName: {
    fontSize: 11,
    color: "#64748b",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  spinner: {
    marginLeft: 4,
  },
  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  prText: {
    fontSize: 11,
    color: "#22c55e",
    fontWeight: "600",
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
    paddingHorizontal: 32,
  },
});
