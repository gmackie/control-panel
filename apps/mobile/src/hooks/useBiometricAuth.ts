import { useCallback, useState, useEffect } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { Alert, Platform } from "react-native";
import { useSettingsStore } from "../stores/settings";

type BiometricType = "fingerprint" | "facial" | "iris" | "none";

interface BiometricState {
  isAvailable: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
}

interface UseBiometricAuthReturn extends BiometricState {
  authenticate: (reason: string) => Promise<boolean>;
  confirmDangerousAction: (
    actionName: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => Promise<void>;
}

function mapAuthenticationType(
  types: LocalAuthentication.AuthenticationType[]
): BiometricType {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "facial";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "iris";
  }
  return "none";
}

export function useBiometricAuth(): UseBiometricAuthReturn {
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    biometricType: "none",
    isEnrolled: false,
  });

  useEffect(() => {
    async function checkBiometrics() {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes =
        await LocalAuthentication.supportedAuthenticationTypesAsync();

      setState({
        isAvailable: hasHardware,
        isEnrolled,
        biometricType: mapAuthenticationType(supportedTypes),
      });
    }

    checkBiometrics();
  }, []);

  const shouldUseBiometric = biometricEnabled && state.isAvailable && state.isEnrolled;

  const authenticate = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!state.isAvailable || !state.isEnrolled) {
        return true;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
        cancelLabel: "Cancel",
      });

      return result.success;
    },
    [state.isAvailable, state.isEnrolled]
  );

  const confirmDangerousAction = useCallback(
    async (
      actionName: string,
      onConfirm: () => void,
      onCancel?: () => void
    ): Promise<void> => {
      const biometricLabel =
        state.biometricType === "facial"
          ? Platform.OS === "ios"
            ? "Face ID"
            : "Face Recognition"
          : state.biometricType === "fingerprint"
            ? Platform.OS === "ios"
              ? "Touch ID"
              : "Fingerprint"
            : "Biometric";

      if (!shouldUseBiometric) {
        Alert.alert(
          `Confirm ${actionName}`,
          `Are you sure you want to ${actionName.toLowerCase()}? This action may affect production systems.`,
          [
            { text: "Cancel", style: "cancel", onPress: onCancel },
            { text: "Confirm", style: "destructive", onPress: onConfirm },
          ]
        );
        return;
      }

      Alert.alert(
        `Confirm ${actionName}`,
        `This action requires ${biometricLabel} authentication.`,
        [
          { text: "Cancel", style: "cancel", onPress: onCancel },
          {
            text: `Use ${biometricLabel}`,
            onPress: async () => {
              const success = await authenticate(
                `Authenticate to ${actionName.toLowerCase()}`
              );
              if (success) {
                onConfirm();
              } else {
                Alert.alert(
                  "Authentication Failed",
                  "Unable to verify your identity. Action cancelled.",
                  [{ text: "OK" }]
                );
                onCancel?.();
              }
            },
          },
        ]
      );
    },
    [state, authenticate, shouldUseBiometric]
  );

  return {
    ...state,
    authenticate,
    confirmDangerousAction,
  };
}
