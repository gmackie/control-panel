import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../hooks/useTheme";

type HealthStatus = "critical" | "warning" | "healthy";

interface AppGridTileProps {
  name: string;
  status: HealthStatus;
  isDeploying?: boolean;
  gitProvider?: string;
  deployProvider?: string;
  onPress?: () => void;
}

export function AppGridTile({
  name,
  status,
  isDeploying,
  gitProvider,
  deployProvider,
  onPress,
}: AppGridTileProps) {
  const { colors, isDark } = useTheme();

  const statusColors: Record<HealthStatus, string> = {
    critical: "#ef4444",
    warning: "#f59e0b",
    healthy: "#22c55e",
  };

  const getProviderIcon = (provider: string): React.ComponentProps<typeof Ionicons>["name"] => {
    const icons: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
      github: "logo-github",
      gitea: "git-branch",
      gitlab: "logo-gitlab",
      vercel: "triangle",
      kubernetes: "cube",
      railway: "train",
      flyio: "paper-plane",
    };
    return icons[provider] || "code-slash";
  };

  const getInitials = (name: string) => {
    return name
      .split(/[\s-_]+/)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconRow}>
        <View style={[styles.avatar, { backgroundColor: isDark ? "#334155" : "#e2e8f0" }]}>
          <Text style={[styles.initials, { color: colors.text }]}>{getInitials(name)}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]}>
          {isDeploying && (
            <View style={styles.deployingPulse} />
          )}
        </View>
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.badges}>
        {gitProvider && (
          <Ionicons
            name={getProviderIcon(gitProvider)}
            size={12}
            color={colors.textMuted}
            style={styles.badge}
          />
        )}
        {deployProvider && (
          <Ionicons
            name={getProviderIcon(deployProvider)}
            size={12}
            color={colors.textMuted}
            style={styles.badge}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 14,
    flex: 1,
    marginHorizontal: 6,
    marginBottom: 12,
    minWidth: 140,
  },
  iconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    fontSize: 14,
    fontWeight: "700",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  deployingPulse: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3b82f6",
    opacity: 0.5,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    opacity: 0.7,
  },
});
