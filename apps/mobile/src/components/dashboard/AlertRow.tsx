import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../hooks/useTheme";

type AlertSeverity = "critical" | "warning" | "info";

interface AlertRowProps {
  name: string;
  message: string;
  severity: AlertSeverity;
  source: string;
  timestamp: Date;
  onPress?: () => void;
}

export function AlertRow({
  name,
  message,
  severity,
  source,
  timestamp,
  onPress,
}: AlertRowProps) {
  const { colors } = useTheme();

  const severityConfig = {
    critical: {
      color: "#ef4444",
      bgColor: "#7f1d1d",
      icon: "alert-circle" as const,
    },
    warning: {
      color: "#f59e0b",
      bgColor: "#78350f",
      icon: "warning" as const,
    },
    info: {
      color: "#3b82f6",
      bgColor: "#1e3a5f",
      icon: "information-circle" as const,
    },
  };

  const config = severityConfig[severity];

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
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={18} color={config.color} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {formatTimeAgo(timestamp)}
          </Text>
        </View>
        <Text style={[styles.message, { color: colors.textMuted }]} numberOfLines={1}>
          {message}
        </Text>
        <Text style={[styles.source, { color: colors.textMuted }]}>
          {source}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 11,
  },
  message: {
    fontSize: 12,
    marginTop: 2,
  },
  source: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
  },
});
