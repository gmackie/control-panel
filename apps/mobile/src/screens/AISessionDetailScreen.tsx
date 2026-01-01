import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useBiometricAuth } from "../hooks/useBiometricAuth";

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
  issueUrl?: string;
  issueSeverity?: string;
  applicationId?: string;
  applicationName?: string;
  repositoryUrl: string;
  branch: string;
  worktreeId?: string;
  agentType: string;
  agentInstanceId?: string;
  status: SessionStatus;
  analysisResult?: string;
  proposedFix?: string;
  filesChanged?: string;
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  prStatus?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  errorMessage?: string;
  createdBy?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface SessionLog {
  id: string;
  sessionId: string;
  level: string;
  phase: string;
  message: string;
  details?: string;
  progress?: number;
  timestamp: string;
}

const statusPhases: SessionStatus[] = [
  "pending",
  "cloning",
  "analyzing",
  "fixing",
  "testing",
  "review",
];

export function AISessionDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "AISessionDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authenticate } = useBiometricAuth();

  const { sessionId } = route.params;

  const [session, setSession] = useState<AISession | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/ai-dev?action=get&sessionId=${sessionId}`
      );
      if (!response.ok) throw new Error("Failed to fetch session");

      const data = await response.json();
      setSession(data.session);
    } catch (err) {
      console.error("Error fetching session:", err);
    }
  }, [sessionId]);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/ai-dev?action=logs&sessionId=${sessionId}&limit=50`
      );
      if (!response.ok) return;

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  }, [sessionId]);

  const loadData = useCallback(async () => {
    await Promise.all([fetchSession(), fetchLogs()]);
  }, [fetchSession, fetchLogs]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));

    const isActive = session?.status
      ? ["pending", "cloning", "analyzing", "fixing", "testing", "review"].includes(
          session.status
        )
      : true;

    if (isActive) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [loadData, session?.status]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCheckStatus = useCallback(async () => {
    if (!session) return;
    setActionLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai-dev`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-status", sessionId }),
      });

      if (!response.ok) throw new Error("Failed to check status");
      await loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to check status");
    } finally {
      setActionLoading(false);
    }
  }, [session, sessionId, loadData]);

  const handleApprove = useCallback(async () => {
    if (!session) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Approve & Create PR",
        "This will apply the AI's fix and create a pull request. Continue?",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Approve", style: "default", onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    const authenticated = await authenticate("dangerous");
    if (!authenticated) {
      Alert.alert("Authentication Required", "Biometric authentication is required.");
      return;
    }

    setActionLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai-dev`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          sessionId,
          prTitle: `Fix: ${session.issueTitle}`,
          prBody: `Automated fix for ${session.issueSource} issue ${session.issueId}`,
        }),
      });

      if (!response.ok) throw new Error("Failed to approve");

      const data = await response.json();
      await loadData();

      if (data.pr?.prUrl) {
        Alert.alert("PR Created", `Pull request #${data.pr.prNumber} has been created.`, [
          { text: "View PR", onPress: () => Linking.openURL(data.pr.prUrl) },
          { text: "OK" },
        ]);
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  }, [session, sessionId, authenticate, loadData]);

  const handleReject = useCallback(async () => {
    if (!session) return;

    Alert.prompt(
      "Reject Fix",
      "Why are you rejecting this fix? (optional)",
      async (reason) => {
        setActionLoading(true);

        try {
          const response = await fetch(`${API_BASE}/api/ai-dev`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject", sessionId, reason }),
          });

          if (!response.ok) throw new Error("Failed to reject");
          await loadData();
        } catch (err) {
          Alert.alert("Error", err instanceof Error ? err.message : "Failed to reject");
        } finally {
          setActionLoading(false);
        }
      },
      "plain-text"
    );
  }, [session, sessionId, loadData]);

  const handleCancel = useCallback(async () => {
    if (!session) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Cancel Session",
        "Are you sure you want to cancel this AI fix session?",
        [
          { text: "No", style: "cancel", onPress: () => resolve(false) },
          { text: "Yes, Cancel", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    setActionLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai-dev`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", sessionId }),
      });

      if (!response.ok) throw new Error("Failed to cancel");
      await loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  }, [session, sessionId, loadData]);

  const getStatusInfo = (status: SessionStatus) => {
    const statusMap: Record<SessionStatus, { color: string; icon: string; label: string }> = {
      pending: { color: "#6b7280", icon: "time", label: "Pending" },
      cloning: { color: "#3b82f6", icon: "git-branch", label: "Cloning Repository" },
      analyzing: { color: "#8b5cf6", icon: "search", label: "Analyzing Issue" },
      fixing: { color: "#f59e0b", icon: "hammer", label: "Applying Fix" },
      testing: { color: "#06b6d4", icon: "flask", label: "Running Tests" },
      review: { color: "#ec4899", icon: "eye", label: "Ready for Review" },
      approved: { color: "#22c55e", icon: "checkmark-circle", label: "Approved" },
      merged: { color: "#22c55e", icon: "git-merge", label: "Merged" },
      failed: { color: "#ef4444", icon: "close-circle", label: "Failed" },
      cancelled: { color: "#6b7280", icon: "ban", label: "Cancelled" },
    };
    return statusMap[status] || statusMap.pending;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading || !session) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading session...</Text>
        </View>
      </View>
    );
  }

  const statusInfo = getStatusInfo(session.status);
  const isActive = ["pending", "cloning", "analyzing", "fixing", "testing", "review"].includes(
    session.status
  );
  const isReview = session.status === "review";
  const currentPhaseIndex = statusPhases.indexOf(session.status);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
    >
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + "20" }]}>
          <Ionicons
            name={statusInfo.icon as keyof typeof Ionicons.glyphMap}
            size={18}
            color={statusInfo.color}
          />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
          {isActive && <ActivityIndicator size="small" color={statusInfo.color} />}
        </View>

        <Text style={styles.title}>{session.issueTitle}</Text>

        <View style={styles.metaRow}>
          <Ionicons
            name={session.issueSource === "sentry" ? "bug" : "analytics"}
            size={14}
            color="#64748b"
          />
          <Text style={styles.metaText}>{session.issueSource}</Text>
          {session.applicationName && (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{session.applicationName}</Text>
            </>
          )}
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{session.agentType}</Text>
        </View>
      </View>

      {isActive && (
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.progressBar}>
            {statusPhases.map((phase, index) => {
              const isComplete = index < currentPhaseIndex;
              const isCurrent = index === currentPhaseIndex;
              return (
                <View key={phase} style={styles.progressStep}>
                  <View
                    style={[
                      styles.progressDot,
                      isComplete && styles.progressDotComplete,
                      isCurrent && styles.progressDotCurrent,
                    ]}
                  >
                    {isComplete && (
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    )}
                    {isCurrent && <ActivityIndicator size="small" color="#fff" />}
                  </View>
                  <Text
                    style={[
                      styles.progressLabel,
                      (isComplete || isCurrent) && styles.progressLabelActive,
                    ]}
                  >
                    {phase.charAt(0).toUpperCase() + phase.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {isReview && (
        <View style={styles.reviewSection}>
          <Text style={styles.sectionTitle}>Review Required</Text>
          <Text style={styles.reviewText}>
            The AI has analyzed the issue and proposed a fix. Review the changes and approve to
            create a pull request.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              disabled={actionLoading}
            >
              <Ionicons name="close" size={18} color="#ef4444" />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.approveButtonText}>Approve & Create PR</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {session.prUrl && (
        <TouchableOpacity
          style={styles.prSection}
          onPress={() => Linking.openURL(session.prUrl!)}
        >
          <Ionicons name="git-pull-request" size={20} color="#22c55e" />
          <View style={styles.prInfo}>
            <Text style={styles.prTitle}>{session.prTitle || `PR #${session.prNumber}`}</Text>
            <Text style={styles.prStatus}>{session.prStatus || "open"}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color="#64748b" />
        </TouchableOpacity>
      )}

      {session.errorMessage && (
        <View style={styles.errorSection}>
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{session.errorMessage}</Text>
        </View>
      )}

      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Repository</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {session.repositoryUrl}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Branch</Text>
          <Text style={styles.detailValue}>{session.branch}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>{formatDateTime(session.createdAt)}</Text>
        </View>
        {session.startedAt && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Started</Text>
            <Text style={styles.detailValue}>{formatDateTime(session.startedAt)}</Text>
          </View>
        )}
        {session.completedAt && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Completed</Text>
            <Text style={styles.detailValue}>{formatDateTime(session.completedAt)}</Text>
          </View>
        )}
      </View>

      {logs.length > 0 && (
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          {logs.slice(0, 10).map((log) => (
            <View key={log.id} style={styles.logEntry}>
              <View
                style={[
                  styles.logDot,
                  { backgroundColor: log.level === "error" ? "#ef4444" : "#3b82f6" },
                ]}
              />
              <View style={styles.logContent}>
                <Text style={styles.logMessage}>{log.message}</Text>
                <Text style={styles.logTimestamp}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {isActive && session.status !== "review" && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.checkStatusButton}
            onPress={handleCheckStatus}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color="#3b82f6" />
                <Text style={styles.checkStatusText}>Check Status</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={actionLoading}
          >
            <Ionicons name="close-circle" size={16} color="#ef4444" />
            <Text style={styles.cancelText}>Cancel Session</Text>
          </TouchableOpacity>
        </View>
      )}

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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: "#64748b",
  },
  metaDot: {
    color: "#475569",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  progressBar: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  progressDotComplete: {
    backgroundColor: "#22c55e",
  },
  progressDotCurrent: {
    backgroundColor: "#3b82f6",
  },
  progressLabel: {
    fontSize: 10,
    color: "#475569",
    textAlign: "center",
  },
  progressLabelActive: {
    color: "#94a3b8",
  },
  reviewSection: {
    padding: 16,
    backgroundColor: "#1e293b",
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ec489980",
  },
  reviewText: {
    fontSize: 14,
    color: "#e2e8f0",
    marginBottom: 16,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: "#ef444420",
  },
  rejectButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  approveButton: {
    backgroundColor: "#22c55e",
  },
  approveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  prSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    margin: 16,
    backgroundColor: "#22c55e20",
    borderRadius: 12,
    gap: 12,
  },
  prInfo: {
    flex: 1,
  },
  prTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22c55e",
  },
  prStatus: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "capitalize",
  },
  errorSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    margin: 16,
    backgroundColor: "#ef444420",
    borderRadius: 12,
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#fca5a5",
    lineHeight: 20,
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
  logsSection: {
    padding: 16,
  },
  logEntry: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 10,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  logContent: {
    flex: 1,
  },
  logMessage: {
    fontSize: 13,
    color: "#e2e8f0",
    marginBottom: 2,
  },
  logTimestamp: {
    fontSize: 11,
    color: "#64748b",
  },
  bottomActions: {
    padding: 16,
    gap: 12,
  },
  checkStatusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8,
  },
  checkStatusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    color: "#ef4444",
  },
  bottomPadding: {
    height: 50,
  },
});
