import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

interface PipelineStatus {
  id: string;
  repository: string;
  commit: {
    sha: string;
    message: string;
    author: string;
    timestamp: string;
  };
  status: "success" | "running" | "failed" | "pending";
  stages: {
    build: "success" | "running" | "failed" | "pending" | "skipped";
    staging: "success" | "running" | "failed" | "pending" | "skipped";
    production: "success" | "running" | "failed" | "pending" | "skipped";
  };
}

function PipelineCard({ pipeline }: { pipeline: PipelineStatus }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "#22c55e";
      case "running":
        return "#3b82f6";
      case "failed":
        return "#ef4444";
      case "pending":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getStatusIcon = (status: string): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (status) {
      case "success":
        return "checkmark-circle";
      case "running":
        return "sync";
      case "failed":
        return "close-circle";
      case "pending":
        return "time";
      default:
        return "help-circle";
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.repoInfo}>
          <Ionicons name="git-branch" size={16} color="#94a3b8" />
          <Text style={styles.repoName}>{pipeline.repository}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(pipeline.status) + "20" },
          ]}
        >
          <Ionicons
            name={getStatusIcon(pipeline.status)}
            size={14}
            color={getStatusColor(pipeline.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(pipeline.status) }]}>
            {pipeline.status}
          </Text>
        </View>
      </View>

      <View style={styles.commitInfo}>
        <Text style={styles.commitSha}>{pipeline.commit.sha.substring(0, 7)}</Text>
        <Text style={styles.commitMessage} numberOfLines={1}>
          {pipeline.commit.message}
        </Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText}>{pipeline.commit.author}</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.metaText}>{formatTime(pipeline.commit.timestamp)}</Text>
      </View>

      <View style={styles.stages}>
        <View style={styles.stage}>
          <View
            style={[
              styles.stageIndicator,
              { backgroundColor: getStatusColor(pipeline.stages.build) },
            ]}
          />
          <Text style={styles.stageLabel}>Build</Text>
        </View>
        <Ionicons name="arrow-forward" size={12} color="#475569" />
        <View style={styles.stage}>
          <View
            style={[
              styles.stageIndicator,
              { backgroundColor: getStatusColor(pipeline.stages.staging) },
            ]}
          />
          <Text style={styles.stageLabel}>Staging</Text>
        </View>
        <Ionicons name="arrow-forward" size={12} color="#475569" />
        <View style={styles.stage}>
          <View
            style={[
              styles.stageIndicator,
              { backgroundColor: getStatusColor(pipeline.stages.production) },
            ]}
          />
          <Text style={styles.stageLabel}>Prod</Text>
        </View>
      </View>
    </View>
  );
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export function PipelinesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<PipelineStatus[]>([]);

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/pipeline?action=journeys&limit=15`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      
      const mapped: PipelineStatus[] = (data.journeys || []).map((j: any) => ({
        id: j.commit.sha,
        repository: j.commit.repository,
        commit: {
          sha: j.commit.sha,
          message: j.commit.message,
          author: j.commit.author,
          timestamp: j.commit.timestamp,
        },
        status: j.status,
        stages: {
          build: j.pipelines.length > 0 ? j.pipelines[0].status : "pending",
          staging: j.deployments.staging?.status || "pending",
          production: j.deployments.production?.status || "pending",
        },
      }));
      
      setPipelines(mapped);
    } catch (error) {
      console.error("Error fetching pipelines:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPipelines();
    setRefreshing(false);
  }, [fetchPipelines]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3b82f6"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Recent Pipelines</Text>
        <Text style={styles.subtitle}>
          {pipelines.length} deployments tracked
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="sync" size={32} color="#3b82f6" />
          <Text style={styles.loadingText}>Loading pipelines...</Text>
        </View>
      ) : pipelines.length > 0 ? (
        <View style={styles.list}>
          {pipelines.map((pipeline) => (
            <PipelineCard key={pipeline.id} pipeline={pipeline} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="git-commit" size={48} color="#475569" />
          <Text style={styles.emptyTitle}>No pipelines yet</Text>
          <Text style={styles.emptyText}>
            Push a commit to start tracking deployments
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  repoInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  repoName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
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
    fontWeight: "500",
    textTransform: "capitalize",
  },
  commitInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  commitSha: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#60a5fa",
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  commitMessage: {
    flex: 1,
    fontSize: 14,
    color: "#e2e8f0",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: "#64748b",
  },
  metaDot: {
    fontSize: 12,
    color: "#475569",
    marginHorizontal: 6,
  },
  stages: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 12,
  },
  stage: {
    alignItems: "center",
    gap: 4,
  },
  stageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageLabel: {
    fontSize: 11,
    color: "#94a3b8",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
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
