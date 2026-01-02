import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { SiteSwitcher } from "./src/components/ScopeBar";
import { QuickActionsFAB } from "./src/components/QuickActionsFAB";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { TRPCProvider } from "./src/lib/trpc";
import { initNetworkListener } from "./src/stores/offline";
import { useNotificationNavigation } from "./src/hooks/useNotificationNavigation";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { ApplicationsScreen } from "./src/screens/ApplicationsScreen";
import { MoreScreen } from "./src/screens/MoreScreen";
// Stack screens accessed from More menu
import { ActivityFeedScreen } from "./src/screens/ActivityFeedScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ApplicationDetailScreen } from "./src/screens/ApplicationDetailScreen";
import { AlertDetailScreen } from "./src/screens/AlertDetailScreen";
import { NotificationDetailScreen } from "./src/screens/NotificationDetailScreen";
import { IssueDetailScreen } from "./src/screens/IssueDetailScreen";
import { AISessionsListScreen } from "./src/screens/AISessionsListScreen";
import { AISessionDetailScreen } from "./src/screens/AISessionDetailScreen";

// Dark theme for the app
const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: "#3b82f6",
    background: "#0f172a",
    card: "#1e293b",
    text: "#fff",
    border: "#334155",
    notification: "#ef4444",
  },
};

export type RootTabParamList = {
  Overview: undefined;
  Attention: undefined;
  Apps: undefined;
  More: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  ApplicationDetail: { id: string };
  NotificationDetail: { id: string };
  AlertDetail: { id: string };
  Alerts: undefined;
  IssueDetail: { issueId: string };
  AISessionsList: undefined;
  AISessionDetail: { sessionId: string };
  PipelinesStack: undefined;
  NotificationsStack: undefined;
  SettingsStack: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function NotificationHandler() {
  useNotificationNavigation();
  return null;
}

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
            <NavigationContainer theme={DarkTheme}>
              <NotificationHandler />
              <OfflineBanner />
              <StatusBar style="light" />
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                }}
              >
                <Stack.Screen name="Main" component={MainTabs} />
                <Stack.Screen
                  name="ApplicationDetail"
                  component={ApplicationDetailScreen}
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#1e293b" },
                    headerTintColor: "#fff",
                    headerTitle: "Application",
                  }}
                />
                <Stack.Screen
                  name="AlertDetail"
                  component={AlertDetailScreen}
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#1e293b" },
                    headerTintColor: "#fff",
                    headerTitle: "Alert",
                  }}
                />
                <Stack.Screen
                  name="NotificationDetail"
                  component={NotificationDetailScreen}
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#1e293b" },
                    headerTintColor: "#fff",
                    headerTitle: "Notification",
                  }}
                />
                <Stack.Screen
                  name="IssueDetail"
                  component={IssueDetailScreen}
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#1e293b" },
                    headerTintColor: "#fff",
                    headerTitle: "Issue Details",
                  }}
                />
                <Stack.Screen
                  name="AISessionsList"
                  component={AISessionsListScreen}
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#1e293b" },
                    headerTintColor: "#fff",
                    headerTitle: "AI Sessions",
                  }}
                />
                <Stack.Screen
                  name="AISessionDetail"
                  component={AISessionDetailScreen}
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#1e293b" },
                    headerTintColor: "#fff",
                    headerTitle: "AI Fix Session",
                  }}
                />
                <Stack.Screen
                  name="Alerts"
                  component={AlertsScreen}
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#1e293b" },
                    headerTintColor: "#fff",
                    headerTitle: "Alerts",
                  }}
                />
                <Stack.Screen
                  name="PipelinesStack"
                  component={ActivityFeedScreen}
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#1e293b" },
                    headerTintColor: "#fff",
                    headerTitle: "Pipelines",
                  }}
                />
                <Stack.Screen
                  name="NotificationsStack"
                  component={ActivityFeedScreen}
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
              </Stack.Navigator>
              <SiteSwitcher />
              <QuickActionsFAB />
            </NavigationContainer>
          </TRPCProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
