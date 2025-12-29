# Mobile Overview Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign mobile app navigation from 6 tabs to 4, with new "Sites-first Overview" screen.

**Architecture:** New `OverviewScreen` fetches applications with aggregated notification counts via new tRPC endpoint. Navigation restructured to 4 tabs with "More" menu nesting less-used screens.

**Tech Stack:** React Native, Expo, React Navigation (bottom tabs + stack), tRPC, Drizzle ORM

---

## Task 1: Add `listWithHealth` tRPC Endpoint

**Files:**
- Modify: `packages/api/src/routers/applications.ts`

**Step 1: Add the new procedure**

Add after line 88 (after `bySlug` procedure):

```typescript
  /**
   * Get all applications with health status based on notifications
   */
  listWithHealth: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get all applications
      const apps = await ctx.db
        .select()
        .from(applications)
        .orderBy(desc(applications.createdAt));

      // Get active notifications (last 24h, not resolved)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeNotifications = await ctx.db
        .select()
        .from(notifications)
        .where(
          and(
            sql`${notifications.createdAt} > ${oneDayAgo}`,
            sql`${notifications.status} != 'resolved'`
          )
        );

      // Aggregate per application
      return apps.map((app) => {
        const appNotifications = activeNotifications.filter(
          (n) => n.appId === app.id
        );
        
        const criticalCount = appNotifications.filter(
          (n) => n.severity === 'critical'
        ).length;
        const warningCount = appNotifications.filter(
          (n) => n.severity === 'warning'
        ).length;

        const status: 'critical' | 'warning' | 'healthy' = 
          criticalCount > 0 ? 'critical' :
          warningCount > 0 ? 'warning' : 'healthy';

        const latestNotification = appNotifications
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        return {
          id: app.id,
          name: app.name,
          slug: app.slug,
          status,
          alertCounts: { critical: criticalCount, warning: warningCount },
          latestAlert: latestNotification ? {
            message: latestNotification.message,
            severity: latestNotification.severity as 'critical' | 'warning',
            timestamp: latestNotification.createdAt,
          } : null,
          lastActivity: latestNotification?.createdAt ?? app.updatedAt,
        };
      }).sort((a, b) => {
        // Sort by status severity (critical > warning > healthy)
        const statusOrder = { critical: 0, warning: 1, healthy: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        // Then by most recent activity
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      });
    }),
```

**Step 2: Add required imports at top of file**

Add to imports (line 9):

```typescript
import { applications, notifications, desc, eq, and, sql } from "@repo/db";
```

**Step 3: Verify no TypeScript errors**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/api/src/routers/applications.ts
git commit -m "feat(api): add listWithHealth endpoint for mobile overview"
```

---

## Task 2: Create OverviewScreen Component

**Files:**
- Create: `apps/mobile/src/screens/OverviewScreen.tsx`

**Step 1: Create the screen file**

```tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { trpc } from "../lib/trpc";
import type { RootStackParamList } from "../../App";

type OverviewNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type HealthStatus = "critical" | "warning" | "healthy";

interface SiteCardProps {
  id: string;
  name: string;
  status: HealthStatus;
  alertCounts: { critical: number; warning: number };
  latestAlert: {
    message: string;
    severity: string;
    timestamp: Date;
  } | null;
  onPress: () => void;
}

function SiteCard({ name, status, alertCounts, latestAlert, onPress }: SiteCardProps) {
  const statusColors: Record<HealthStatus, string> = {
    critical: "#ef4444",
    warning: "#f59e0b",
    healthy: "#22c55e",
  };

  const totalAlerts = alertCounts.critical + alertCounts.warning;

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <TouchableOpacity style={styles.siteCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.siteCardHeader}>
        <View style={styles.siteCardLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]} />
          <Text style={styles.siteName}>{name}</Text>
        </View>
        <View style={styles.siteCardRight}>
          {totalAlerts > 0 && (
            <View style={[styles.alertBadge, { backgroundColor: statusColors[status] + "20" }]}>
              <Text style={[styles.alertBadgeText, { color: statusColors[status] }]}>
                {totalAlerts}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </View>
      </View>
      <Text style={styles.siteMessage} numberOfLines={1}>
        {latestAlert ? latestAlert.message : "All clear"}
      </Text>
      {latestAlert && (
        <Text style={styles.siteTime}>{formatTimeAgo(latestAlert.timestamp)}</Text>
      )}
    </TouchableOpacity>
  );
}

export function OverviewScreen() {
  const navigation = useNavigation<OverviewNavigationProp>();
  const [refreshing, setRefreshing] = React.useState(false);

  const appsQuery = trpc.applications.listWithHealth.useQuery();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await appsQuery.refetch();
    setRefreshing(false);
  }, [appsQuery]);

  const apps = appsQuery.data ?? [];
  const needsAttention = apps.filter((a) => a.status !== "healthy").length;

  const getHeaderMessage = () => {
    if (appsQuery.isLoading) return "Loading...";
    if (apps.length === 0) return "No sites configured";
    if (needsAttention === 0) return `All ${apps.length} sites healthy`;
    return `${needsAttention} site${needsAttention > 1 ? "s" : ""} need attention`;
  };

  const getHeaderColor = () => {
    if (apps.some((a) => a.status === "critical")) return "#ef4444";
    if (apps.some((a) => a.status === "warning")) return "#f59e0b";
    return "#22c55e";
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
      }
    >
      {/* Status Banner */}
      <View style={[styles.statusBanner, { borderLeftColor: getHeaderColor() }]}>
        <View style={[styles.statusIndicator, { backgroundColor: getHeaderColor() }]} />
        <Text style={styles.statusText}>{getHeaderMessage()}</Text>
      </View>

      {/* Error State */}
      {appsQuery.isError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={20} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load sites</Text>
          <TouchableOpacity onPress={() => appsQuery.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Site Cards */}
      <View style={styles.siteList}>
        {apps.map((app) => (
          <SiteCard
            key={app.id}
            id={app.id}
            name={app.name}
            status={app.status}
            alertCounts={app.alertCounts}
            latestAlert={app.latestAlert}
            onPress={() => navigation.navigate("ApplicationDetail", { id: app.id })}
          />
        ))}
      </View>

      {/* Empty State */}
      {!appsQuery.isLoading && apps.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color="#64748b" />
          <Text style={styles.emptyTitle}>No Sites</Text>
          <Text style={styles.emptyText}>Add applications in the web dashboard</Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7f1d1d",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
  siteList: {
    padding: 16,
    gap: 12,
  },
  siteCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
  },
  siteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  siteCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  siteName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  siteCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: "center",
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  siteMessage: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 8,
    marginLeft: 24,
  },
  siteTime: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 24,
  },
  emptyState: {
    alignItems: "center",
    padding: 48,
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
    marginTop: 4,
  },
});
```

**Step 2: Verify no TypeScript errors**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors (may have some from App.tsx until we update it)

**Step 3: Commit**

```bash
git add apps/mobile/src/screens/OverviewScreen.tsx
git commit -m "feat(mobile): add OverviewScreen with sites-first design"
```

---

## Task 3: Create MoreScreen Component

**Files:**
- Create: `apps/mobile/src/screens/MoreScreen.tsx`

**Step 1: Create the screen file**

```tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootTabParamList, RootStackParamList } from "../../App";

type MoreNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, "More">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface MenuItemProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  badge?: number;
}

function MenuItem({ icon, label, onPress, badge }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={24} color="#94a3b8" />
        <Text style={styles.menuItemLabel}>{label}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </View>
    </TouchableOpacity>
  );
}

export function MoreScreen() {
  const navigation = useNavigation<MoreNavigationProp>();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tools</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            icon="git-branch-outline"
            label="Pipelines"
            onPress={() => navigation.navigate("Pipelines")}
          />
          <MenuItem
            icon="notifications-outline"
            label="Inbox"
            onPress={() => navigation.navigate("Notifications")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            icon="settings-outline"
            label="Settings"
            onPress={() => navigation.navigate("Settings")}
          />
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemLabel: {
    color: "#fff",
    fontSize: 16,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
```

**Step 2: Commit**

```bash
git add apps/mobile/src/screens/MoreScreen.tsx
git commit -m "feat(mobile): add MoreScreen menu for nested navigation"
```

---

## Task 4: Update App.tsx Navigation

**Files:**
- Modify: `apps/mobile/App.tsx`

**Step 1: Update imports (lines 12-17)**

Replace:
```typescript
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { ApplicationsScreen } from "./src/screens/ApplicationsScreen";
import { PipelinesScreen } from "./src/screens/PipelinesScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
```

With:
```typescript
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { ApplicationsScreen } from "./src/screens/ApplicationsScreen";
import { MoreScreen } from "./src/screens/MoreScreen";
// Stack screens accessed from More menu
import { PipelinesScreen } from "./src/screens/PipelinesScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
```

**Step 2: Update RootTabParamList type (lines 38-45)**

Replace:
```typescript
export type RootTabParamList = {
  Dashboard: undefined;
  Applications: undefined;
  Pipelines: undefined;
  Notifications: undefined;
  Alerts: undefined;
  Settings: undefined;
};
```

With:
```typescript
export type RootTabParamList = {
  Overview: undefined;
  Attention: undefined;
  Apps: undefined;
  More: undefined;
  // Hidden tabs (accessible from More menu via stack)
  Pipelines: undefined;
  Notifications: undefined;
  Settings: undefined;
};
```

**Step 3: Update RootStackParamList (add new stack screens after line 52)**

Replace:
```typescript
export type RootStackParamList = {
  Main: undefined;
  ApplicationDetail: { id: string };
  NotificationDetail: { id: string };
  AlertDetail: { id: string };
};
```

With:
```typescript
export type RootStackParamList = {
  Main: undefined;
  ApplicationDetail: { id: string };
  NotificationDetail: { id: string };
  AlertDetail: { id: string };
  // Screens accessible from More menu
  PipelinesStack: undefined;
  NotificationsStack: undefined;
  SettingsStack: undefined;
};
```

**Step 4: Replace MainTabs function (lines 62-166)**

Replace the entire `MainTabs` function with:

```typescript
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: React.ComponentProps<typeof Ionicons>["name"];

          switch (route.name) {
            case "Overview":
              iconName = focused ? "home" : "home-outline";
              break;
            case "Attention":
              iconName = focused ? "alert-circle" : "alert-circle-outline";
              break;
            case "Apps":
              iconName = focused ? "cube" : "cube-outline";
              break;
            case "More":
              iconName = focused ? "menu" : "menu-outline";
              break;
            default:
              iconName = "help-circle-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: {
          backgroundColor: "#1e293b",
          borderTopColor: "#334155",
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerStyle: {
          backgroundColor: "#1e293b",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "600",
        },
      })}
    >
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        options={{
          title: "Overview",
          headerTitle: "Sites",
        }}
      />
      <Tab.Screen
        name="Attention"
        component={AlertsScreen}
        options={{
          title: "Attention",
          headerTitle: "Needs Attention",
        }}
      />
      <Tab.Screen
        name="Apps"
        component={ApplicationsScreen}
        options={{
          title: "Apps",
          headerTitle: "Applications",
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          title: "More",
          headerTitle: "More",
        }}
      />
    </Tab.Navigator>
  );
}
```

**Step 5: Add stack screens for More menu items (inside Stack.Navigator, after AlertDetail screen ~line 200)**

Add before the closing `</Stack.Navigator>`:

```typescript
            <Stack.Screen
              name="PipelinesStack"
              component={PipelinesScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: "#1e293b" },
                headerTintColor: "#fff",
                headerTitle: "Pipelines",
              }}
            />
            <Stack.Screen
              name="NotificationsStack"
              component={NotificationsScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: "#1e293b" },
                headerTintColor: "#fff",
                headerTitle: "Notifications",
              }}
            />
            <Stack.Screen
              name="SettingsStack"
              component={SettingsScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: "#1e293b" },
                headerTintColor: "#fff",
                headerTitle: "Settings",
              }}
            />
```

**Step 6: Verify TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): restructure navigation to 4 tabs (Overview, Attention, Apps, More)"
```

---

## Task 5: Update MoreScreen Navigation Targets

**Files:**
- Modify: `apps/mobile/src/screens/MoreScreen.tsx`

**Step 1: Update navigation calls to use stack screens**

Replace the navigation calls in MenuItem onPress handlers:

```typescript
          <MenuItem
            icon="git-branch-outline"
            label="Pipelines"
            onPress={() => navigation.getParent()?.navigate("PipelinesStack")}
          />
          <MenuItem
            icon="notifications-outline"
            label="Inbox"
            onPress={() => navigation.getParent()?.navigate("NotificationsStack")}
          />
```

And:

```typescript
          <MenuItem
            icon="settings-outline"
            label="Settings"
            onPress={() => navigation.getParent()?.navigate("SettingsStack")}
          />
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/mobile/src/screens/MoreScreen.tsx
git commit -m "fix(mobile): update MoreScreen to navigate to stack screens"
```

---

## Task 6: Verify and Test

**Step 1: Run TypeScript check on entire project**

Run: `pnpm typecheck` (or `npx tsc --noEmit` in root)
Expected: No errors

**Step 2: Start mobile app**

Run: `cd apps/mobile && pnpm start`

**Step 3: Manual verification checklist**

- [ ] App loads with 4 tabs visible (Overview, Attention, Apps, More)
- [ ] Overview tab shows sites with status colors
- [ ] Tapping a site navigates to ApplicationDetail
- [ ] Attention tab shows alerts
- [ ] Apps tab shows applications list
- [ ] More tab shows menu with Pipelines, Inbox, Settings
- [ ] Tapping items in More menu navigates correctly with back button

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore(mobile): polish overview screen implementation"
```

---

## Summary

| Task | Files | Estimated Time |
|------|-------|----------------|
| 1. API endpoint | `packages/api/src/routers/applications.ts` | 5 min |
| 2. OverviewScreen | `apps/mobile/src/screens/OverviewScreen.tsx` | 10 min |
| 3. MoreScreen | `apps/mobile/src/screens/MoreScreen.tsx` | 5 min |
| 4. App.tsx navigation | `apps/mobile/App.tsx` | 10 min |
| 5. MoreScreen nav fix | `apps/mobile/src/screens/MoreScreen.tsx` | 2 min |
| 6. Verify & test | - | 10 min |

**Total:** ~42 minutes
