import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

export type ThemePreference = "system" | "light" | "dark";
export type ApiEnvironment = "production" | "local";

const API_URLS: Record<ApiEnvironment, string> = {
  production: "https://control.gmac.io",
  local: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
};

export interface SettingsState {
  biometricEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  defaultToGlobalScope: boolean;
  themePreference: ThemePreference;
  apiEnvironment: ApiEnvironment;
  demoMode: boolean;

  setBiometricEnabled: (enabled: boolean) => void;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  setDefaultToGlobalScope: (enabled: boolean) => void;
  setThemePreference: (theme: ThemePreference) => void;
  setApiEnvironment: (env: ApiEnvironment) => void;
  setDemoMode: (enabled: boolean) => void;
  getApiUrl: () => string;
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (error) {
      console.error("[SettingsStore] Failed to persist:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error("[SettingsStore] Failed to remove:", error);
    }
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      biometricEnabled: true,
      hapticFeedbackEnabled: true,
      defaultToGlobalScope: true,
      themePreference: "system" as ThemePreference,
      apiEnvironment: "production" as ApiEnvironment,
      demoMode: false,

      setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
      setHapticFeedbackEnabled: (enabled) => set({ hapticFeedbackEnabled: enabled }),
      setDefaultToGlobalScope: (enabled) => set({ defaultToGlobalScope: enabled }),
      setThemePreference: (theme) => set({ themePreference: theme }),
      setApiEnvironment: (env) => set({ apiEnvironment: env }),
      setDemoMode: (enabled) => set({ demoMode: enabled }),
      getApiUrl: () => API_URLS[get().apiEnvironment] || API_URLS.production,
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);

export const useBiometricSetting = () =>
  useSettingsStore((state) => state.biometricEnabled);

export const useThemePreference = () =>
  useSettingsStore((state) => state.themePreference);

export const useApiEnvironment = () =>
  useSettingsStore((state) => state.apiEnvironment);

export const useDemoMode = () =>
  useSettingsStore((state) => state.demoMode);

export const getApiUrl = () => {
  const state = useSettingsStore.getState();
  const env = state.apiEnvironment || "production";
  return API_URLS[env] || API_URLS.production;
};

export { API_URLS };
