import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type IssueSeverity = "fatal" | "error" | "warning" | "info";

interface IssueDetail {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: IssueSeverity;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink?: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  metadata?: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
  tags?: Array<{ key: string; value: string }>;
}

export function IssueDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "IssueDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { issueId } = route.params;

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIssue = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(
        `${API_BASE}/api/integrations/sentry?action=issue&issueId=${issueId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch issue details");
      }

      const data = await response.json();
      setIssue(data.issue);
    } catch (err) {
      console.error("Error fetching issue:", err);
      setError(err instanceof Error ? err.message : "Failed to load issue");
    }
  }, [issueId]);

  useEffect(() => {
    fetchIssue().finally(() => setLoading(false));
  }, [fetchIssue]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchIssue();
    setRefreshing(false);
  }, [fetchIssue]);

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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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

  const handleOpenInSentry = () => {
    if (issue?.permalink) {
      Linking.openURL(issue.permalink);
    }
  };

  const handleStartAIFix = () => {
    navigation.navigate("AISessionDetail", { sessionId: "new" });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading issue...</Text>
        </View>
      </View>
    );
  }

  if (error || !issue) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to load issue</Text>
          <Text style={styles.errorText}>{error || "Issue not found"}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const severityColor = getSeverityColor(issue.level);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
    >
      <View style={styles.header}>
        <View style={[styles.severityBadge, { backgroundColor: severityColor + "20" }]}>
          <Ionicons name="bug" size={16} color={severityColor} />
          <Text style={[styles.severityText, { color: severityColor }]}>
            {issue.level.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.shortId}>{issue.shortId}</Text>
        <Text style={styles.title}>{issue.title}</Text>

        {issue.culprit && (
          <Text style={styles.culprit}>{issue.culprit}</Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="repeat" size={16} color="#64748b" />
          <Text style={styles.statValue}>{issue.count.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="people" size={16} color="#64748b" />
          <Text style={styles.statValue}>{issue.userCount.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time" size={16} color="#64748b" />
          <Text style={styles.statValue}>{formatTimeAgo(issue.lastSeen)}</Text>
          <Text style={styles.statLabel}>Last Seen</Text>
        </View>
      </View>

      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Details</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Project</Text>
          <Text style={styles.detailValue}>{issue.project.name}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>First Seen</Text>
          <Text style={styles.detailValue}>{formatDateTime(issue.firstSeen)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Last Seen</Text>
          <Text style={styles.detailValue}>{formatDateTime(issue.lastSeen)}</Text>
        </View>

        {issue.metadata?.type && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Exception Type</Text>
            <Text style={styles.detailValue}>{issue.metadata.type}</Text>
          </View>
        )}

        {issue.metadata?.filename && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>File</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {issue.metadata.filename}
            </Text>
          </View>
        )}

        {issue.metadata?.function && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Function</Text>
            <Text style={styles.detailValue}>{issue.metadata.function}</Text>
          </View>
        )}
      </View>

      {issue.tags && issue.tags.length > 0 && (
        <View style={styles.tagsSection}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsContainer}>
            {issue.tags.slice(0, 10).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagKey}>{tag.key}</Text>
                <Text style={styles.tagValue}>{tag.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.actionsSection}>
        {issue.permalink && (
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenInSentry}>
            <Ionicons name="open-outline" size={18} color="#3b82f6" />
            <Text style={styles.actionButtonText}>View in Sentry</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  severityText: {
    fontSize: 12,
    fontWeight: "700",
  },
  shortId: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#64748b",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    lineHeight: 24,
  },
  culprit: {
    fontSize: 13,
    fontFamily: "monospace",
    color: "#64748b",
  },
  statsRow: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailsSection: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  detailLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  detailValue: {
    fontSize: 13,
    color: "#e2e8f0",
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  tagsSection: {
    padding: 16,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 6,
    overflow: "hidden",
  },
  tagKey: {
    fontSize: 11,
    color: "#94a3b8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#334155",
  },
  tagValue: {
    fontSize: 11,
    color: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionsSection: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  bottomPadding: {
    height: 50,
  },
});
