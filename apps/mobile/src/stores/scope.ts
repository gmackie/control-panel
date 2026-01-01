import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

export type ScopeType = "global" | "site";

export interface Site {
  id: string;
  name: string;
  slug: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  criticalAlerts: number;
  warningAlerts: number;
  isDeploying?: boolean;
}

export interface ScopeState {
  scopeType: ScopeType;
  currentSiteId: string | null;
  currentSite: Site | null;

  sites: Site[];
  pinnedSiteIds: string[];
  recentSiteIds: string[];

  isSwitcherOpen: boolean;
  lastUpdated: Date | null;

  setScope: (type: ScopeType, siteId?: string | null) => void;
  setGlobalScope: () => void;
  setSiteScope: (siteId: string) => void;
  setSites: (sites: Site[]) => void;
  updateSite: (siteId: string, updates: Partial<Site>) => void;
  togglePinSite: (siteId: string) => void;
  addToRecent: (siteId: string) => void;
  openSwitcher: () => void;
  closeSwitcher: () => void;
  toggleSwitcher: () => void;
  setLastUpdated: (date: Date) => void;
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
      console.error("[ScopeStore] Failed to persist:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error("[ScopeStore] Failed to remove:", error);
    }
  },
};

const MAX_RECENT_SITES = 5;

export const useScopeStore = create<ScopeState>()(
  persist(
    (set, get) => ({
      scopeType: "global",
      currentSiteId: null,
      currentSite: null,
      sites: [],
      pinnedSiteIds: [],
      recentSiteIds: [],
      isSwitcherOpen: false,
      lastUpdated: null,

      setScope: (type, siteId = null) => {
        const { sites, addToRecent } = get();

        if (type === "global") {
          set({
            scopeType: "global",
            currentSiteId: null,
            currentSite: null,
          });
        } else if (type === "site" && siteId) {
          const site = sites.find((s) => s.id === siteId) || null;
          set({
            scopeType: "site",
            currentSiteId: siteId,
            currentSite: site,
          });
          addToRecent(siteId);
        }
      },

      setGlobalScope: () => {
        set({
          scopeType: "global",
          currentSiteId: null,
          currentSite: null,
        });
      },

      setSiteScope: (siteId) => {
        const { sites, addToRecent } = get();
        const site = sites.find((s) => s.id === siteId) || null;

        set({
          scopeType: "site",
          currentSiteId: siteId,
          currentSite: site,
        });
        addToRecent(siteId);
      },

      setSites: (sites) => {
        const { currentSiteId } = get();
        const currentSite = currentSiteId
          ? sites.find((s) => s.id === currentSiteId) || null
          : null;

        set({
          sites,
          currentSite,
          lastUpdated: new Date(),
        });
      },

      updateSite: (siteId, updates) => {
        const { sites, currentSiteId } = get();
        const updatedSites = sites.map((site) =>
          site.id === siteId ? { ...site, ...updates } : site
        );

        set({
          sites: updatedSites,
          currentSite:
            currentSiteId === siteId
              ? updatedSites.find((s) => s.id === siteId) || null
              : get().currentSite,
        });
      },

      togglePinSite: (siteId) => {
        const { pinnedSiteIds } = get();
        const isPinned = pinnedSiteIds.includes(siteId);

        set({
          pinnedSiteIds: isPinned
            ? pinnedSiteIds.filter((id) => id !== siteId)
            : [...pinnedSiteIds, siteId],
        });
      },

      addToRecent: (siteId) => {
        const { recentSiteIds } = get();
        const withoutCurrent = recentSiteIds.filter((id) => id !== siteId);
        const newRecentList = [siteId, ...withoutCurrent].slice(0, MAX_RECENT_SITES);
        set({ recentSiteIds: newRecentList });
      },

      openSwitcher: () => set({ isSwitcherOpen: true }),
      closeSwitcher: () => set({ isSwitcherOpen: false }),
      toggleSwitcher: () =>
        set((state) => ({ isSwitcherOpen: !state.isSwitcherOpen })),

      setLastUpdated: (date) => set({ lastUpdated: date }),
    }),
    {
      name: "scope-storage",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        scopeType: state.scopeType,
        currentSiteId: state.currentSiteId,
        pinnedSiteIds: state.pinnedSiteIds,
        recentSiteIds: state.recentSiteIds,
      }),
    }
  )
);

export const useCurrentScope = () =>
  useScopeStore((state) => ({
    type: state.scopeType,
    siteId: state.currentSiteId,
    site: state.currentSite,
    isGlobal: state.scopeType === "global",
  }));

export const useScopedSites = () =>
  useScopeStore((state) => ({
    all: state.sites,
    pinned: state.sites.filter((s) => state.pinnedSiteIds.includes(s.id)),
    recent: state.recentSiteIds
      .map((id) => state.sites.find((s) => s.id === id))
      .filter(Boolean) as Site[],
  }));

export const useScopeActions = () =>
  useScopeStore((state) => ({
    setGlobalScope: state.setGlobalScope,
    setSiteScope: state.setSiteScope,
    togglePinSite: state.togglePinSite,
    openSwitcher: state.openSwitcher,
    closeSwitcher: state.closeSwitcher,
  }));

export const useGlobalStats = () =>
  useScopeStore((state) => {
    const { sites } = state;
    return {
      totalSites: sites.length,
      healthySites: sites.filter((s) => s.status === "healthy").length,
      degradedSites: sites.filter((s) => s.status === "degraded").length,
      unhealthySites: sites.filter((s) => s.status === "unhealthy").length,
      totalCritical: sites.reduce((sum, s) => sum + s.criticalAlerts, 0),
      totalWarning: sites.reduce((sum, s) => sum + s.warningAlerts, 0),
      deployingCount: sites.filter((s) => s.isDeploying).length,
    };
  });
