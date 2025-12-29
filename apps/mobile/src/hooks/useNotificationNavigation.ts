import { useEffect, useRef, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface NotificationData {
  type?: string;
  alertId?: string;
  deploymentId?: string;
  notificationId?: string;
  category?: string;
  severity?: string;
  status?: string;
}

export function useNotificationNavigation() {
  const navigation = useNavigation<NavigationProp>();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const handleNotificationTap = useCallback(
    (data: NotificationData) => {
      if (!data) return;

      switch (data.type) {
        case "alert":
          if (data.alertId) {
            navigation.navigate("AlertDetail", { id: data.alertId });
          }
          break;

        case "deployment":
          if (data.deploymentId) {
            navigation.navigate("ApplicationDetail", { id: data.deploymentId });
          }
          break;

        case "notification":
          if (data.notificationId) {
            navigation.navigate("NotificationDetail", { id: data.notificationId });
          }
          break;

        default:
          if (data.notificationId) {
            navigation.navigate("NotificationDetail", { id: data.notificationId });
          } else if (data.alertId) {
            navigation.navigate("AlertDetail", { id: data.alertId });
          }
      }
    },
    [navigation]
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
