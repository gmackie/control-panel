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
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { trpc } from "../lib/trpc";
import { ScopeBar } from "../components/ScopeBar";
import {
  useScopeStore,
  useCurrentScope,
  useGlobalStats,
  type Site,
} from "../stores/scope";
import type { RootTabParamList, RootStackParamList } from "../../App";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  onPress?: () => void;
}

function StatCard({ title, value, icon, color, onPress }: StatCardProps) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </TouchableOpacity>
  );
}

interface NeedsAttentionItemProps {
  siteName: string;
  message: string;
  severity: "critical" | "warning" | "info";
  time: string;
  onPress?: () => void;
  onAck?: () => void;
}

function NeedsAttentionItem({
  siteName,
  message,
  severity,
  time,
  onPress,
  onAck,
}: NeedsAttentionItemProps) {
  const colors = {
    critical: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  return (
    <TouchableOpacity
      style={styles.attentionItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[styles.attentionDot, { backgroundColor: colors[severity] }]}
      />
      <View style={styles.attentionContent}>
        <Text style={styles.attentionSite}>{siteName}</Text>
        <Text style={styles.attentionMessage} numberOfLines={1}>
          {message}
        </Text>
        <Text style={styles.attentionTime}>{time}</Text>
      </View>
      {onAck && (
        <TouchableOpacity
          style={styles.ackButton}
          onPress={(e) => {
            e.stopPropagation();
            onAck();
          }}
        >
          <Text style={styles.ackButtonText}>Ack</Text>
        </TouchableOpacity>
      )}
      <Ionicons name="chevron-forward" size={16} color="#64748b" />
    </TouchableOpacity>
  );
}

interface SiteHealthCardProps {
  site: Site;
  onPress: () => void;
}

function SiteHealthCard({ site, onPress }: SiteHealthCardProps) {
  const getStatusColor = (status: Site["status"]) => {
    switch (status) {
      case "healthy":
        return "#22c55e";
      case "degraded":
        return "#f59e0b";
      case "unhealthy":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  return (
    <TouchableOpacity
      style={styles.siteCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.siteStatusRing,
          { borderColor: getStatusColor(site.status) },
        ]}
      >
        <Text style={styles.siteInitial}>{site.name.charAt(0)}</Text>
      </View>
      <Text style={styles.siteName} numberOfLines={1}>
        {site.name}
      </Text>
      <View style={styles.siteStats}>
        {site.criticalAlerts > 0 && (
          <View style={styles.siteBadge}>
            <Text style={styles.siteBadgeText}>{site.criticalAlerts}C</Text>
          </View>
        )}
        {site.warningAlerts > 0 && (
          <View style={[styles.siteBadge, styles.warningBadge]}>
            <Text style={[styles.siteBadgeText, styles.warningText]}>
              {site.warningAlerts}W
            </Text>
          </View>
        )}
        {site.isDeploying && (
          <View style={[styles.siteBadge, styles.deployingBadge]}>
            <Ionicons name="rocket" size={10} color="#93c5fd" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, "Dashboard">,
  NativeStackNavigationProp<RootStackParamList>
>;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const [refreshing, setRefreshing] = React.useState(false);

  const { isGlobal, siteId } = useCurrentScope();
  const globalStats = useGlobalStats();
  const { sites, lastUpdated, setSites, setSiteScope } = useScopeStore();

  const healthQuery = trpc.monitoring.healthSummary.useQuery();
  const alertsQuery = trpc.monitoring.alerts.useQuery({ limit: 5 });
  const deploymentsQuery = trpc.deployments.stats.useQuery();
  const clusterHealthQuery = trpc.clusters.health.useQuery();
  const applicationsQuery = trpc.applications.list.useQuery();

  React.useEffect(() => {
    if (applicationsQuery.data) {
      const appSites: Site[] = applicationsQuery.data.map((app) => ({
        id: app.id,
        name: app.name,
        slug: app.slug,
        status:
          app.status === "active"
            ? "healthy"
            : app.status === "deploying"
            ? "degraded"
            : "unhealthy",
        criticalAlerts: 0,
        warningAlerts: 0,
        isDeploying: app.status === "deploying",
      }));
      setSites(appSites);
    }
  }, [applicationsQuery.data, setSites]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      healthQuery.refetch(),
      alertsQuery.refetch(),
      deploymentsQuery.refetch(),
      clusterHealthQuery.refetch(),
      applicationsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [
    healthQuery,
    alertsQuery,
    deploymentsQuery,
    clusterHealthQuery,
    applicationsQuery,
  ]);

  const health = healthQuery.data;
  const alerts = alertsQuery.data ?? [];
  const deploymentStats = deploymentsQuery.data;
  const clusterHealth = clusterHealthQuery.data;

  React.useEffect(() => {
    if (healthQuery.error)
      console.error("[Dashboard] healthQuery error:", healthQuery.error);
    if (alertsQuery.error)
      console.error("[Dashboard] alertsQuery error:", alertsQuery.error);
    if (deploymentsQuery.error)
      console.error("[Dashboard] deploymentsQuery error:", deploymentsQuery.error);
    if (clusterHealthQuery.error)
      console.error("[Dashboard] clusterHealthQuery error:", clusterHealthQuery.error);
  }, [
    healthQuery.error,
    alertsQuery.error,
    deploymentsQuery.error,
    clusterHealthQuery.error,
  ]);

  const hasError = healthQuery.isError && alertsQuery.isError;
  const errorMessage =
    healthQuery.error?.message ||
    alertsQuery.error?.message ||
    "Failed to connect to API";

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

  const getHealthPercentage = () => {
    if (isGlobal && globalStats.totalSites > 0) {
      return Math.round(
        (globalStats.healthySites / globalStats.totalSites) * 100
      );
    }
    const servicesHealthy = health?.services.healthy ?? 0;
    const servicesTotal = health?.services.total ?? 1;
    return Math.round((servicesHealthy / servicesTotal) * 100);
  };

  const handleSitePress = (site: Site) => {
    setSiteScope(site.id);
  };

  const handleAckAlert = (alertId: string) => {
    Alert.alert("Acknowledge Alert", "Mark this alert as acknowledged?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Acknowledge",
        onPress: () => console.log("Ack alert:", alertId),
      },
    ]);
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
      <ScopeBar lastUpdated={lastUpdated} />

      {hasError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.northStarRow}>
        <View style={styles.northStarItem}>
          <Text style={styles.northStarValue}>{getHealthPercentage()}%</Text>
          <Text style={styles.northStarLabel}>Healthy</Text>
        </View>
        <View style={styles.northStarDivider} />
        <View style={styles.northStarItem}>
          <Text
            style={[
              styles.northStarValue,
              globalStats.totalCritical > 0 && styles.criticalValue,
            ]}
          >
            {isGlobal ? globalStats.totalCritical : health?.alerts.critical ?? 0}
          </Text>
          <Text style={styles.northStarLabel}>Critical</Text>
        </View>
        <View style={styles.northStarDivider} />
        <View style={styles.northStarItem}>
          <Text style={styles.northStarValue}>
            {deploymentStats?.running ?? 0}
          </Text>
          <Text style={styles.northStarLabel}>Deploying</Text>
        </View>
      </View>

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
            onPress={() => navigation.navigate("Activity")}
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
          onPress={() => navigation.navigate("Alerts")}
        />
      </View>

      {alerts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Needs Attention</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Alerts")}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {alerts.slice(0, 3).map((alert) => (
            <NeedsAttentionItem
              key={alert.id}
              siteName={alert.source || "System"}
              message={alert.message}
              severity={alert.severity}
              time={formatTimeAgo(alert.startsAt)}
              onPress={() => navigation.navigate("Alerts")}
              onAck={() => handleAckAlert(alert.id)}
            />
          ))}
        </View>
      )}

      {isGlobal && sites.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sites Health</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Applications")}
            >
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sitesGrid}>
            {sites.slice(0, 6).map((site) => (
              <SiteHealthCard
                key={site.id}
                site={site}
                onPress={() => handleSitePress(site)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
          onPress={() => navigation.navigate("Activity")}
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
                  {
                    text: "Go to Apps",
                    onPress: () => navigation.navigate("Applications"),
                  },
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
                  {
                    text: "Go to Apps",
                    onPress: () => navigation.navigate("Applications"),
                  },
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
  northStarRow: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
  },
  northStarItem: {
    flex: 1,
    alignItems: "center",
  },
  northStarValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  criticalValue: {
    color: "#ef4444",
  },
  northStarLabel: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  northStarDivider: {
    width: 1,
    backgroundColor: "#334155",
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
    padding: 14,
    margin: 8,
    width: "45%",
    borderLeftWidth: 4,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statTitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginLeft: 8,
  },
  statValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  viewAll: {
    color: "#3b82f6",
    fontSize: 14,
  },
  attentionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  attentionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  attentionContent: {
    flex: 1,
  },
  attentionSite: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  attentionMessage: {
    color: "#fff",
    fontSize: 14,
    marginTop: 2,
  },
  attentionTime: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  ackButton: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  ackButtonText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
  },
  sitesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  siteCard: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    margin: 4,
    width: "31%",
    alignItems: "center",
  },
  siteStatusRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  siteInitial: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  siteName: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
  },
  siteStats: {
    flexDirection: "row",
    gap: 2,
    marginTop: 4,
  },
  siteBadge: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  siteBadgeText: {
    color: "#fecaca",
    fontSize: 9,
    fontWeight: "600",
  },
  warningBadge: {
    backgroundColor: "#78350f",
  },
  warningText: {
    color: "#fde68a",
  },
  deployingBadge: {
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 3,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    width: "23%",
  },
  actionText: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 6,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7f1d1d",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
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
