import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export type ActionType = "acknowledge_alert" | "add_note" | "mute_alert" | "snooze_alert";

export interface QueuedAction {
  id: string;
  type: ActionType;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export interface CachedData<T> {
  data: T;
  timestamp: string;
  scopeId: string | null;
}

export interface OfflineState {
  isOnline: boolean;
  lastOnlineAt: string | null;

  actionQueue: QueuedAction[];

  cachedHealthSummary: CachedData<unknown> | null;
  cachedAlerts: CachedData<unknown[]> | null;
  cachedApplications: CachedData<unknown[]> | null;

  setOnlineStatus: (isOnline: boolean) => void;
  queueAction: (type: ActionType, payload: Record<string, unknown>) => void;
  removeQueuedAction: (id: string) => void;
  clearActionQueue: () => void;
  incrementRetryCount: (id: string) => void;

  cacheHealthSummary: (data: unknown, scopeId: string | null) => void;
  cacheAlerts: (data: unknown[], scopeId: string | null) => void;
  cacheApplications: (data: unknown[], scopeId: string | null) => void;

  getCacheAge: (cache: CachedData<unknown> | null) => number | null;
  isCacheStale: (cache: CachedData<unknown> | null, maxAgeMs: number) => boolean;

  clearCache: () => void;
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
      console.error("[OfflineStore] Failed to persist:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error("[OfflineStore] Failed to remove:", error);
    }
  },
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const MAX_RETRY_COUNT = 3;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const CACHE_MAX_AGE_MS = FIVE_MINUTES_MS;

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: true,
      lastOnlineAt: null,

      actionQueue: [],

      cachedHealthSummary: null,
      cachedAlerts: null,
      cachedApplications: null,

      setOnlineStatus: (isOnline) => {
        set({
          isOnline,
          lastOnlineAt: isOnline ? new Date().toISOString() : get().lastOnlineAt,
        });
      },

      queueAction: (type, payload) => {
        const action: QueuedAction = {
          id: generateId(),
          type,
          payload,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };
        set((state) => ({
          actionQueue: [...state.actionQueue, action],
        }));
      },

      removeQueuedAction: (id) => {
        set((state) => ({
          actionQueue: state.actionQueue.filter((a) => a.id !== id),
        }));
      },

      clearActionQueue: () => {
        set({ actionQueue: [] });
      },

      incrementRetryCount: (id) => {
        set((state) => ({
          actionQueue: state.actionQueue.map((a) =>
            a.id === id ? { ...a, retryCount: a.retryCount + 1 } : a
          ),
        }));
      },

      cacheHealthSummary: (data, scopeId) => {
        set({
          cachedHealthSummary: {
            data,
            timestamp: new Date().toISOString(),
            scopeId,
          },
        });
      },

      cacheAlerts: (data, scopeId) => {
        set({
          cachedAlerts: {
            data,
            timestamp: new Date().toISOString(),
            scopeId,
          },
        });
      },

      cacheApplications: (data, scopeId) => {
        set({
          cachedApplications: {
            data,
            timestamp: new Date().toISOString(),
            scopeId,
          },
        });
      },

      getCacheAge: (cache) => {
        if (!cache) return null;
        return Date.now() - new Date(cache.timestamp).getTime();
      },

      isCacheStale: (cache, maxAgeMs = CACHE_MAX_AGE_MS) => {
        const age = get().getCacheAge(cache);
        if (age === null) return true;
        return age > maxAgeMs;
      },

      clearCache: () => {
        set({
          actionQueue: [],
          cachedHealthSummary: null,
          cachedAlerts: null,
          cachedApplications: null,
        });
      },
    }),
    {
      name: "offline-storage",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        actionQueue: state.actionQueue,
        cachedHealthSummary: state.cachedHealthSummary,
        cachedAlerts: state.cachedAlerts,
        cachedApplications: state.cachedApplications,
        lastOnlineAt: state.lastOnlineAt,
      }),
    }
  )
);

export function initNetworkListener() {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    useOfflineStore.getState().setOnlineStatus(state.isConnected ?? false);
  });
  return unsubscribe;
}

export async function processActionQueue() {
  const { actionQueue, removeQueuedAction, incrementRetryCount, isOnline } =
    useOfflineStore.getState();

  if (!isOnline || actionQueue.length === 0) return;

  for (const action of actionQueue) {
    if (action.retryCount >= MAX_RETRY_COUNT) {
      console.warn(`[OfflineStore] Action ${action.id} exceeded max retries, removing`);
      removeQueuedAction(action.id);
      continue;
    }

    try {
      console.log(`[OfflineStore] Processing queued action: ${action.type}`);
      removeQueuedAction(action.id);
    } catch (error) {
      console.error(`[OfflineStore] Failed to process action ${action.id}:`, error);
      incrementRetryCount(action.id);
    }
  }
}

export const useIsOnline = () => useOfflineStore((state) => state.isOnline);
export const useActionQueue = () => useOfflineStore((state) => state.actionQueue);
export const useLastOnlineAt = () => useOfflineStore((state) => state.lastOnlineAt);
