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
  TextInput,
  Modal,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "../lib/trpc";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useBiometricAuth } from "../hooks/useBiometricAuth";
import { useSettingsStore } from "../stores/settings";
import { useOfflineStore } from "../stores/offline";
import { useAuthStore } from "../stores/auth";

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
  const { isAvailable: biometricAvailable, biometricType } = useBiometricAuth();
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useSettingsStore((s) => s.setBiometricEnabled);
  const hapticEnabled = useSettingsStore((s) => s.hapticFeedbackEnabled);
  const setHapticEnabled = useSettingsStore((s) => s.setHapticFeedbackEnabled);
  const clearOfflineCache = useOfflineStore((s) => s.clearCache);
  const offlineQueueLength = useOfflineStore((s) => s.actionQueue.length);
  
  const apiKey = useAuthStore((s) => s.apiKey);
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const clearApiKey = useAuthStore((s) => s.clearApiKey);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  
  const [apiKeyModalVisible, setApiKeyModalVisible] = React.useState(false);
  const [apiKeyInput, setApiKeyInput] = React.useState("");

  const preferencesQuery = trpc.notifications.getPreferences?.useQuery?.();
  const updatePreferencesMutation = trpc.notifications.updatePreferences?.useMutation?.();

  const biometricLabel =
    biometricType === "facial"
      ? Platform.OS === "ios"
        ? "Face ID"
        : "Face Recognition"
      : biometricType === "fingerprint"
        ? Platform.OS === "ios"
          ? "Touch ID"
          : "Fingerprint"
        : "Biometric";

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

  const handleSaveApiKey = () => {
    const trimmedKey = apiKeyInput.trim();
    if (!trimmedKey) {
      Alert.alert("Error", "Please enter a valid API key");
      return;
    }
    if (!trimmedKey.startsWith("cp_")) {
      Alert.alert("Error", "API key should start with 'cp_'");
      return;
    }
    setApiKey(trimmedKey);
    setApiKeyInput("");
    setApiKeyModalVisible(false);
    Alert.alert("Success", "API key saved successfully");
  };

  const handleRemoveApiKey = () => {
    Alert.alert(
      "Remove API Key",
      "Are you sure you want to remove your API key? You'll need to enter a new one to access the API.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            clearApiKey();
            Alert.alert("Success", "API key removed");
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? This will remove your API key.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            clearApiKey();
            console.log("Signed out");
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    const queueMessage =
      offlineQueueLength > 0
        ? `\n\nWarning: You have ${offlineQueueLength} pending offline action(s) that will be lost.`
        : "";

    Alert.alert(
      "Clear Cache",
      `This will clear all cached data and offline queue.${queueMessage}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            clearOfflineCache();
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

      <SettingSection title="Security">
        <SettingRow
          icon="finger-print"
          iconColor="#8b5cf6"
          label={`Require ${biometricLabel}`}
          description={
            biometricAvailable
              ? "Use biometric authentication for dangerous actions"
              : "Biometric authentication not available on this device"
          }
          value={biometricEnabled && biometricAvailable}
          onValueChange={biometricAvailable ? setBiometricEnabled : undefined}
        />
      </SettingSection>

      <SettingSection title="API Connection">
        <SettingRow
          icon="key"
          iconColor={isAuthenticated ? "#22c55e" : "#f59e0b"}
          label="API Key"
          description={
            isAuthenticated
              ? `Connected (${apiKey?.slice(0, 10)}...)`
              : "Enter your API key to connect"
          }
          onPress={() => setApiKeyModalVisible(true)}
          showChevron
        />
        {isAuthenticated && (
          <SettingRow
            icon="close-circle"
            iconColor="#ef4444"
            label="Remove API Key"
            description="Disconnect from the control panel API"
            onPress={handleRemoveApiKey}
            showChevron
          />
        )}
      </SettingSection>

      <SettingSection title="App">
        <SettingRow
          icon="radio-button-on"
          iconColor="#3b82f6"
          label="Haptic Feedback"
          description="Vibrate on button presses and actions"
          value={hapticEnabled}
          onValueChange={setHapticEnabled}
        />
        <SettingRow
          icon="trash"
          iconColor="#64748b"
          label="Clear Cache"
          description={
            offlineQueueLength > 0
              ? `Clear cached data (${offlineQueueLength} pending actions)`
              : "Clear locally cached data"
          }
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

      <Modal
        visible={apiKeyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setApiKeyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setApiKeyModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>API Key</Text>
            <TouchableOpacity onPress={handleSaveApiKey}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Enter your API key from the Control Panel web app. You can create one in Settings → API Keys.
            </Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.apiKeyInput}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder="cp_xxxxxxxxxxxxxxxx"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={false}
                autoComplete="off"
              />
            </View>
            
            {isAuthenticated && (
              <Text style={styles.currentKeyInfo}>
                Current key: {apiKey?.slice(0, 15)}...
              </Text>
            )}
            
            <Text style={styles.modalHint}>
              Your API key is stored securely on this device and is used to authenticate with the Control Panel API.
            </Text>
          </View>
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  modalCancel: {
    color: "#3b82f6",
    fontSize: 17,
  },
  modalSave: {
    color: "#3b82f6",
    fontSize: 17,
    fontWeight: "600",
  },
  modalContent: {
    padding: 16,
  },
  modalDescription: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  inputContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
  },
  apiKeyInput: {
    color: "#fff",
    fontSize: 16,
    padding: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  currentKeyInfo: {
    color: "#22c55e",
    fontSize: 14,
    marginBottom: 16,
  },
  modalHint: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
  },
});
