import { useEffect, useRef, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useScopeStore } from "../stores/scope";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface NotificationData {
  type?: string;
  alertId?: string;
  deploymentId?: string;
  notificationId?: string;
  applicationId?: string;
  category?: string;
  severity?: string;
  status?: string;
  siteId?: string;
  siteName?: string;
  siteSlug?: string;
}

export function useNotificationNavigation() {
  const navigation = useNavigation<NavigationProp>();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const setSiteScope = useScopeStore((state) => state.setSiteScope);
  const sites = useScopeStore((state) => state.sites);

  const setScopeFromNotification = useCallback(
    (data: NotificationData) => {
      if (data.siteId && sites.some((s) => s.id === data.siteId)) {
        setSiteScope(data.siteId);
      }
    },
    [sites, setSiteScope]
  );

  const handleNotificationTap = useCallback(
    (data: NotificationData) => {
      if (!data) return;

      setScopeFromNotification(data);

      switch (data.type) {
        case "alert":
          if (data.alertId) {
            navigation.navigate("AlertDetail", { id: data.alertId });
          }
          break;

        case "deployment":
          if (data.deploymentId) {
            navigation.navigate("ApplicationDetail", { id: data.deploymentId });
          } else if (data.applicationId) {
            navigation.navigate("ApplicationDetail", { id: data.applicationId });
          }
          break;

        case "application":
          if (data.applicationId) {
            navigation.navigate("ApplicationDetail", { id: data.applicationId });
          }
          break;

        case "notification":
          if (data.notificationId) {
            navigation.navigate("NotificationDetail", { id: data.notificationId });
          }
          break;

        case "site":
        case "site_health":
        case "site_alert":
          navigation.navigate("Main");
          break;

        default:
          if (data.notificationId) {
            navigation.navigate("NotificationDetail", { id: data.notificationId });
          } else if (data.alertId) {
            navigation.navigate("AlertDetail", { id: data.alertId });
          } else if (data.applicationId) {
            navigation.navigate("ApplicationDetail", { id: data.applicationId });
          }
      }
    },
    [navigation, setScopeFromNotification]
  );

  const checkInitialNotification = useCallback(async () => {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const data = response.notification.request.content.data as NotificationData;
      handleNotificationTap(data);
    }
  }, [handleNotificationTap]);

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationData;
        handleNotificationTap(data);
      }
    );

    checkInitialNotification();

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [handleNotificationTap, checkInitialNotification]);
}
