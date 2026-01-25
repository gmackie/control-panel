import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { trpc } from "../lib/trpc";
import { useTheme } from "../hooks/useTheme";
import { useDemoMode } from "../stores/settings";
import type { RootStackParamList, RootTabParamList } from "../../App";
import {
  HealthBanner,
  DeploymentCard,
  AppGridTile,
  AlertRow,
} from "../components/dashboard";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, "Dashboard">,
  NativeStackNavigationProp<RootStackParamList>
>;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const demoMode = useDemoMode();

  const appsQuery = trpc.applications.listWithHealth.useQuery();
  const alertsQuery = trpc.monitoring.alerts.useQuery({ limit: 5, demoMode });
  const pipelinesQuery = trpc.pipelines.journeys.useQuery({ limit: 5, activeOnly: true });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      appsQuery.refetch(),
      alertsQuery.refetch(),
      pipelinesQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [appsQuery, alertsQuery, pipelinesQuery]);

  const apps = appsQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];
  const activeDeployments = pipelinesQuery.data ?? [];

  const firingAlerts = alerts.filter((a) => a.status === "firing");
  const criticalCount = firingAlerts.filter((a) => a.severity === "critical").length;
  const deployingCount = apps.filter((a) => a.isDeploying).length;

  const overallStatus = criticalCount > 0 ? "critical" : firingAlerts.length > 0 ? "warning" : "healthy";

  const topApps = apps.slice(0, 6);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
      }
    >
      <HealthBanner
        status={overallStatus}
        appCount={apps.length}
        deployingCount={deployingCount + activeDeployments.length}
        alertCount={firingAlerts.length}
        onPress={firingAlerts.length > 0 ? () => navigation.navigate("Alerts") : undefined}
      />

      {appsQuery.isError && (
        <View style={[styles.errorBanner, { backgroundColor: isDark ? "#7f1d1d" : "#fee2e2" }]}>
          <Ionicons name="warning" size={18} color="#ef4444" />
          <Text style={[styles.errorText, { color: isDark ? "#fecaca" : "#991b1b" }]}>
            Failed to load data
          </Text>
          <TouchableOpacity onPress={() => onRefresh()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeDeployments.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Active Deployments
            </Text>
            <Ionicons name="rocket" size={18} color={colors.primary} />
          </View>
          <FlatList
            horizontal
            data={activeDeployments}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.deploymentList}
            renderItem={({ item }) => (
              <DeploymentCard
                appName={item.appName}
                commitMessage={item.commitMessage}
                commitSha={item.commitSha}
                branch={item.branch}
                environment={item.environment}
                steps={item.steps}
                onPress={() => navigation.navigate("ApplicationDetail", { id: item.appId })}
              />
            )}
          />
        </View>
      )}

      {firingAlerts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Alerts
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Alerts")}
              style={styles.viewAllButton}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.alertsList}>
            {firingAlerts.slice(0, 3).map((alert) => (
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
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Applications
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Apps")}
            style={styles.viewAllButton}
          >
            <Text style={[styles.viewAllText, { color: colors.primary }]}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.appsGrid}>
          {topApps.map((app, index) => (
            <View key={app.id} style={styles.gridItem}>
              <AppGridTile
                name={app.name}
                status={app.status}
                isDeploying={app.isDeploying}
                gitProvider={app.gitProvider ?? undefined}
                deployProvider={app.deployProvider ?? undefined}
                onPress={() => navigation.navigate("ApplicationDetail", { id: app.id })}
              />
            </View>
          ))}
        </View>
      </View>

      {!appsQuery.isLoading && apps.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Applications</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Add applications in the web dashboard
          </Text>
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  deploymentList: {
    paddingHorizontal: 16,
  },
  alertsList: {
    paddingHorizontal: 16,
  },
  appsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
  },
  gridItem: {
    width: "50%",
  },
  emptyState: {
    alignItems: "center",
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
});
