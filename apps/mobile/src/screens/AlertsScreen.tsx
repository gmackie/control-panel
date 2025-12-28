import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "../lib/trpc";

interface AlertItemProps {
  id: string;
  name: string;
  message: string;
  severity: "critical" | "warning" | "info";
  status: "firing" | "resolved" | "acknowledged";
  source: string;
  startsAt: string;
  onPress: () => void;
  onAcknowledge: () => void;
}

function AlertItem({
  name,
  message,
  severity,
  status,
  source,
  startsAt,
  onPress,
  onAcknowledge,
}: AlertItemProps) {
  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      default:
        return "#3b82f6";
    }
  };

  const getStatusIcon = (
    stat: string
  ): keyof typeof Ionicons.glyphMap => {
    switch (stat) {
      case "firing":
        return "flame";
      case "acknowledged":
        return "eye";
      case "resolved":
        return "checkmark-circle";
      default:
        return "alert-circle";
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

  const color = getSeverityColor(severity);

  return (
    <TouchableOpacity
      style={[styles.alertItem, { borderLeftColor: color }]}
      onPress={onPress}
    >
      <View style={styles.alertHeader}>
        <View style={[styles.severityBadge, { backgroundColor: color + "20" }]}>
          <Ionicons name="alert-circle" size={16} color={color} />
          <Text style={[styles.severityText, { color }]}>
            {severity.toUpperCase()}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Ionicons
            name={getStatusIcon(status)}
            size={14}
            color={status === "firing" ? "#ef4444" : "#22c55e"}
          />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <Text style={styles.alertName}>{name}</Text>
      <Text style={styles.alertMessage} numberOfLines={2}>
        {message}
      </Text>

      <View style={styles.alertFooter}>
        <View style={styles.sourceContainer}>
          <Ionicons name="server" size={12} color="#64748b" />
          <Text style={styles.sourceText}>{source}</Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.timeText}>{formatTimeAgo(startsAt)}</Text>
        </View>

        {status === "firing" && (
          <TouchableOpacity
            style={styles.ackButton}
            onPress={(e) => {
              e.stopPropagation();
              onAcknowledge();
            }}
          >
            <Ionicons name="eye" size={16} color="#3b82f6" />
            <Text style={styles.ackButtonText}>Acknowledge</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function AlertsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<
    "all" | "firing" | "acknowledged" | "critical"
  >("all");

  const alertsQuery = trpc.monitoring.alerts.useQuery({
    status: filter === "firing" || filter === "acknowledged" ? filter : undefined,
    severity: filter === "critical" ? "critical" : undefined,
    limit: 50,
  });
  const statsQuery = trpc.monitoring.alertStats.useQuery();
  const acknowledgeMutation = trpc.monitoring.acknowledgeAlert.useMutation();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([alertsQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  }, [alertsQuery, statsQuery]);

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeMutation.mutateAsync({ alertId });
    await alertsQuery.refetch();
    await statsQuery.refetch();
  };

  const alerts = alertsQuery.data ?? [];
  const stats = statsQuery.data;

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="flame" size={24} color="#ef4444" />
          <Text style={[styles.statValue, { color: "#ef4444" }]}>
            {stats?.firing ?? 0}
          </Text>
          <Text style={styles.statLabel}>Firing</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <Text style={[styles.statValue, { color: "#f59e0b" }]}>
            {stats?.bySeverity.critical ?? 0}
          </Text>
          <Text style={styles.statLabel}>Critical</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="eye" size={24} color="#3b82f6" />
          <Text style={[styles.statValue, { color: "#3b82f6" }]}>
            {stats?.acknowledged ?? 0}
          </Text>
          <Text style={styles.statLabel}>Ack&apos;d</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {(["all", "firing", "critical", "acknowledged"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.activeFilterChip]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f && styles.activeFilterChipText,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Alerts List */}
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlertItem
            id={item.id}
            name={item.name}
            message={item.message}
            severity={item.severity}
            status={item.status}
            source={item.source}
            startsAt={item.startsAt}
            onPress={() => console.log("Open alert:", item.id)}
            onAcknowledge={() => handleAcknowledge(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptyText}>
              No alerts matching your filter
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#1e293b",
    borderRadius: 12,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 4,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: "#334155",
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  activeFilterChip: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  filterChipText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "500",
  },
  activeFilterChipText: {
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  alertItem: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    color: "#94a3b8",
    fontSize: 12,
    marginLeft: 4,
    textTransform: "capitalize",
  },
  alertName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  alertMessage: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  alertFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  sourceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  sourceText: {
    color: "#64748b",
    fontSize: 12,
    marginLeft: 4,
  },
  separator: {
    color: "#64748b",
    marginHorizontal: 6,
  },
  timeText: {
    color: "#64748b",
    fontSize: 12,
  },
  ackButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ackButtonText: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
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
    marginTop: 8,
  },
});
