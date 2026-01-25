import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../hooks/useTheme";

interface HealthBannerProps {
  status: "healthy" | "warning" | "critical";
  appCount: number;
  deployingCount: number;
  alertCount: number;
  onPress?: () => void;
}

export function HealthBanner({
  status,
  appCount,
  deployingCount,
  alertCount,
  onPress,
}: HealthBannerProps) {
  const { colors, isDark } = useTheme();

  const statusConfig = {
    healthy: {
      color: "#22c55e",
      bgColor: isDark ? "#14532d" : "#dcfce7",
      icon: "checkmark-circle" as const,
      message: "All Systems Operational",
    },
    warning: {
      color: "#f59e0b",
      bgColor: isDark ? "#78350f" : "#fef3c7",
      icon: "warning" as const,
      message: `${alertCount} Issue${alertCount !== 1 ? "s" : ""} Need Attention`,
    },
    critical: {
      color: "#ef4444",
      bgColor: isDark ? "#7f1d1d" : "#fee2e2",
      icon: "alert-circle" as const,
      message: `${alertCount} Critical Issue${alertCount !== 1 ? "s" : ""}`,
    },
  };

  const config = statusConfig[status];

  const BannerContent = (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      <View style={styles.mainRow}>
        <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
          <Ionicons name={config.icon} size={24} color="#fff" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.message, { color: config.color }]}>
            {config.message}
          </Text>
          <Text style={[styles.stats, { color: colors.textMuted }]}>
            {appCount} Apps{deployingCount > 0 && ` | ${deployingCount} Deploying`}
            {alertCount > 0 && status !== "healthy" && ` | ${alertCount} Alert${alertCount !== 1 ? "s" : ""}`}
          </Text>
        </View>
        {onPress && status !== "healthy" && (
          <Ionicons name="chevron-forward" size={20} color={config.color} />
        )}
      </View>
    </View>
  );

  if (onPress && status !== "healthy") {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {BannerContent}
      </TouchableOpacity>
    );
  }

  return BannerContent;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 16,
    fontWeight: "700",
  },
  stats: {
    fontSize: 13,
    marginTop: 2,
  },
});
