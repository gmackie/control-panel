import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "../lib/trpc";
import { useTheme } from "../hooks/useTheme";
import { useDemoMode } from "../stores/settings";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useBiometricAuth } from "../hooks/useBiometricAuth";
import { PipelineStageDots, AlertRow } from "../components/dashboard";
import type { PipelineStageStatus } from "../components/dashboard";

type Props = NativeStackScreenProps<RootStackParamList, "ApplicationDetail">;

interface PipelineStep {
  stage: string;
  status: PipelineStageStatus;
}

interface DeploymentItemProps {
  id: string;
  version: string;
  environment: string;
  status: string;
  triggeredBy: string;
  commitMessage: string;
  commitSha: string;
  branch: string;
  startedAt: string;
  steps?: PipelineStep[];
  onRollback?: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}

function DeploymentItem({
  version,
  environment,
  status,
  triggeredBy,
  commitMessage,
  commitSha,
  branch,
  startedAt,
  steps,
  onRollback,
  colors,
}: DeploymentItemProps) {
  const [expanded, setExpanded] = React.useState(false);

  const getStatusColor = (s: string) => {
    switch (s) {
      case "succeeded":
      case "success":
        return "#22c55e";
      case "failed":
        return "#ef4444";
      case "running":
      case "in_progress":
        return "#3b82f6";
      case "pending":
        return "#f59e0b";
      default:
        return "#64748b";
    }
  };

  const getEnvColor = (env: string) => {
    switch (env) {
      case "production":
        return "#ef4444";
      case "staging":
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

  return (
    <View style={[styles.deploymentItem, { borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={styles.deploymentHeader}>
          <View style={styles.deploymentVersion}>
            <Text style={[styles.branchText, { color: colors.textMuted }]}>
              {branch}@{commitSha?.slice(0, 7) || version}
            </Text>
            <View style={[styles.envBadge, { backgroundColor: getEnvColor(environment) }]}>
              <Text style={styles.envBadgeText}>{environment.slice(0, 4).toUpperCase()}</Text>
            </View>
          </View>
          {steps && <PipelineStageDots steps={steps} compact />}
        </View>

        {expanded && (
          <View style={styles.expandedContent}>
            <Text style={[styles.commitMessage, { color: colors.text }]} numberOfLines={2}>
              {commitMessage || "No commit message"}
            </Text>

            <View style={styles.deploymentMeta}>
              <View style={styles.metaRow}>
                <Ionicons name="person" size={12} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>{triggeredBy}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="time" size={12} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {formatTimeAgo(startedAt)}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: getStatusColor(status) + "20" },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                <Text style={[styles.statusPillText, { color: getStatusColor(status) }]}>
                  {status}
                </Text>
              </View>
            </View>

            {status === "succeeded" && onRollback && (
              <TouchableOpacity style={styles.rollbackButton} onPress={onRollback}>
                <Ionicons name="arrow-undo" size={14} color="#f59e0b" />
                <Text style={styles.rollbackText}>Rollback to this version</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.expandToggle}
        onPress={() => setExpanded(!expanded)}
      >
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

export function ApplicationDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"alerts" | "deployments">("alerts");
  const { confirmDangerousAction } = useBiometricAuth();
  const demoMode = useDemoMode();

  const appQuery = trpc.applications.byId.useQuery(id);
  const alertsQuery = trpc.monitoring.alerts.useQuery({ appId: id, limit: 10, demoMode });
  const pipelinesQuery = trpc.pipelines.byApp.useQuery({ appId: id, limit: 10 });
  const triggerDeployMutation = trpc.deployments.trigger.useMutation();
  const rollbackMutation = trpc.deployments.rollback.useMutation();
  const acknowledgeMutation = trpc.monitoring.acknowledgeAlert.useMutation();

  React.useEffect(() => {
    if (appQuery.data) {
      navigation.setOptions({ headerTitle: appQuery.data.name });
    }
  }, [appQuery.data, navigation]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([appQuery.refetch(), alertsQuery.refetch(), pipelinesQuery.refetch()]);
    setRefreshing(false);
  }, [appQuery, alertsQuery, pipelinesQuery]);

  const handleDeploy = async (environment: "staging" | "production") => {
    const actionName = environment === "production" ? "Deploy to Production" : "Deploy to Staging";

    await confirmDangerousAction(actionName, async () => {
      try {
        await triggerDeployMutation.mutateAsync({ appId: id, environment });
        Alert.alert("Success", `Deployment to ${environment} started`);
        pipelinesQuery.refetch();
      } catch {
        Alert.alert("Error", "Failed to trigger deployment");
      }
    });
  };

  const handleRollback = async (deploymentId: string) => {
    await confirmDangerousAction("Rollback", async () => {
      try {
        await rollbackMutation.mutateAsync({ deploymentId });
        Alert.alert("Success", "Rollback started");
        pipelinesQuery.refetch();
      } catch {
        Alert.alert("Error", "Failed to rollback");
      }
    });
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeMutation.mutateAsync({ alertId });
      alertsQuery.refetch();
    } catch {
      Alert.alert("Error", "Failed to acknowledge alert");
    }
  };

  const openRepo = () => {
    if (appQuery.data?.repositoryUrl) {
      Linking.openURL(appQuery.data.repositoryUrl);
    }
  };

  const app = appQuery.data;
  const alerts = alertsQuery.data ?? [];
  const deployments = pipelinesQuery.data ?? [];

  const firingAlerts = alerts.filter((a) => a.status === "firing");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "healthy":
        return "#22c55e";
      case "degraded":
      case "warning":
        return "#f59e0b";
      case "inactive":
      case "error":
      case "critical":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  const getProviderIcon = (provider: string): React.ComponentProps<typeof Ionicons>["name"] => {
    const icons: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
      github: "logo-github",
      gitea: "git-branch",
      gitlab: "logo-gitlab",
      vercel: "triangle",
      kubernetes: "cube",
    };
    return icons[provider] || "code-slash";
  };

  if (appQuery.isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  if (appQuery.error || !app) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load application</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => appQuery.refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
      }
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={[styles.appIcon, { backgroundColor: isDark ? "#334155" : "#e2e8f0" }]}>
          <Text style={[styles.appInitials, { color: colors.text }]}>
            {app.name
              .split(/[\s-_]+/)
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.headerNameRow}>
            <Text style={[styles.appName, { color: colors.text }]}>{app.name}</Text>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(app.status) }]} />
          </View>
          <View style={styles.providerBadges}>
            {app.gitProvider && (
              <View style={[styles.providerBadge, { backgroundColor: colors.background }]}>
                <Ionicons name={getProviderIcon(app.gitProvider)} size={12} color={colors.textMuted} />
                <Text style={[styles.providerText, { color: colors.textMuted }]}>{app.gitProvider}</Text>
              </View>
            )}
            {app.deployProvider && (
              <View style={[styles.providerBadge, { backgroundColor: colors.background }]}>
                <Ionicons
                  name={getProviderIcon(app.deployProvider)}
                  size={12}
                  color={colors.textMuted}
                />
                <Text style={[styles.providerText, { color: colors.textMuted }]}>
                  {app.deployProvider}
                </Text>
              </View>
            )}
          </View>
        </View>
        {app.repositoryUrl && (
          <TouchableOpacity onPress={openRepo} style={styles.repoLink}>
            <Ionicons name="open-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabContainer, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "alerts" && styles.activeTab]}
          onPress={() => setActiveTab("alerts")}
        >
          <Text style={[styles.tabText, activeTab === "alerts" && styles.activeTabText]}>
            Alerts {firingAlerts.length > 0 && `(${firingAlerts.length})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "deployments" && styles.activeTab]}
          onPress={() => setActiveTab("deployments")}
        >
          <Text style={[styles.tabText, activeTab === "deployments" && styles.activeTabText]}>
            Deployments
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "alerts" ? (
        <View style={styles.section}>
          {firingAlerts.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>All Clear</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No active alerts for this application
              </Text>
            </View>
          ) : (
            <View style={styles.alertsList}>
              {firingAlerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  name={alert.name}
                  message={alert.message}
                  severity={alert.severity}
                  source={alert.source}
                  timestamp={new Date(alert.startsAt)}
                  onPress={() => navigation.navigate("AlertDetail", { id: alert.id })}
                />
              ))}
            </View>
          )}

          <View style={[styles.actionsSection, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.stagingButton]}
                onPress={() => handleDeploy("staging")}
              >
                <Ionicons name="rocket-outline" size={18} color="#f59e0b" />
                <Text style={styles.stagingButtonText}>Deploy Staging</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.productionButton]}
                onPress={() => handleDeploy("production")}
              >
                <Ionicons name="rocket" size={18} color="#fff" />
                <Text style={styles.productionButtonText}>Deploy Prod</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          {deployments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="rocket-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Deployments</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Deploy your first version to get started
              </Text>
            </View>
          ) : (
            deployments.map((deployment) => (
              <DeploymentItem
                key={deployment.id}
                id={deployment.id}
                version={deployment.commitSha?.slice(0, 7) || "latest"}
                environment={deployment.environment}
                status={deployment.status}
                triggeredBy={deployment.triggeredBy}
                commitMessage={deployment.commitMessage}
                commitSha={deployment.commitSha}
                branch={deployment.branch}
                startedAt={deployment.startedAt}
                steps={deployment.steps}
                colors={colors}
                onRollback={
                  deployment.status === "succeeded" || deployment.status === "success"
                    ? () => handleRollback(deployment.id)
                    : undefined
                }
              />
            ))
          )}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  appInitials: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  providerBadges: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  providerText: {
    fontSize: 10,
    fontWeight: "500",
  },
  repoLink: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: "#3b82f6",
  },
  tabText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 14,
  },
  activeTabText: {
    color: "#fff",
  },
  section: {
    margin: 16,
  },
  alertsList: {
    gap: 0,
  },
  actionsSection: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  stagingButton: {
    backgroundColor: "#f59e0b20",
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  stagingButtonText: {
    color: "#f59e0b",
    fontWeight: "600",
    fontSize: 13,
  },
  productionButton: {
    backgroundColor: "#3b82f6",
  },
  productionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  deploymentItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  deploymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deploymentVersion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  branchText: {
    fontSize: 13,
    fontFamily: "monospace",
  },
  envBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  envBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  expandedContent: {
    marginTop: 10,
  },
  commitMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  deploymentMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  rollbackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f59e0b20",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  rollbackText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "600",
  },
  expandToggle: {
    position: "absolute",
    right: 10,
    top: 12,
    padding: 4,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
});
