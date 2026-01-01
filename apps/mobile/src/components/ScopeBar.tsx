import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import {
  useScopeStore,
  useCurrentScope,
  useScopedSites,
  useGlobalStats,
  type Site,
} from "../stores/scope";

interface ScopeBarProps {
  lastUpdated?: Date | null;
}

export function ScopeBar({ lastUpdated }: ScopeBarProps) {
  const { type, site, isGlobal } = useCurrentScope();
  const globalStats = useGlobalStats();
  const { openSwitcher } = useScopeStore();

  const formatLastUpdated = (date: Date | null | undefined) => {
    if (!date) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Updated just now";
    if (diffMins < 60) return `Updated ${diffMins}m ago`;
    return `Updated ${Math.floor(diffMins / 60)}h ago`;
  };

  const getCriticalCount = () => {
    if (isGlobal) return globalStats.totalCritical;
    return site?.criticalAlerts ?? 0;
  };

  const getHealthPercentage = () => {
    if (isGlobal && globalStats.totalSites > 0) {
      return Math.round(
        (globalStats.healthySites / globalStats.totalSites) * 100
      );
    }
    if (site?.status === "healthy") return 100;
    if (site?.status === "degraded") return 75;
    if (site?.status === "unhealthy") return 25;
    return 0;
  };

  const criticalCount = getCriticalCount();
  const healthPct = getHealthPercentage();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={openSwitcher}
      activeOpacity={0.7}
    >
      <View style={styles.scopeInfo}>
        <View style={styles.scopeLabel}>
          <Ionicons
            name={isGlobal ? "globe-outline" : "business-outline"}
            size={16}
            color="#3b82f6"
          />
          <Text style={styles.scopeName}>
            {isGlobal ? "Global" : site?.name ?? "Select Site"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748b" />
        </View>
      </View>

      <View style={styles.statusChips}>
        {criticalCount > 0 && (
          <View style={[styles.chip, styles.criticalChip]}>
            <Text style={styles.criticalText}>{criticalCount} Critical</Text>
          </View>
        )}
        <View style={styles.chip}>
          <Text style={styles.chipText}>{healthPct}% Healthy</Text>
        </View>
      </View>

      {lastUpdated && (
        <Text style={styles.updatedText}>{formatLastUpdated(lastUpdated)}</Text>
      )}
    </TouchableOpacity>
  );
}

interface SiteSwitcherProps {
  onSiteSelect?: (siteId: string | null) => void;
}

export function SiteSwitcher({ onSiteSelect }: SiteSwitcherProps) {
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  const { isSwitcherOpen, closeSwitcher, setGlobalScope, setSiteScope } =
    useScopeStore();
  const { type, siteId: currentSiteId } = useCurrentScope();
  const { all: allSites, pinned: pinnedSites, recent: recentSites } = useScopedSites();

  React.useEffect(() => {
    if (isSwitcherOpen) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isSwitcherOpen]);

  const handleSelectGlobal = () => {
    setGlobalScope();
    onSiteSelect?.(null);
    closeSwitcher();
  };

  const handleSelectSite = (siteId: string) => {
    setSiteScope(siteId);
    onSiteSelect?.(siteId);
    closeSwitcher();
  };

  const filteredSites = searchQuery
    ? allSites.filter(
        (site) =>
          site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          site.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allSites;

  const renderBackdrop = React.useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const getStatusColor = (status: Site["status"]) => {
    switch (status) {
      case "healthy":
        return "#22c55e";
      case "degraded":
        return "#f59e0b";
      case "unhealthy":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  const renderSiteItem = (site: Site, showPin = true) => {
    const isSelected = currentSiteId === site.id;
    const { togglePinSite, pinnedSiteIds } = useScopeStore.getState();
    const isPinned = pinnedSiteIds.includes(site.id);

    return (
      <TouchableOpacity
        key={site.id}
        style={[styles.siteItem, isSelected && styles.siteItemSelected]}
        onPress={() => handleSelectSite(site.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(site.status) },
          ]}
        />
        <View style={styles.siteItemInfo}>
          <Text style={styles.siteItemName}>{site.name}</Text>
          <Text style={styles.siteItemSlug}>{site.slug}</Text>
        </View>
        <View style={styles.siteItemStats}>
          {site.criticalAlerts > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{site.criticalAlerts}C</Text>
            </View>
          )}
          {site.warningAlerts > 0 && (
            <View style={[styles.alertBadge, styles.warningBadge]}>
              <Text style={[styles.alertBadgeText, styles.warningText]}>
                {site.warningAlerts}W
              </Text>
            </View>
          )}
          {site.isDeploying && (
            <View style={[styles.alertBadge, styles.deployingBadge]}>
              <Text style={[styles.alertBadgeText, styles.deployingText]}>
                Deploying
              </Text>
            </View>
          )}
        </View>
        {showPin && (
          <TouchableOpacity
            style={styles.pinButton}
            onPress={() => togglePinSite(site.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isPinned ? "star" : "star-outline"}
              size={18}
              color={isPinned ? "#f59e0b" : "#64748b"}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={["70%"]}
      enablePanDownToClose
      onClose={closeSwitcher}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Switch Scope</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sites..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </BottomSheetView>

      <BottomSheetScrollView style={styles.sheetContent}>
        <TouchableOpacity
          style={[
            styles.globalItem,
            type === "global" && styles.globalItemSelected,
          ]}
          onPress={handleSelectGlobal}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={20} color="#3b82f6" />
          <Text style={styles.globalItemText}>Global (All Sites)</Text>
          {type === "global" && (
            <Ionicons name="checkmark" size={20} color="#3b82f6" />
          )}
        </TouchableOpacity>

        {pinnedSites.length > 0 && !searchQuery && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PINNED</Text>
            {pinnedSites.map((site) => renderSiteItem(site, false))}
          </View>
        )}

        {recentSites.length > 0 && !searchQuery && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RECENT</Text>
            {recentSites.map((site) => renderSiteItem(site))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {searchQuery ? "SEARCH RESULTS" : "ALL SITES"}
          </Text>
          {filteredSites.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery ? "No sites match your search" : "No sites available"}
            </Text>
          ) : (
            filteredSites.map((site) => renderSiteItem(site))
          )}
        </View>

        <View style={{ height: 40 }} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  scopeInfo: {
    flex: 1,
  },
  scopeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scopeName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  statusChips: {
    flexDirection: "row",
    gap: 6,
  },
  chip: {
    backgroundColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  criticalChip: {
    backgroundColor: "#7f1d1d",
  },
  chipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "500",
  },
  criticalText: {
    color: "#fecaca",
    fontSize: 11,
    fontWeight: "600",
  },
  updatedText: {
    color: "#64748b",
    fontSize: 11,
    position: "absolute",
    right: 12,
    bottom: -14,
  },

  sheetBackground: {
    backgroundColor: "#0f172a",
  },
  handleIndicator: {
    backgroundColor: "#475569",
    width: 40,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 16,
  },

  globalItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    gap: 10,
  },
  globalItemSelected: {
    backgroundColor: "#1e3a5f",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  globalItemText: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },

  siteItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  siteItemSelected: {
    backgroundColor: "#1e3a5f",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  siteItemInfo: {
    flex: 1,
  },
  siteItemName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  siteItemSlug: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  siteItemStats: {
    flexDirection: "row",
    gap: 4,
  },
  alertBadge: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alertBadgeText: {
    color: "#fecaca",
    fontSize: 10,
    fontWeight: "600",
  },
  warningBadge: {
    backgroundColor: "#78350f",
  },
  warningText: {
    color: "#fde68a",
  },
  deployingBadge: {
    backgroundColor: "#1e3a5f",
  },
  deployingText: {
    color: "#93c5fd",
  },
  pinButton: {
    padding: 4,
  },

  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
});
