import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

export interface SettingsState {
  biometricEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  defaultToGlobalScope: boolean;

  setBiometricEnabled: (enabled: boolean) => void;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  setDefaultToGlobalScope: (enabled: boolean) => void;
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
    (set) => ({
      biometricEnabled: true,
      hapticFeedbackEnabled: true,
      defaultToGlobalScope: true,

      setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
      setHapticFeedbackEnabled: (enabled) => set({ hapticFeedbackEnabled: enabled }),
      setDefaultToGlobalScope: (enabled) => set({ defaultToGlobalScope: enabled }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);

export const useBiometricSetting = () =>
  useSettingsStore((state) => state.biometricEnabled);
