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
import * as Haptics from "expo-haptics";
import { trpc } from "../lib/trpc";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "AlertDetail">;

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  valueColor?: string;
}

function InfoRow({ icon, label, value, valueColor }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#64748b" style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

interface LabelChipProps {
  label: string;
  value: string;
}

function LabelChip({ label, value }: LabelChipProps) {
  return (
    <View style={styles.labelChip}>
      <Text style={styles.labelKey}>{label}:</Text>
      <Text style={styles.labelValue}>{value}</Text>
    </View>
  );
}

interface TimelineItemProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  title: string;
  time: string;
  description?: string;
}

function TimelineItem({ icon, iconColor, title, time, description }: TimelineItemProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineIcon, { backgroundColor: iconColor + "20" }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineTime}>{formatTime(time)}</Text>
        {description && <Text style={styles.timelineDescription}>{description}</Text>}
      </View>
    </View>
  );
}

export function AlertDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [refreshing, setRefreshing] = React.useState(false);

  const alertQuery = trpc.monitoring.alertById.useQuery(id);
  const acknowledgeMutation = trpc.monitoring.acknowledgeAlert.useMutation();

  React.useEffect(() => {
    if (alertQuery.data) {
      navigation.setOptions({ headerTitle: alertQuery.data.name });
    }
  }, [alertQuery.data, navigation]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await alertQuery.refetch();
    setRefreshing(false);
  }, [alertQuery]);

  const handleAcknowledge = () => {
    Alert.alert(
      "Acknowledge Alert",
      `Are you sure you want to acknowledge "${alertQuery.data?.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Acknowledge",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await acknowledgeMutation.mutateAsync({ alertId: id });
              Alert.alert("Success", "Alert acknowledged");
              alertQuery.refetch();
            } catch (err) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to acknowledge alert");
            }
          },
        },
      ]
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      default:
        return "#3b82f6";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "firing":
        return "#ef4444";
      case "acknowledged":
        return "#f59e0b";
      case "resolved":
        return "#22c55e";
      default:
        return "#64748b";
    }
  };

  const getStatusIcon = (status: string): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (status) {
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

  const alert = alertQuery.data;

  if (alertQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (alertQuery.error || !alert) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load alert</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => alertQuery.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const severityColor = getSeverityColor(alert.severity);
  const statusColor = getStatusColor(alert.status);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
      }
    >
      <View style={[styles.header, { borderLeftColor: severityColor }]}>
        <View style={styles.headerTop}>
          <View style={[styles.severityBadge, { backgroundColor: severityColor + "20" }]}>
            <Ionicons name="alert-circle" size={16} color={severityColor} />
            <Text style={[styles.severityText, { color: severityColor }]}>
              {alert.severity.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Ionicons name={getStatusIcon(alert.status)} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{alert.status}</Text>
          </View>
        </View>
        <Text style={styles.alertName}>{alert.name}</Text>
        <Text style={styles.alertMessage}>{alert.message}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.sectionContent}>
          <InfoRow icon="server" label="Source" value={alert.source} />
          <InfoRow
            icon="alert-circle"
            label="Severity"
            value={alert.severity}
            valueColor={severityColor}
          />
          <InfoRow
            icon="pulse"
            label="Status"
            value={alert.status}
            valueColor={statusColor}
          />
        </View>
      </View>

      {Object.keys(alert.labels).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Labels</Text>
          <View style={styles.labelsContainer}>
            {Object.entries(alert.labels).map(([key, value]) => (
              <LabelChip key={key} label={key} value={value} />
            ))}
          </View>
        </View>
      )}

      {Object.keys(alert.annotations).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Annotations</Text>
          <View style={styles.sectionContent}>
            {Object.entries(alert.annotations).map(([key, value]) => (
              <View key={key} style={styles.annotationItem}>
                <Text style={styles.annotationKey}>{key}</Text>
                <Text style={styles.annotationValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.timelineContainer}>
          <TimelineItem
            icon="flame"
            iconColor="#ef4444"
            title="Alert Started"
            time={alert.startsAt}
          />
          {alert.acknowledgedAt && alert.acknowledgedBy && (
            <TimelineItem
              icon="eye"
              iconColor="#f59e0b"
              title="Acknowledged"
              time={alert.acknowledgedAt}
              description={`By ${alert.acknowledgedBy}`}
            />
          )}
          {alert.endsAt && (
            <TimelineItem
              icon="checkmark-circle"
              iconColor="#22c55e"
              title="Resolved"
              time={alert.endsAt}
            />
          )}
        </View>
      </View>

      {alert.status === "firing" && (
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.acknowledgeButton} onPress={handleAcknowledge}>
            <Ionicons name="eye" size={20} color="#fff" />
            <Text style={styles.acknowledgeButtonText}>Acknowledge Alert</Text>
          </TouchableOpacity>
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
    margin: 16,
    padding: 16,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  severityText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  alertName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  alertMessage: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionContent: {
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
    textTransform: "capitalize",
  },
  labelsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  labelChip: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  labelKey: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "500",
  },
  labelValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  annotationItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  annotationKey: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  annotationValue: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
  },
  timelineContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 16,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  timelineTime: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  timelineDescription: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  actionSection: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  acknowledgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f59e0b",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  acknowledgeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
