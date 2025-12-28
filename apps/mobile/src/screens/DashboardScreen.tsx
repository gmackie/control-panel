import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { trpc } from "../lib/trpc";
import type { RootTabParamList } from "../../App";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  trend?: { value: number; direction: "up" | "down" };
}

function StatCard({ title, value, icon, color, trend }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {trend && (
        <View style={styles.trendContainer}>
          <Ionicons
            name={trend.direction === "up" ? "arrow-up" : "arrow-down"}
            size={12}
            color={trend.direction === "up" ? "#22c55e" : "#ef4444"}
          />
          <Text
            style={[
              styles.trendText,
              { color: trend.direction === "up" ? "#22c55e" : "#ef4444" },
            ]}
          >
            {Math.abs(trend.value)}%
          </Text>
        </View>
      )}
    </View>
  );
}

interface AlertItemProps {
  severity: "critical" | "warning" | "info";
  message: string;
  time: string;
}

function AlertItem({ severity, message, time }: AlertItemProps) {
  const colors = {
    critical: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  return (
    <View style={[styles.alertItem, { borderLeftColor: colors[severity] }]}>
      <View style={styles.alertContent}>
        <Ionicons
          name={severity === "critical" ? "alert-circle" : "warning"}
          size={18}
          color={colors[severity]}
        />
        <Text style={styles.alertMessage} numberOfLines={2}>
          {message}
        </Text>
      </View>
      <Text style={styles.alertTime}>{time}</Text>
    </View>
  );
}

type DashboardNavigationProp = BottomTabNavigationProp<RootTabParamList, "Dashboard">;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const [refreshing, setRefreshing] = React.useState(false);

  // Fetch data using tRPC
  const healthQuery = trpc.monitoring.healthSummary.useQuery();
  const alertsQuery = trpc.monitoring.alerts.useQuery({ limit: 5 });
  const deploymentsQuery = trpc.deployments.stats.useQuery();
  const clusterHealthQuery = trpc.clusters.health.useQuery();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      healthQuery.refetch(),
      alertsQuery.refetch(),
      deploymentsQuery.refetch(),
      clusterHealthQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [healthQuery, alertsQuery, deploymentsQuery, clusterHealthQuery]);

  const health = healthQuery.data;
  const alerts = alertsQuery.data ?? [];
  const deploymentStats = deploymentsQuery.data;
  const clusterHealth = clusterHealthQuery.data;

  // Debug: Log any errors
  React.useEffect(() => {
    if (healthQuery.error) console.error("[Dashboard] healthQuery error:", healthQuery.error);
    if (alertsQuery.error) console.error("[Dashboard] alertsQuery error:", alertsQuery.error);
    if (deploymentsQuery.error) console.error("[Dashboard] deploymentsQuery error:", deploymentsQuery.error);
    if (clusterHealthQuery.error) console.error("[Dashboard] clusterHealthQuery error:", clusterHealthQuery.error);
  }, [healthQuery.error, alertsQuery.error, deploymentsQuery.error, clusterHealthQuery.error]);

  // Show error state if all queries failed
  const hasError = healthQuery.isError && alertsQuery.isError;
  const errorMessage = healthQuery.error?.message || alertsQuery.error?.message || "Failed to connect to API";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "#22c55e";
      case "degraded":
        return "#f59e0b";
      case "unhealthy":
        return "#ef4444";
      default:
        return "#6b7280";
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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
        />
      }
    >
      {/* Error Banner */}
      {hasError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Overall Status */}
      <View style={styles.statusBanner}>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: getStatusColor(health?.status ?? "unknown") },
          ]}
        />
        <Text style={styles.statusText}>
          System Status:{" "}
          <Text style={{ color: getStatusColor(health?.status ?? "unknown") }}>
            {healthQuery.isLoading ? "Loading..." : health?.status?.toUpperCase() ?? "Unknown"}
          </Text>
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Services"
          value={`${health?.services.healthy ?? 0}/${health?.services.total ?? 0}`}
          icon="server"
          color="#3b82f6"
        />
        <StatCard
          title="Nodes"
          value={`${clusterHealth?.readyNodes ?? 0}/${clusterHealth?.totalNodes ?? 0}`}
          icon="git-network"
          color="#8b5cf6"
        />
        <StatCard
          title="Deployments"
          value={deploymentStats?.succeeded ?? 0}
          icon="rocket"
          color="#22c55e"
          trend={{ value: 12, direction: "up" }}
        />
        <StatCard
          title="Alerts"
          value={health?.alerts.total ?? 0}
          icon="notifications"
          color={
            (health?.alerts.critical ?? 0) > 0
              ? "#ef4444"
              : (health?.alerts.warning ?? 0) > 0
              ? "#f59e0b"
              : "#22c55e"
          }
        />
      </View>

      {/* Metrics Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Metrics</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>CPU</Text>
            <Text style={styles.metricValue}>
              {health?.metrics.avgCpu ?? 0}%
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Memory</Text>
            <Text style={styles.metricValue}>
              {health?.metrics.avgMemory ?? 0}%
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Error Rate</Text>
            <Text style={styles.metricValue}>
              {health?.metrics.errorRate ?? 0}%
            </Text>
          </View>
        </View>
      </View>

      {/* Recent Alerts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Alerts")}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
            <Text style={styles.emptyText}>No active alerts</Text>
          </View>
        ) : (
          alerts.slice(0, 5).map((alert) => (
            <AlertItem
              key={alert.id}
              severity={alert.severity}
              message={alert.message}
              time={formatTimeAgo(alert.startsAt)}
            />
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate("Pipelines")}
          >
            <Ionicons name="rocket" size={24} color="#3b82f6" />
            <Text style={styles.actionText}>Deploy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                "Restart Services",
                "Select an application to restart from the Applications tab.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Go to Apps", onPress: () => navigation.navigate("Applications") }
                ]
              );
            }}
          >
            <Ionicons name="refresh" size={24} color="#22c55e" />
            <Text style={styles.actionText}>Restart</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                "System Metrics",
                `CPU: ${health?.metrics.avgCpu ?? 0}%\nMemory: ${health?.metrics.avgMemory ?? 0}%\nError Rate: ${health?.metrics.errorRate ?? 0}%\n\nNodes: ${clusterHealth?.readyNodes ?? 0}/${clusterHealth?.totalNodes ?? 0} ready`,
                [{ text: "OK" }]
              );
            }}
          >
            <Ionicons name="analytics" size={24} color="#8b5cf6" />
            <Text style={styles.actionText}>Metrics</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                "Logs",
                "View application logs from the Applications tab.\n\nTap an application to see its details and logs.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Go to Apps", onPress: () => navigation.navigate("Applications") }
                ]
              );
            }}
          >
            <Ionicons name="terminal" size={24} color="#f59e0b" />
            <Text style={styles.actionText}>Logs</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    marginTop: 8,
  },
  statCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    margin: 8,
    width: "45%",
    borderLeftWidth: 4,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statTitle: {
    color: "#94a3b8",
    fontSize: 14,
    marginLeft: 8,
  },
  statValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  trendText: {
    fontSize: 12,
    marginLeft: 4,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  viewAll: {
    color: "#3b82f6",
    fontSize: 14,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
  },
  metricItem: {
    alignItems: "center",
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 4,
  },
  metricValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  alertItem: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  alertMessage: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  alertTime: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 26,
  },
  emptyState: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#1e293b",
    borderRadius: 12,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    width: "23%",
  },
  actionText: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 8,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7f1d1d",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
});
