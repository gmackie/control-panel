import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { trpc } from "../lib/trpc";
import type { RootStackParamList } from "../../App";

type OverviewNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type HealthStatus = "critical" | "warning" | "healthy";

interface SiteCardProps {
  id: string;
  name: string;
  status: HealthStatus;
  alertCounts: { critical: number; warning: number };
  latestAlert: {
    message: string;
    severity: string;
    timestamp: Date;
  } | null;
  onPress: () => void;
}

function SiteCard({ name, status, alertCounts, latestAlert, onPress }: SiteCardProps) {
  const statusColors: Record<HealthStatus, string> = {
    critical: "#ef4444",
    warning: "#f59e0b",
    healthy: "#22c55e",
  };

  const totalAlerts = alertCounts.critical + alertCounts.warning;

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <TouchableOpacity style={styles.siteCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.siteCardHeader}>
        <View style={styles.siteCardLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]} />
          <Text style={styles.siteName}>{name}</Text>
        </View>
        <View style={styles.siteCardRight}>
          {totalAlerts > 0 && (
            <View style={[styles.alertBadge, { backgroundColor: statusColors[status] + "20" }]}>
              <Text style={[styles.alertBadgeText, { color: statusColors[status] }]}>
                {totalAlerts}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </View>
      </View>
      <Text style={styles.siteMessage} numberOfLines={1}>
        {latestAlert ? latestAlert.message : "All clear"}
      </Text>
      {latestAlert && (
        <Text style={styles.siteTime}>{formatTimeAgo(latestAlert.timestamp)}</Text>
      )}
    </TouchableOpacity>
  );
}

export function OverviewScreen() {
  const navigation = useNavigation<OverviewNavigationProp>();
  const [refreshing, setRefreshing] = React.useState(false);

  const appsQuery = trpc.applications.listWithHealth.useQuery();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await appsQuery.refetch();
    setRefreshing(false);
  }, [appsQuery]);

  const apps = appsQuery.data ?? [];
  const needsAttention = apps.filter((a) => a.status !== "healthy").length;

  const getHeaderMessage = () => {
    if (appsQuery.isLoading) return "Loading...";
    if (apps.length === 0) return "No sites configured";
    if (needsAttention === 0) return `All ${apps.length} sites healthy`;
    return `${needsAttention} site${needsAttention > 1 ? "s" : ""} need attention`;
  };

  const getHeaderColor = () => {
    if (apps.some((a) => a.status === "critical")) return "#ef4444";
    if (apps.some((a) => a.status === "warning")) return "#f59e0b";
    return "#22c55e";
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
      }
    >
      {/* Status Banner */}
      <View style={[styles.statusBanner, { borderLeftColor: getHeaderColor() }]}>
        <View style={[styles.statusIndicator, { backgroundColor: getHeaderColor() }]} />
        <Text style={styles.statusText}>{getHeaderMessage()}</Text>
      </View>

      {/* Error State */}
      {appsQuery.isError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={20} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load sites</Text>
          <TouchableOpacity onPress={() => appsQuery.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Site Cards */}
      <View style={styles.siteList}>
        {apps.map((app) => (
          <SiteCard
            key={app.id}
            id={app.id}
            name={app.name}
            status={app.status}
            alertCounts={app.alertCounts}
            latestAlert={app.latestAlert}
            onPress={() => navigation.navigate("ApplicationDetail", { id: app.id })}
          />
        ))}
      </View>

      {/* Empty State */}
      {!appsQuery.isLoading && apps.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color="#64748b" />
          <Text style={styles.emptyTitle}>No Sites</Text>
          <Text style={styles.emptyText}>Add applications in the web dashboard</Text>
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
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7f1d1d",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
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
  siteList: {
    padding: 16,
    gap: 12,
  },
  siteCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
  },
  siteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  siteCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  siteName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  siteCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: "center",
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  siteMessage: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 8,
    marginLeft: 24,
  },
  siteTime: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 24,
  },
  emptyState: {
    alignItems: "center",
    padding: 48,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4,
  },
});
