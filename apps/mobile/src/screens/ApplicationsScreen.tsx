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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { trpc } from "../lib/trpc";
import { useTheme } from "../hooks/useTheme";
import type { RootStackParamList } from "../../App";
import { AppGridTile } from "../components/dashboard";

type HealthStatus = "critical" | "warning" | "healthy";

export function ApplicationsScreen() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useTheme();

  const applicationsQuery = trpc.applications.listWithHealth.useQuery();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await applicationsQuery.refetch();
    setRefreshing(false);
  }, [applicationsQuery]);

  const applications = applicationsQuery.data ?? [];
  const filteredApps = applications.filter((app) =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const healthyCount = applications.filter((a) => a.status === "healthy").length;
  const warningCount = applications.filter((a) => a.status === "warning").length;
  const criticalCount = applications.filter((a) => a.status === "critical").length;
  const deployingCount = applications.filter((a) => a.isDeploying).length;

  const handleAppPress = (appId: string) => {
    navigation.navigate("ApplicationDetail", { id: appId });
  };

  const renderGridItem = ({ item, index }: { item: typeof applications[0]; index: number }) => {
    const isLeft = index % 2 === 0;
    return (
      <View style={[styles.gridItem, isLeft ? styles.gridItemLeft : styles.gridItemRight]}>
        <AppGridTile
          name={item.name}
          status={item.status as HealthStatus}
          isDeploying={item.isDeploying}
          gitProvider={item.gitProvider ?? undefined}
          deployProvider={item.deployProvider ?? undefined}
          onPress={() => handleAppPress(item.id)}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search applications..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{applications.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#22c55e" }]}>{healthyCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Healthy</Text>
        </View>
        {warningCount > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#f59e0b" }]}>{warningCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Warning</Text>
          </View>
        )}
        {criticalCount > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#ef4444" }]}>{criticalCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Critical</Text>
          </View>
        )}
        {deployingCount > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#3b82f6" }]}>{deployingCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Deploying</Text>
          </View>
        )}
      </View>

      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderGridItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Applications</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {searchQuery
                ? "No applications match your search"
                : "Add your first application to get started"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 14,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  gridContent: {
    paddingHorizontal: 10,
    paddingBottom: 100,
  },
  gridItem: {
    flex: 1,
    maxWidth: "50%",
  },
  gridItemLeft: {
    paddingRight: 0,
  },
  gridItemRight: {
    paddingLeft: 0,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
