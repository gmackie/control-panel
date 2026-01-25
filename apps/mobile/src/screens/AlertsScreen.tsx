import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { trpc } from "../lib/trpc";
import { useTheme } from "../hooks/useTheme";
import { useDemoMode } from "../stores/settings";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface SwipeableAlertItemProps {
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

function SwipeableAlertItem({
  id,
  name,
  message,
  severity,
  status,
  source,
  startsAt,
  onPress,
  onAcknowledge,
}: SwipeableAlertItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const itemHeight = useRef(new Animated.Value(1)).current;
  const hasTriggeredThresholdHaptic = useRef(false);

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

  const getStatusIcon = (stat: string): keyof typeof Ionicons.glyphMap => {
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

  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  };

  const handleSwipeComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(itemHeight, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start(() => {
        onAcknowledge();
      });
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => status === "firing",
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return status === "firing" && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        hasTriggeredThresholdHaptic.current = false;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
          if (gestureState.dx < -SWIPE_THRESHOLD && !hasTriggeredThresholdHaptic.current) {
            hasTriggeredThresholdHaptic.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          handleSwipeComplete();
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: () => {
        resetPosition();
      },
    })
  ).current;

  const color = getSeverityColor(severity);

  const animatedStyle = {
    transform: [{ translateX }],
  };

  const containerStyle = {
    opacity: itemHeight,
    transform: [
      {
        scaleY: itemHeight,
      },
    ],
  };

  return (
    <Animated.View style={[styles.swipeContainer, containerStyle]}>
      <View style={styles.swipeActionContainer}>
        <View style={styles.swipeAction}>
          <Ionicons name="eye" size={24} color="#fff" />
          <Text style={styles.swipeActionText}>Acknowledge</Text>
        </View>
      </View>

      <Animated.View
        style={[styles.alertItemWrapper, animatedStyle]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[styles.alertItem, { borderLeftColor: color }]}
          onPress={onPress}
          activeOpacity={0.9}
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
              <View style={styles.swipeHint}>
                <Ionicons name="arrow-back" size={12} color="#64748b" />
                <Text style={styles.swipeHintText}>Swipe to ack</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

interface AlertSection {
  title: string;
  siteId?: string;
  criticalCount: number;
  warningCount: number;
  data: Array<{
    id: string;
    name: string;
    message: string;
    severity: "critical" | "warning" | "info";
    status: "firing" | "resolved" | "acknowledged";
    source: string;
    startsAt: string;
  }>;
}

export function AlertsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<
    "all" | "firing" | "acknowledged" | "critical"
  >("all");
  const [groupBySeverity, setGroupBySeverity] = React.useState(true);
  const demoMode = useDemoMode();

  const alertsQuery = trpc.monitoring.alerts.useQuery({
    status: filter === "firing" || filter === "acknowledged" ? filter : undefined,
    severity: filter === "critical" ? "critical" : undefined,
    limit: 50,
    demoMode,
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

  const groupedAlerts = React.useMemo((): AlertSection[] => {
    if (!groupBySeverity) {
      return [
        {
          title: "All Alerts",
          criticalCount: alerts.filter((a) => a.severity === "critical").length,
          warningCount: alerts.filter((a) => a.severity === "warning").length,
          data: alerts,
        },
      ];
    }

    const criticalAlerts = alerts.filter((a) => a.severity === "critical");
    const warningAlerts = alerts.filter((a) => a.severity === "warning");
    const infoAlerts = alerts.filter((a) => a.severity === "info");

    const sections: AlertSection[] = [];
    if (criticalAlerts.length > 0) {
      sections.push({
        title: "Critical",
        criticalCount: criticalAlerts.length,
        warningCount: 0,
        data: criticalAlerts,
      });
    }
    if (warningAlerts.length > 0) {
      sections.push({
        title: "Warning",
        criticalCount: 0,
        warningCount: warningAlerts.length,
        data: warningAlerts,
      });
    }
    if (infoAlerts.length > 0) {
      sections.push({
        title: "Info",
        criticalCount: 0,
        warningCount: 0,
        data: infoAlerts,
      });
    }

    return sections;
  }, [alerts, groupBySeverity]);

  const renderSectionHeader = ({ section }: { section: AlertSection }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionBadges}>
          {section.criticalCount > 0 && (
            <View style={styles.criticalBadge}>
              <Text style={styles.badgeText}>{section.criticalCount}C</Text>
            </View>
          )}
          {section.warningCount > 0 && (
            <View style={styles.warningBadge}>
              <Text style={styles.warningBadgeText}>{section.warningCount}W</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
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

      <View style={styles.filterRow}>
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
        <TouchableOpacity
          style={[
            styles.groupToggle,
            { backgroundColor: colors.card },
            groupBySeverity && styles.groupToggleActive,
          ]}
          onPress={() => setGroupBySeverity(!groupBySeverity)}
        >
          <Ionicons
            name="layers"
            size={16}
            color={groupBySeverity ? "#fff" : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={groupedAlerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableAlertItem
            id={item.id}
            name={item.name}
            message={item.message}
            severity={item.severity}
            status={item.status}
            source={item.source}
            startsAt={item.startsAt}
            onPress={() => navigation.navigate("AlertDetail", { id: item.id })}
            onAcknowledge={() => handleAcknowledge(item.id)}
          />
        )}
        renderSectionHeader={groupBySeverity ? renderSectionHeader : () => null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>All Clear</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
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
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  filterContainer: {
    flexDirection: "row",
    flex: 1,
  },
  groupToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  groupToggleActive: {
    backgroundColor: "#3b82f6",
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionBadges: {
    flexDirection: "row",
    gap: 4,
  },
  criticalBadge: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warningBadge: {
    backgroundColor: "#78350f",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: "#fecaca",
    fontSize: 10,
    fontWeight: "600",
  },
  warningBadgeText: {
    color: "#fde68a",
    fontSize: 10,
    fontWeight: "600",
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
  swipeContainer: {
    marginTop: 12,
    overflow: "hidden",
  },
  swipeActionContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 24,
  },
  swipeAction: {
    flexDirection: "row",
    alignItems: "center",
  },
  swipeActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  alertItemWrapper: {
    backgroundColor: "#0f172a",
  },
  alertItem: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
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
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
  },
  swipeHintText: {
    color: "#64748b",
    fontSize: 11,
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
