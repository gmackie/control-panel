import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsOnline, useLastOnlineAt, useActionQueue } from "../stores/offline";

export function OfflineBanner() {
  const isOnline = useIsOnline();
  const lastOnlineAt = useLastOnlineAt();
  const actionQueue = useActionQueue();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOnline ? -100 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  }, [isOnline, slideAnim]);

  const formatLastOnline = () => {
    if (!lastOnlineAt) return "Unknown";
    const date = new Date(lastOnlineAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  if (isOnline) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={18} color="#fecaca" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{"You're offline"}</Text>
          <Text style={styles.subtitle}>Last online {formatLastOnline()}</Text>
        </View>
        {actionQueue.length > 0 && (
          <View style={styles.queueBadge}>
            <Text style={styles.queueText}>{actionQueue.length} pending</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

interface StalenessIndicatorProps {
  timestamp: string | null | undefined;
  isLoading?: boolean;
}

export function StalenessIndicator({ timestamp, isLoading }: StalenessIndicatorProps) {
  const isOnline = useIsOnline();

  const formatAge = () => {
    if (isLoading) return "Loading...";
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Updated just now";
    if (diffMins < 60) return `Updated ${diffMins}m ago`;
    return `Updated ${Math.floor(diffMins / 60)}h ago`;
  };

  const isStale = () => {
    if (!timestamp) return false;
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const FIVE_MINUTES = 5 * 60 * 1000;
    return diffMs > FIVE_MINUTES;
  };

  return (
    <View style={styles.stalenessContainer}>
      {!isOnline && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="cloud-offline" size={12} color="#f59e0b" />
        </View>
      )}
      <Text
        style={[
          styles.stalenessText,
          isStale() && styles.staleText,
          !isOnline && styles.offlineText,
        ]}
      >
        {formatAge()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#7f1d1d",
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: "#fecaca",
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    color: "#fca5a5",
    fontSize: 12,
    marginTop: 1,
  },
  queueBadge: {
    backgroundColor: "#991b1b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  queueText: {
    color: "#fecaca",
    fontSize: 11,
    fontWeight: "500",
  },
  stalenessContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  offlineIndicator: {
    marginRight: 2,
  },
  stalenessText: {
    color: "#64748b",
    fontSize: 11,
  },
  staleText: {
    color: "#f59e0b",
  },
  offlineText: {
    color: "#f59e0b",
  },
});
