import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "../lib/trpc";

interface ApplicationItemProps {
  name: string;
  slug: string;
  status: string;
  repositoryUrl?: string | null;
  onPress: () => void;
}

function ApplicationItem({
  name,
  slug,
  status,
  repositoryUrl,
  onPress,
}: ApplicationItemProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "healthy":
        return "#22c55e";
      case "degraded":
      case "warning":
        return "#f59e0b";
      case "inactive":
      case "error":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <TouchableOpacity style={styles.appItem} onPress={onPress}>
      <View style={styles.appIcon}>
        <Ionicons name="cube" size={24} color="#3b82f6" />
      </View>
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{name}</Text>
        <Text style={styles.appSlug}>{slug}</Text>
        {repositoryUrl && (
          <View style={styles.repoRow}>
            <Ionicons name="git-branch" size={12} color="#64748b" />
            <Text style={styles.repoText} numberOfLines={1}>
              {repositoryUrl.replace("https://", "")}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.statusContainer}>
        <View
          style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]}
        />
        <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
          {status}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#64748b" />
    </TouchableOpacity>
  );
}

export function ApplicationsScreen() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);

  const applicationsQuery = trpc.applications.list.useQuery();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await applicationsQuery.refetch();
    setRefreshing(false);
  }, [applicationsQuery]);

  const applications = applicationsQuery.data ?? [];
  const filteredApps = applications.filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAppPress = (appId: string) => {
    // Navigate to app details
    console.log("Navigate to app:", appId);
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search applications..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{applications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#22c55e" }]}>
            {applications.filter((a) => a.status === "active").length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#f59e0b" }]}>
            {applications.filter((a) => a.status === "deploying").length}
          </Text>
          <Text style={styles.statLabel}>Deploying</Text>
        </View>
      </View>

      {/* Applications List */}
      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ApplicationItem
            name={item.name}
            slug={item.slug}
            status={item.status}
            repositoryUrl={item.repositoryUrl}
            onPress={() => handleAppPress(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#64748b" />
            <Text style={styles.emptyTitle}>No Applications</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? "No applications match your search"
                : "Add your first application to get started"}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    marginHorizontal: 16,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  appItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1e3a5f",
    justifyContent: "center",
    alignItems: "center",
  },
  appInfo: {
    flex: 1,
    marginLeft: 12,
  },
  appName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  appSlug: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 2,
  },
  repoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  repoText: {
    color: "#64748b",
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
