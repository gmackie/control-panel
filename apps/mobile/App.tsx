import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TRPCProvider } from "./src/lib/trpc";
import { useNotificationNavigation } from "./src/hooks/useNotificationNavigation";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { ApplicationsScreen } from "./src/screens/ApplicationsScreen";
import { PipelinesScreen } from "./src/screens/PipelinesScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ApplicationDetailScreen } from "./src/screens/ApplicationDetailScreen";
import { AlertDetailScreen } from "./src/screens/AlertDetailScreen";
import { NotificationDetailScreen } from "./src/screens/NotificationDetailScreen";

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

// Type definitions for navigation
export type RootTabParamList = {
  Dashboard: undefined;
  Applications: undefined;
  Pipelines: undefined;
  Notifications: undefined;
  Alerts: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  ApplicationDetail: { id: string };
  NotificationDetail: { id: string };
  AlertDetail: { id: string };
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
            case "Dashboard":
              iconName = focused ? "grid" : "grid-outline";
              break;
            case "Applications":
              iconName = focused ? "cube" : "cube-outline";
              break;
            case "Pipelines":
              iconName = focused ? "git-branch" : "git-branch-outline";
              break;
            case "Notifications":
              iconName = focused ? "notifications" : "notifications-outline";
              break;
            case "Alerts":
              iconName = focused ? "alert-circle" : "alert-circle-outline";
              break;
            case "Settings":
              iconName = focused ? "settings" : "settings-outline";
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
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          headerTitle: "Control Panel",
        }}
      />
      <Tab.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{
          title: "Apps",
          headerTitle: "Applications",
        }}
      />
      <Tab.Screen
        name="Pipelines"
        component={PipelinesScreen}
        options={{
          title: "Pipelines",
          headerTitle: "Pipelines",
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: "Inbox",
          headerTitle: "Notifications",
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: "Alerts",
          headerTitle: "Active Alerts",
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Settings",
          headerTitle: "Settings",
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TRPCProvider>
        <NavigationContainer theme={DarkTheme}>
          <NotificationHandler />
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
          </Stack.Navigator>
        </NavigationContainer>
      </TRPCProvider>
    </SafeAreaProvider>
  );
}
