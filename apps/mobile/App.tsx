import React from "react";
import { TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { TRPCProvider } from "./src/lib/trpc";
import { initNetworkListener } from "./src/stores/offline";
import { useNotificationNavigation } from "./src/hooks/useNotificationNavigation";
import { useTheme } from "./src/hooks/useTheme";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { ApplicationsScreen } from "./src/screens/ApplicationsScreen";
import { ActivityFeedScreen } from "./src/screens/ActivityFeedScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ApplicationDetailScreen } from "./src/screens/ApplicationDetailScreen";
import { AlertDetailScreen } from "./src/screens/AlertDetailScreen";
import { NotificationDetailScreen } from "./src/screens/NotificationDetailScreen";
import { IssueDetailScreen } from "./src/screens/IssueDetailScreen";
import { AISessionsListScreen } from "./src/screens/AISessionsListScreen";
import { AISessionDetailScreen } from "./src/screens/AISessionDetailScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { useAuthStore } from "./src/stores/auth";

export type RootTabParamList = {
  Dashboard: undefined;
  Apps: undefined;
  Activity: undefined;
  Alerts: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  ApplicationDetail: { id: string };
  NotificationDetail: { id: string };
  AlertDetail: { id: string };
  IssueDetail: { issueId: string };
  AISessionsList: undefined;
  AISessionDetail: { sessionId: string };
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function NotificationHandler() {
  useNotificationNavigation();
  return null;
}

function MainTabs() {
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: React.ComponentProps<typeof Ionicons>["name"];

          switch (route.name) {
            case "Dashboard":
              iconName = focused ? "home" : "home-outline";
              break;
            case "Apps":
              iconName = focused ? "cube" : "cube-outline";
              break;
            case "Activity":
              iconName = focused ? "pulse" : "pulse-outline";
              break;
            case "Alerts":
              iconName = focused ? "alert-circle" : "alert-circle-outline";
              break;
            default:
              iconName = "help-circle-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDark ? "#64748b" : "#94a3b8",
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings" as never)}
            style={{ marginRight: 16 }}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          headerTitle: "Control Panel",
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
        name="Activity"
        component={ActivityFeedScreen}
        options={{
          title: "Activity",
          headerTitle: "Activity",
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: "Alerts",
          headerTitle: "Alerts",
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { theme, isDark, colors } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <>
        <StatusBar style={isDark ? "light" : "dark"} />
        <LoginScreen />
      </>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <NotificationHandler />
      <OfflineBanner />
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="ApplicationDetail"
          component={ApplicationDetailScreen}
          options={{ headerShown: true, headerTitle: "Application" }}
        />
        <Stack.Screen
          name="AlertDetail"
          component={AlertDetailScreen}
          options={{ headerShown: true, headerTitle: "Alert" }}
        />
        <Stack.Screen
          name="NotificationDetail"
          component={NotificationDetailScreen}
          options={{ headerShown: true, headerTitle: "Notification" }}
        />
        <Stack.Screen
          name="IssueDetail"
          component={IssueDetailScreen}
          options={{ headerShown: true, headerTitle: "Issue Details" }}
        />
        <Stack.Screen
          name="AISessionsList"
          component={AISessionsListScreen}
          options={{ headerShown: true, headerTitle: "AI Sessions" }}
        />
        <Stack.Screen
          name="AISessionDetail"
          component={AISessionDetailScreen}
          options={{ headerShown: true, headerTitle: "AI Fix Session" }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: true, headerTitle: "Settings" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  React.useEffect(() => {
    const unsubscribe = initNetworkListener();
    return () => unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <TRPCProvider>
            <AppContent />
          </TRPCProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
