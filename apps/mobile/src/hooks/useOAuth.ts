import { useEffect, useState, useCallback } from "react";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import Constants from "expo-constants";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";

WebBrowser.maybeCompleteAuthSession();

const IS_DEV = Constants.expoConfig?.extra?.APP_VARIANT === "development" || 
               process.env.EXPO_PUBLIC_SKIP_AUTH === "true";

function getScheme(): string {
  return IS_DEV ? "controlpanel-dev" : "controlpanel";
}

export function useOAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const clearApiKey = useAuthStore((s) => s.clearApiKey);
  const getApiUrl = useSettingsStore((s) => s.getApiUrl);

  const scheme = getScheme();

  const handleDeepLink = useCallback(
    (event: { url: string }) => {
      const url = new URL(event.url);
      
      if (url.pathname === "/auth/callback" || url.host === "auth") {
        const apiKey = url.searchParams.get("apiKey");
        const errorParam = url.searchParams.get("error");

        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          setIsLoading(false);
          return;
        }

        if (apiKey) {
          setApiKey(apiKey);
          setError(null);
        } else {
          setError("No API key received");
        }
        setIsLoading(false);
      }
    },
    [setApiKey]
  );

  useEffect(() => {
    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url: string | null) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  const signIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = getApiUrl();
      const authUrl = `${apiUrl}/auth/mobile?scheme=${encodeURIComponent(scheme)}`;
      
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        `${scheme}://auth/callback`
      );

      if (result.type === "success" && result.url) {
        // URL comes back via result, not deep link, on iOS in-app browser
        handleDeepLink({ url: result.url });
      } else if (result.type === "cancel" || result.type === "dismiss") {
        setError("Sign in was cancelled");
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start authentication");
      setIsLoading(false);
    }
  };

  const signOut = () => {
    clearApiKey();
  };

  return {
    signIn,
    signOut,
    isLoading,
    error,
    isConfigured: true,
  };
}
