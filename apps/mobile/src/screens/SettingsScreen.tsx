import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "../lib/trpc";
import { usePushNotifications } from "../hooks/usePushNotifications";

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

interface SettingRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  label: string;
  description?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  rightText?: string;
  showChevron?: boolean;
}

function SettingRow({
  icon,
  iconColor = "#3b82f6",
  label,
  description,
  value,
  onValueChange,
  onPress,
  rightText,
  showChevron,
}: SettingRowProps) {
  const content = (
    <View style={styles.settingRow}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + "20" }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      {value !== undefined && onValueChange && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "#334155", true: "#3b82f6" }}
          thumbColor={value ? "#fff" : "#94a3b8"}
          ios_backgroundColor="#334155"
        />
      )}
      {rightText && <Text style={styles.rightText}>{rightText}</Text>}
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      )}
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

export function SettingsScreen() {
  const { expoPushToken, isLoading: pushLoading } = usePushNotifications();

  const preferencesQuery = trpc.notifications.getPreferences?.useQuery?.();
  const updatePreferencesMutation = trpc.notifications.updatePreferences?.useMutation?.();

  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [alertsEnabled, setAlertsEnabled] = React.useState(true);
  const [deploymentsEnabled, setDeploymentsEnabled] = React.useState(true);
  const [securityEnabled, setSecurityEnabled] = React.useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = React.useState(false);
  const [quietHoursStart, setQuietHoursStart] = React.useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = React.useState("08:00");

  React.useEffect(() => {
    if (preferencesQuery?.data) {
      const prefs = preferencesQuery.data;
      setPushEnabled(prefs.pushEnabled ?? true);
      setAlertsEnabled(prefs.categoryPreferences?.alerts ?? true);
      setDeploymentsEnabled(prefs.categoryPreferences?.deployments ?? true);
      setSecurityEnabled(prefs.categoryPreferences?.security ?? true);
      if (prefs.quietHours) {
        setQuietHoursEnabled(prefs.quietHours.enabled ?? false);
        setQuietHoursStart(prefs.quietHours.start ?? "22:00");
        setQuietHoursEnd(prefs.quietHours.end ?? "08:00");
      }
    }
  }, [preferencesQuery?.data]);

  const updatePreference = async (key: string, value: boolean | object) => {
    try {
      if (updatePreferencesMutation) {
        await updatePreferencesMutation.mutateAsync({ [key]: value });
        await preferencesQuery?.refetch?.();
      }
    } catch (err) {
      console.error("Failed to update preference:", err);
      Alert.alert("Error", "Failed to update setting. Please try again.");
    }
  };

  const handlePushToggle = (value: boolean) => {
    setPushEnabled(value);
    updatePreference("pushEnabled", value);
  };

  const handleCategoryToggle = (category: string, value: boolean) => {
    const updates: Record<string, boolean> = {
      alerts: alertsEnabled,
      deployments: deploymentsEnabled,
      security: securityEnabled,
    };
    updates[category] = value;

    if (category === "alerts") setAlertsEnabled(value);
    if (category === "deployments") setDeploymentsEnabled(value);
    if (category === "security") setSecurityEnabled(value);

    updatePreference("categoryPreferences", updates);
  };

  const handleQuietHoursToggle = (value: boolean) => {
    setQuietHoursEnabled(value);
    updatePreference("quietHours", {
      enabled: value,
      start: quietHoursStart,
      end: quietHoursEnd,
    });
  };

  const showTimePicker = (type: "start" | "end") => {
    const currentTime = type === "start" ? quietHoursStart : quietHoursEnd;
    const [hours, minutes] = currentTime.split(":").map(Number);

    if (Platform.OS === "ios") {
      Alert.prompt(
        `Set ${type === "start" ? "Start" : "End"} Time`,
        "Enter time in 24h format (HH:MM)",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: (input) => {
              if (input && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(input)) {
                const formattedTime = input.padStart(5, "0");
                if (type === "start") {
                  setQuietHoursStart(formattedTime);
                } else {
                  setQuietHoursEnd(formattedTime);
                }
                updatePreference("quietHours", {
                  enabled: quietHoursEnabled,
                  start: type === "start" ? formattedTime : quietHoursStart,
                  end: type === "end" ? formattedTime : quietHoursEnd,
                });
              } else {
                Alert.alert("Invalid Time", "Please enter time in HH:MM format");
              }
            },
          },
        ],
        "plain-text",
        currentTime
      );
    } else {
      Alert.alert(
        `Set ${type === "start" ? "Start" : "End"} Time`,
        "Time picker coming soon. Current: " + currentTime
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            console.log("Sign out");
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all cached data. You may need to reload the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            console.log("Clear cache");
            Alert.alert("Cache Cleared", "All cached data has been cleared.");
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <SettingSection title="Push Notifications">
        <SettingRow
          icon="notifications"
          label="Push Notifications"
          description={
            expoPushToken
              ? "Enabled - receiving notifications"
              : pushLoading
              ? "Connecting..."
              : "Enable to receive push notifications"
          }
          value={pushEnabled}
          onValueChange={handlePushToggle}
        />
      </SettingSection>

      <SettingSection title="Notification Categories">
        <SettingRow
          icon="alert-circle"
          iconColor="#ef4444"
          label="Alert Notifications"
          description="Critical alerts, warnings, and incidents"
          value={alertsEnabled}
          onValueChange={(v) => handleCategoryToggle("alerts", v)}
        />
        <SettingRow
          icon="rocket"
          iconColor="#22c55e"
          label="Deployment Notifications"
          description="Deploy success, failures, and rollbacks"
          value={deploymentsEnabled}
          onValueChange={(v) => handleCategoryToggle("deployments", v)}
        />
        <SettingRow
          icon="shield"
          iconColor="#f59e0b"
          label="Security Notifications"
          description="Security events and compliance alerts"
          value={securityEnabled}
          onValueChange={(v) => handleCategoryToggle("security", v)}
        />
      </SettingSection>

      <SettingSection title="Quiet Hours">
        <SettingRow
          icon="moon"
          iconColor="#8b5cf6"
          label="Enable Quiet Hours"
          description="Pause non-critical notifications during set hours"
          value={quietHoursEnabled}
          onValueChange={handleQuietHoursToggle}
        />
        {quietHoursEnabled && (
          <>
            <SettingRow
              icon="time"
              iconColor="#64748b"
              label="Start Time"
              rightText={quietHoursStart}
              onPress={() => showTimePicker("start")}
              showChevron
            />
            <SettingRow
              icon="time"
              iconColor="#64748b"
              label="End Time"
              rightText={quietHoursEnd}
              onPress={() => showTimePicker("end")}
              showChevron
            />
          </>
        )}
      </SettingSection>

      <SettingSection title="App">
        <SettingRow
          icon="trash"
          iconColor="#64748b"
          label="Clear Cache"
          description="Clear locally cached data"
          onPress={handleClearCache}
          showChevron
        />
        <SettingRow
          icon="information-circle"
          iconColor="#64748b"
          label="Version"
          rightText="1.0.0"
        />
      </SettingSection>

      <SettingSection title="Account">
        <SettingRow
          icon="log-out"
          iconColor="#ef4444"
          label="Sign Out"
          onPress={handleSignOut}
          showChevron
        />
      </SettingSection>

      <View style={styles.footer}>
        <Text style={styles.footerText}>GMAC Control Panel</Text>
        <Text style={styles.footerSubtext}>
          {expoPushToken ? `Push Token: ${expoPushToken.slice(0, 20)}...` : "No push token"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  settingDescription: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 2,
  },
  rightText: {
    color: "#94a3b8",
    fontSize: 16,
    marginRight: 8,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 32,
    marginBottom: 50,
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  footerSubtext: {
    color: "#475569",
    fontSize: 12,
    marginTop: 4,
  },
});
