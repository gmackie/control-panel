import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { ScopeBar } from "../components/ScopeBar";
import { useCurrentScope } from "../stores/scope";
import { useBiometricAuth } from "../hooks/useBiometricAuth";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type IssueSource = "sentry" | "posthog";
type IssueSeverity = "fatal" | "error" | "warning" | "info";
type FilterType = "all" | "fatal" | "error" | "warning";

interface Issue {
  id: string;
  source: IssueSource;
  shortId: string;
  title: string;
  culprit: string;
  level: IssueSeverity;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  hasActiveSession?: boolean;
}

interface AISession {
  id: string;
  issueId: string;
  status: string;
}

function IssueCard({
  issue,
  onPress,
  onFixWithAI,
  hasActiveSession,
}: {
  issue: Issue;
  onPress: () => void;
  onFixWithAI: () => void;
  hasActiveSession: boolean;
}) {
  const getSeverityColor = (level: IssueSeverity) => {
    switch (level) {
      case "fatal":
        return "#dc2626";
      case "error":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      default:
        return "#3b82f6";
    }
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

  const severityColor = getSeverityColor(issue.level);

  return (
    <TouchableOpacity style={styles.issueCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.severityIndicator, { backgroundColor: severityColor }]} />

      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <View style={styles.sourceRow}>
            <Ionicons
              name={issue.source === "sentry" ? "bug" : "analytics"}
              size={14}
              color="#64748b"
            />
            <Text style={styles.shortId}>{issue.shortId}</Text>
          </View>
          <Text style={styles.timestamp}>{formatTimeAgo(issue.lastSeen)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {issue.title}
        </Text>

        <Text style={styles.culprit} numberOfLines={1}>
          {issue.culprit}
        </Text>

        <View style={styles.metaRow}>
          <View style={[styles.levelBadge, { backgroundColor: severityColor + "20" }]}>
            <Text style={[styles.levelText, { color: severityColor }]}>
              {issue.level.toUpperCase()}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="repeat" size={12} color="#64748b" />
              <Text style={styles.statText}>{issue.count}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="people" size={12} color="#64748b" />
              <Text style={styles.statText}>{issue.userCount}</Text>
            </View>
          </View>

          <Text style={styles.projectName}>{issue.project.name}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.fixButton,
            hasActiveSession && styles.fixButtonActive,
          ]}
          onPress={onFixWithAI}
          disabled={hasActiveSession}
        >
          <Ionicons
            name={hasActiveSession ? "hourglass" : "flash"}
            size={16}
            color={hasActiveSession ? "#64748b" : "#22c55e"}
          />
          <Text
            style={[
              styles.fixButtonText,
              hasActiveSession && styles.fixButtonTextActive,
            ]}
          >
            {hasActiveSession ? "AI Working..." : "Fix with AI"}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  count,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
  color?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      {color && <View style={[styles.filterDot, { backgroundColor: color }]} />}
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

export function IssuesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isGlobal, siteId } = useCurrentScope();
  const { authenticate } = useBiometricAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeSessions, setActiveSessions] = useState<AISession[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/api/integrations/sentry?action=issues`);
      if (!response.ok) throw new Error("Failed to fetch issues");

      const data = await response.json();
      const mappedIssues: Issue[] = (data.issues || []).map((i: Record<string, unknown>) => ({
        id: i.id as string,
        source: "sentry" as const,
        shortId: i.shortId as string,
        title: i.title as string,
        culprit: i.culprit as string,
        level: i.level as IssueSeverity,
        count: parseInt(i.count as string || "0", 10),
        userCount: i.userCount as number || 0,
        firstSeen: i.firstSeen as string,
        lastSeen: i.lastSeen as string,
        project: i.project as Issue["project"],
      }));

      setIssues(mappedIssues);
    } catch (err) {
      console.error("Error fetching issues:", err);
      setError(err instanceof Error ? err.message : "Failed to load issues");
    }
  }, []);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/ai-dev?action=active`);
      if (!response.ok) return;

      const data = await response.json();
      setActiveSessions(data.sessions || []);
    } catch (err) {
      console.error("Error fetching active sessions:", err);
    }
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([fetchIssues(), fetchActiveSessions()]);
  }, [fetchIssues, fetchActiveSessions]);

  React.useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleFixWithAI = useCallback(
    async (issue: Issue) => {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Fix with AI",
          `Start an AI-assisted fix session for:\n\n"${issue.title}"?\n\nThis will create a new branch and the AI will analyze the issue and propose a fix.`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Start Fix", style: "default", onPress: () => resolve(true) },
          ]
        );
      });

      if (!confirmed) return;

      const authenticated = await authenticate("dangerous");
      if (!authenticated) {
        Alert.alert("Authentication Required", "Biometric authentication is required for AI operations.");
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/ai-dev`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            issueSource: issue.source,
            issueId: issue.id,
            issueTitle: issue.title,
            issueSeverity: issue.level,
            applicationName: issue.project.name,
            repositoryUrl: `https://gitea.gmac.io/${issue.project.slug}`,
            branch: "main",
            agentType: "claude",
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to create session");
        }

        const data = await response.json();

        const startResponse = await fetch(`${API_BASE}/api/ai-dev`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            sessionId: data.session.id,
          }),
        });

        if (!startResponse.ok) {
          console.error("Failed to start session:", await startResponse.text());
        }

        Alert.alert(
          "AI Fix Started",
          "The AI is now analyzing the issue. You can monitor progress in the AI Sessions screen.",
          [
            {
              text: "View Session",
              onPress: () =>
                navigation.navigate("AISessionDetail", { sessionId: data.session.id }),
            },
            { text: "OK" },
          ]
        );

        fetchActiveSessions();
      } catch (err) {
        console.error("Error starting AI fix:", err);
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "Failed to start AI fix session"
        );
      }
    },
    [authenticate, navigation, fetchActiveSessions]
  );

  const filteredIssues = useMemo(() => {
    let filtered = issues;

    if (filter !== "all") {
      filtered = filtered.filter((i) => i.level === filter);
    }

    return filtered;
  }, [issues, filter]);

  const issuesWithSessions = useMemo(() => {
    const activeIssueIds = new Set(activeSessions.map((s) => s.issueId));
    return filteredIssues.map((issue) => ({
      ...issue,
      hasActiveSession: activeIssueIds.has(issue.id),
    }));
  }, [filteredIssues, activeSessions]);

  const counts = useMemo(() => {
    return {
      all: issues.length,
      fatal: issues.filter((i) => i.level === "fatal").length,
      error: issues.filter((i) => i.level === "error").length,
      warning: issues.filter((i) => i.level === "warning").length,
    };
  }, [issues]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScopeBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading issues...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScopeBar />

      <View style={styles.filterRow}>
        <FilterChip
          label="All"
          active={filter === "all"}
          onPress={() => setFilter("all")}
          count={counts.all}
        />
        <FilterChip
          label="Fatal"
          active={filter === "fatal"}
          onPress={() => setFilter("fatal")}
          count={counts.fatal}
          color="#dc2626"
        />
        <FilterChip
          label="Error"
          active={filter === "error"}
          onPress={() => setFilter("error")}
          count={counts.error}
          color="#ef4444"
        />
        <FilterChip
          label="Warning"
          active={filter === "warning"}
          onPress={() => setFilter("warning")}
          count={counts.warning}
          color="#f59e0b"
        />
      </View>

      {activeSessions.length > 0 && (
        <TouchableOpacity
          style={styles.activeSessionsBanner}
          onPress={() => navigation.navigate("AISessionsList" as never)}
        >
          <Ionicons name="flash" size={16} color="#22c55e" />
          <Text style={styles.activeSessionsText}>
            {activeSessions.length} AI session{activeSessions.length > 1 ? "s" : ""} in progress
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#64748b" />
        </TouchableOpacity>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to load issues</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={issuesWithSessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <IssueCard
              issue={item}
              onPress={() => navigation.navigate("IssueDetail", { issueId: item.id })}
              onFixWithAI={() => handleFixWithAI(item)}
              hasActiveSession={item.hasActiveSession || false}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              <Text style={styles.emptyTitle}>No issues found</Text>
              <Text style={styles.emptyText}>
                All clear! No unresolved issues in your projects.
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
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  activeSessionsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#22c55e",
    gap: 8,
  },
  activeSessionsText: {
    flex: 1,
    fontSize: 13,
    color: "#e2e8f0",
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  issueCard: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  severityIndicator: {
    width: 4,
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
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shortId: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#64748b",
  },
  timestamp: {
    fontSize: 11,
    color: "#64748b",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
    lineHeight: 20,
  },
  culprit: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
    fontFamily: "monospace",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: "#64748b",
  },
  projectName: {
    fontSize: 11,
    color: "#64748b",
    marginLeft: "auto",
  },
  fixButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#22c55e20",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  fixButtonActive: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  fixButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22c55e",
  },
  fixButtonTextActive: {
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
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
