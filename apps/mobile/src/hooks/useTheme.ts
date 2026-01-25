import { useColorScheme } from "react-native";
import { DefaultTheme, DarkTheme as NavigationDarkTheme } from "@react-navigation/native";
import { useThemePreference, ThemePreference } from "../stores/settings";

const LightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: "#3b82f6",
    background: "#f8fafc",
    card: "#ffffff",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    notification: "#ef4444",
  },
};

const DarkTheme = {
  ...NavigationDarkTheme,
  dark: true,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: "#3b82f6",
    background: "#0f172a",
    card: "#1e293b",
    text: "#fff",
    textMuted: "#94a3b8",
    border: "#334155",
    notification: "#ef4444",
  },
};

export function useTheme() {
  const themePreference = useThemePreference();
  const systemColorScheme = useColorScheme();

  const resolvedTheme = resolveTheme(themePreference, systemColorScheme);
  const isDark = resolvedTheme === "dark";

  return {
    theme: isDark ? DarkTheme : LightTheme,
    isDark,
    colors: isDark ? DarkTheme.colors : LightTheme.colors,
  };
}

function resolveTheme(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined
): "light" | "dark" {
  if (preference === "system") {
    return systemScheme === "dark" ? "dark" : "light";
  }
  return preference;
}

export { LightTheme, DarkTheme };
