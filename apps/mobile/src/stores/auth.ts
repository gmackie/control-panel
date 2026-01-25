import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

// Dev mode: skip auth entirely when EXPO_PUBLIC_SKIP_AUTH=true
const SKIP_AUTH = process.env.EXPO_PUBLIC_SKIP_AUTH === "true";
const DEV_API_KEY = "dev_skip_auth_key";

export interface AuthState {
  apiKey: string | null;
  isAuthenticated: boolean;
  isDevMode: boolean;

  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  initDevMode: () => void;
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
      console.error("[AuthStore] Failed to persist:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error("[AuthStore] Failed to remove:", error);
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiKey: SKIP_AUTH ? DEV_API_KEY : null,
      isAuthenticated: SKIP_AUTH,
      isDevMode: SKIP_AUTH,

      setApiKey: (key) => set({ apiKey: key, isAuthenticated: true }),
      clearApiKey: () => {
        if (SKIP_AUTH) {
          set({ apiKey: DEV_API_KEY, isAuthenticated: true, isDevMode: true });
        } else {
          set({ apiKey: null, isAuthenticated: false });
        }
      },
      initDevMode: () => {
        if (SKIP_AUTH) {
          set({ apiKey: DEV_API_KEY, isAuthenticated: true, isDevMode: true });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);

export const getApiKey = () => useAuthStore.getState().apiKey;
export const isDevMode = () => useAuthStore.getState().isDevMode;
