import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useOAuth } from "../hooks/useOAuth";
import { useAuthStore } from "../stores/auth";
import { useTheme } from "../hooks/useTheme";

export function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { signIn, isLoading: oauthLoading, error: oauthError, isConfigured } = useOAuth();
  const setApiKey = useAuthStore((s) => s.setApiKey);
  
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  const handleApiKeySubmit = async () => {
    const trimmedKey = apiKeyInput.trim();
    if (!trimmedKey) {
      Alert.alert("Error", "Please enter an API key");
      return;
    }
    if (!trimmedKey.startsWith("cp_")) {
      Alert.alert("Error", "API key should start with 'cp_'");
      return;
    }

    setApiKeyLoading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${trimmedKey}` },
      });

      if (response.ok) {
        setApiKey(trimmedKey);
      } else {
        Alert.alert("Error", "Invalid API key");
      }
    } catch {
      Alert.alert("Error", "Failed to verify API key. Check your connection.");
    } finally {
      setApiKeyLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: 48,
    },
    logoIcon: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? "#94a3b8" : "#64748b",
      textAlign: "center",
    },
    buttonContainer: {
      gap: 12,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 12,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "600",
    },
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: isDark ? "#64748b" : "#94a3b8",
      paddingHorizontal: 16,
      fontSize: 14,
    },
    apiKeySection: {
      marginTop: 16,
    },
    input: {
      backgroundColor: isDark ? "#1e293b" : "#f8fafc",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      marginBottom: 12,
    },
    errorText: {
      color: "#ef4444",
      fontSize: 14,
      textAlign: "center",
      marginBottom: 16,
    },
    footer: {
      padding: 24,
      alignItems: "center",
    },
    footerText: {
      color: isDark ? "#64748b" : "#94a3b8",
      fontSize: 13,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="server" size={40} color="#fff" />
            </View>
            <Text style={styles.title}>GMAC Control Panel</Text>
            <Text style={styles.subtitle}>
              Sign in to manage your infrastructure
            </Text>
          </View>

          {(oauthError) && (
            <Text style={styles.errorText}>{oauthError}</Text>
          )}

          <View style={styles.buttonContainer}>
            {isConfigured && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={signIn}
                disabled={oauthLoading}
              >
                {oauthLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-microsoft" size={24} color="#fff" />
                    <Text style={styles.primaryButtonText}>
                      Sign in with Microsoft
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {!showApiKeyInput ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowApiKeyInput(true)}
              >
                <Ionicons name="key" size={24} color={colors.text} />
                <Text style={styles.secondaryButtonText}>Use API Key</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.apiKeySection}>
                <TextInput
                  style={styles.input}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  placeholder="cp_xxxxxxxxxxxxxxxx"
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleApiKeySubmit}
                  disabled={apiKeyLoading}
                >
                  {apiKeyLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Connect</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, { marginTop: 12 }]}
                  onPress={() => setShowApiKeyInput(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Get an API key from the web dashboard
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
