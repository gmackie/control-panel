import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCurrentScope } from "../stores/scope";
import { useBiometricAuth } from "../hooks/useBiometricAuth";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  onPress: () => void;
  requiresScope?: boolean;
  requiresBiometric?: boolean;
}

interface QuickActionsFABProps {
  onDeploy?: () => void;
  onRollback?: () => void;
  onRestart?: () => void;
  onViewLogs?: () => void;
  onRunbook?: () => void;
}

export function QuickActionsFAB({
  onDeploy,
  onRollback,
  onRestart,
  onViewLogs,
  onRunbook,
}: QuickActionsFABProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const animation = React.useRef(new Animated.Value(0)).current;
  const { isGlobal, site } = useCurrentScope();
  const { confirmDangerousAction } = useBiometricAuth();

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    Animated.spring(animation, {
      toValue: 0,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setIsOpen(false);
  };

  const handleAction = async (action: QuickAction) => {
    if (action.requiresScope && isGlobal) {
      Alert.alert(
        "Select a Site",
        "Please select a specific site from the scope switcher to perform this action.",
        [{ text: "OK" }]
      );
      return;
    }

    closeMenu();

    if (action.requiresBiometric) {
      await confirmDangerousAction(
        action.label,
        () => action.onPress(),
        () => {}
      );
    } else {
      action.onPress();
    }
  };

  const actions: QuickAction[] = [
    {
      id: "deploy",
      label: "Deploy",
      icon: "rocket",
      color: "#3b82f6",
      onPress: onDeploy ?? (() => Alert.alert("Deploy", "Deploy action triggered")),
      requiresBiometric: true,
    },
    {
      id: "rollback",
      label: "Rollback",
      icon: "arrow-undo",
      color: "#f59e0b",
      onPress: onRollback ?? (() => Alert.alert("Rollback", "Rollback action triggered")),
      requiresScope: true,
      requiresBiometric: true,
    },
    {
      id: "restart",
      label: "Restart",
      icon: "refresh",
      color: "#22c55e",
      onPress: onRestart ?? (() => Alert.alert("Restart", "Restart action triggered")),
      requiresScope: true,
      requiresBiometric: true,
    },
    {
      id: "logs",
      label: "Logs",
      icon: "terminal",
      color: "#8b5cf6",
      onPress: onViewLogs ?? (() => Alert.alert("Logs", "View logs action triggered")),
    },
    {
      id: "runbook",
      label: "Runbook",
      icon: "book",
      color: "#ec4899",
      onPress: onRunbook ?? (() => Alert.alert("Runbook", "Runbook action triggered")),
    },
  ];

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <>
      {isOpen && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents={isOpen ? "auto" : "none"}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
        </Animated.View>
      )}

      <View style={styles.container} pointerEvents="box-none">
        {actions.map((action, index) => {
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(index + 1) * 60],
          });

          const scale = animation.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0, 1],
          });

          const opacity = animation.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0, 1],
          });

          return (
            <Animated.View
              key={action.id}
              style={[
                styles.actionContainer,
                {
                  transform: [{ translateY }, { scale }],
                  opacity,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.labelContainer}
                onPress={() => handleAction(action)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: action.color }]}
                onPress={() => handleAction(action)}
                activeOpacity={0.8}
              >
                <Ionicons name={action.icon} size={22} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <TouchableOpacity
          style={styles.fab}
          onPress={toggleMenu}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="add" size={28} color="#fff" />
          </Animated.View>
        </TouchableOpacity>

        {!isGlobal && site && (
          <View style={styles.scopeIndicator}>
            <Text style={styles.scopeText} numberOfLines={1}>
              {site.name}
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 998,
  },
  container: {
    position: "absolute",
    bottom: 100,
    right: 20,
    alignItems: "flex-end",
    zIndex: 999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  labelContainer: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  scopeIndicator: {
    position: "absolute",
    bottom: -24,
    right: 0,
    backgroundColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: 100,
  },
  scopeText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "500",
  },
});
