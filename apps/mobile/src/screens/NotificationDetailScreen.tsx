import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "../lib/trpc";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "NotificationDetail">;

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  valueColor?: string;
  onPress?: () => void;
}

function InfoRow({ icon, label, value, valueColor, onPress }: InfoRowProps) {
  const content = (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#64748b" style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          valueColor && { color: valueColor },
          onPress && styles.infoValueLink,
        ]}
        numberOfLines={2}
      >
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

export function NotificationDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [refreshing, setRefreshing] = React.useState(false);

  const notificationQuery = trpc.notifications.byId.useQuery(id);
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();

  React.useEffect(() => {
    if (notificationQuery.data) {
      navigation.setOptions({ headerTitle: notificationQuery.data.title });
      if (notificationQuery.data.status === "new") {
        markAsReadMutation.mutate(id);
      }
    }
  }, [notificationQuery.data, navigation, id, markAsReadMutation]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await notificationQuery.refetch();
    setRefreshing(false);
  }, [notificationQuery]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "info":
        return "#3b82f6";
      default:
        return "#22c55e";
    }
  };

  const getCategoryIcon = (category: string): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (category) {
      case "deployment":
        return "rocket";
      case "alert":
        return "alert-circle";
      case "security":
        return "shield";
      case "system":
        return "server";
      case "integration":
        return "git-network";
      default:
        return "notifications";
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const notification = notificationQuery.data;

  if (notificationQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (notificationQuery.error || !notification) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load notification</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => notificationQuery.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const severityColor = getSeverityColor(notification.severity);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={[styles.iconContainer, { backgroundColor: severityColor + "20" }]}>
            <Ionicons
              name={getCategoryIcon(notification.category)}
              size={28}
              color={severityColor}
            />
          </View>
          <View style={[styles.severityBadge, { backgroundColor: severityColor + "20" }]}>
            <Text style={[styles.severityText, { color: severityColor }]}>
              {notification.severity.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message}>{notification.message}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.sectionContent}>
          <InfoRow
            icon="folder"
            label="Category"
            value={notification.category}
          />
          <InfoRow
            icon="alert-circle"
            label="Severity"
            value={notification.severity}
            valueColor={severityColor}
          />
          <InfoRow
            icon="eye"
            label="Status"
            value={notification.status === "new" ? "Unread" : "Read"}
            valueColor={notification.status === "new" ? "#3b82f6" : "#22c55e"}
          />
          <InfoRow
            icon="server"
            label="Source"
            value={notification.source}
          />
          {notification.appName && (
            <InfoRow
              icon="cube"
              label="Application"
              value={notification.appName}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timestamps</Text>
        <View style={styles.sectionContent}>
          <InfoRow
            icon="time"
            label="Created"
            value={formatDate(notification.createdAt)}
          />
          <InfoRow
            icon="refresh"
            label="Updated"
            value={formatDate(notification.updatedAt)}
          />
        </View>
      </View>

      {notification.links && (() => {
        try {
          const links = JSON.parse(notification.links) as { label?: string; url: string }[];
          if (links.length > 0) {
            return (
              <View style={styles.actionSection}>
                {links.map((link, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.actionButton}
                    onPress={() => Linking.openURL(link.url)}
                  >
                    <Ionicons name="open-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>{link.label || "View Details"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          }
        } catch {
          return null;
        }
        return null;
      })()}

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
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  message: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 22,
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
    width: 90,
  },
  infoValue: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
    textTransform: "capitalize",
  },
  infoValueLink: {
    color: "#3b82f6",
  },
  actionSection: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
