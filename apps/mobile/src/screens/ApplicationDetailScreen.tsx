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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useBiometricAuth } from "../hooks/useBiometricAuth";

type Props = NativeStackScreenProps<RootStackParamList, "ApplicationDetail">;

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onPress?: () => void;
}

function InfoRow({ icon, label, value, onPress }: InfoRowProps) {
  const content = (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#64748b" style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, onPress && styles.infoValueLink]} numberOfLines={1}>
        {value}
      </Text>
      {onPress && <Ionicons name="open-outline" size={16} color="#3b82f6" />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

interface DeploymentItemProps {
  id: string;
  version: string;
  environment: string;
  status: string;
  triggeredBy: string;
  commitMessage: string;
  startedAt: string;
  onRollback?: () => void;
}

function DeploymentItem({
  version,
  environment,
  status,
  triggeredBy,
  commitMessage,
  startedAt,
  onRollback,
}: DeploymentItemProps) {
  const getStatusColor = (s: string) => {
    switch (s) {
      case "succeeded":
        return "#22c55e";
      case "failed":
        return "#ef4444";
      case "running":
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
    <View style={styles.deploymentItem}>
      <View style={styles.deploymentHeader}>
        <View style={styles.deploymentVersion}>
          <Text style={styles.versionText}>v{version}</Text>
          <View style={[styles.envBadge, { backgroundColor: getEnvColor(environment) + "20" }]}>
            <Text style={[styles.envText, { color: getEnvColor(environment) }]}>
              {environment}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + "20" }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(status) }]}>{status}</Text>
        </View>
      </View>

      <Text style={styles.commitMessage} numberOfLines={1}>
        {commitMessage}
      </Text>

      <View style={styles.deploymentFooter}>
        <Text style={styles.deploymentMeta}>
          {triggeredBy} • {formatTimeAgo(startedAt)}
        </Text>
        {status === "succeeded" && onRollback && (
          <TouchableOpacity style={styles.rollbackButton} onPress={onRollback}>
            <Ionicons name="arrow-undo" size={14} color="#f59e0b" />
            <Text style={styles.rollbackText}>Rollback</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function ApplicationDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"overview" | "deployments">("overview");
  const { confirmDangerousAction } = useBiometricAuth();

  const appQuery = trpc.applications.byId.useQuery(id);
  const deploymentsQuery = trpc.deployments.list.useQuery({ appId: id, limit: 10 });
  const triggerDeployMutation = trpc.deployments.trigger.useMutation();
  const rollbackMutation = trpc.deployments.rollback.useMutation();

  React.useEffect(() => {
    if (appQuery.data) {
      navigation.setOptions({ headerTitle: appQuery.data.name });
    }
  }, [appQuery.data, navigation]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([appQuery.refetch(), deploymentsQuery.refetch()]);
    setRefreshing(false);
  }, [appQuery, deploymentsQuery]);

  const handleDeploy = async (environment: "staging" | "production") => {
    const actionName = environment === "production" ? "Deploy to Production" : "Deploy to Staging";

    await confirmDangerousAction(
      actionName,
      async () => {
        try {
          await triggerDeployMutation.mutateAsync({
            appId: id,
            environment,
          });
          Alert.alert("Success", `Deployment to ${environment} started`);
          deploymentsQuery.refetch();
        } catch (err) {
          Alert.alert("Error", "Failed to trigger deployment");
        }
      }
    );
  };

  const handleRollback = async (deploymentId: string) => {
    await confirmDangerousAction(
      "Rollback",
      async () => {
        try {
          await rollbackMutation.mutateAsync({ deploymentId });
          Alert.alert("Success", "Rollback started");
          deploymentsQuery.refetch();
        } catch (err) {
          Alert.alert("Error", "Failed to rollback");
        }
      }
    );
  };

  const openRepo = () => {
    if (appQuery.data?.repositoryUrl) {
      Linking.openURL(appQuery.data.repositoryUrl);
    }
  };

  const app = appQuery.data;
  const deployments = deploymentsQuery.data ?? [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "healthy":
        return "#22c55e";
      case "degraded":
        return "#f59e0b";
      case "inactive":
      case "error":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  if (appQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (appQuery.error || !app) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load application</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => appQuery.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
      }
    >
      <View style={styles.header}>
        <View style={styles.appIcon}>
          <Ionicons name="cube" size={32} color="#3b82f6" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.appName}>{app.name}</Text>
          <Text style={styles.appSlug}>{app.slug}</Text>
        </View>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(app.status) }]} />
      </View>

      {app.description && (
        <Text style={styles.description}>{app.description}</Text>
      )}

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "overview" && styles.activeTab]}
          onPress={() => setActiveTab("overview")}
        >
          <Text style={[styles.tabText, activeTab === "overview" && styles.activeTabText]}>
            Overview
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

      {activeTab === "overview" ? (
        <View style={styles.section}>
          <InfoRow icon="information-circle" label="Status" value={app.status} />
          <InfoRow icon="code-slash" label="Slug" value={app.slug} />
          {app.repositoryUrl && (
            <InfoRow
              icon="git-branch"
              label="Repository"
              value={app.repositoryUrl.replace("https://", "")}
              onPress={openRepo}
            />
          )}
          <InfoRow
            icon="calendar"
            label="Created"
            value={new Date(app.createdAt).toLocaleDateString()}
          />

          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.stagingButton]}
                onPress={() => handleDeploy("staging")}
              >
                <Ionicons name="rocket-outline" size={20} color="#f59e0b" />
                <Text style={styles.stagingButtonText}>Deploy Staging</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.productionButton]}
                onPress={() => handleDeploy("production")}
              >
                <Ionicons name="rocket" size={20} color="#fff" />
                <Text style={styles.productionButtonText}>Deploy Prod</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          {deployments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="rocket-outline" size={48} color="#64748b" />
              <Text style={styles.emptyTitle}>No Deployments</Text>
              <Text style={styles.emptyText}>Deploy your first version to get started</Text>
            </View>
          ) : (
            deployments.map((deployment) => (
              <DeploymentItem
                key={deployment.id}
                id={deployment.id}
                version={deployment.version}
                environment={deployment.environment}
                status={deployment.status}
                triggeredBy={deployment.triggeredBy}
                commitMessage={deployment.commitMessage}
                startedAt={deployment.startedAt}
                onRollback={
                  deployment.status === "succeeded"
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
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
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
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#1e293b",
    margin: 16,
    borderRadius: 12,
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#1e3a5f",
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  appName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  appSlug: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  description: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "#1e293b",
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
    fontWeight: "500",
  },
  activeTabText: {
    color: "#fff",
  },
  section: {
    margin: 16,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  infoIcon: {
    marginRight: 12,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 14,
    width: 80,
  },
  infoValue: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
  },
  infoValueLink: {
    color: "#3b82f6",
  },
  actionsSection: {
    padding: 16,
  },
  sectionTitle: {
    color: "#64748b",
    fontSize: 13,
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
  },
  productionButton: {
    backgroundColor: "#3b82f6",
  },
  productionButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  deploymentItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
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
  versionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  envBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  envText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  commitMessage: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 8,
  },
  deploymentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  deploymentMeta: {
    color: "#64748b",
    fontSize: 12,
  },
  rollbackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rollbackText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4,
  },
});
