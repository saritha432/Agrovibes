import React from "react";
import { Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { navigateToDirectInbox, navigateToJoinLive } from "../navigation/navigationRef";
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  registerPushNotifications,
  unregisterPushNotifications
} from "./pushNotifications";

export function PushNotificationBootstrap() {
  const { token, user } = useAuth();
  const registeredTokenRef = React.useRef<string | null>(null);
  const authTokenRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    authTokenRef.current = token;
  }, [token]);

  React.useEffect(() => {
    if (Platform.OS === "web" || !token || !user) return;
    let cancelled = false;
    void (async () => {
      const pushToken = await registerPushNotifications(token);
      if (!cancelled) registeredTokenRef.current = pushToken;
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  React.useEffect(() => {
    if (Platform.OS === "web") return;
    const receivedSub = addNotificationReceivedListener(() => {
      // In-app badge refresh is handled by NotificationPanel polling/focus.
    });
    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data || {};
      const type = String(data.type || "");
      if (type === "direct_message") {
        navigateToDirectInbox();
        return;
      }
      if (type === "live_start" || type === "live_scheduled" || type === "live_reminder") {
        navigateToJoinLive();
      }
    });
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  React.useEffect(() => {
    if (token) return;
    const previousAuth = authTokenRef.current;
    const previousPush = registeredTokenRef.current;
    registeredTokenRef.current = null;
    authTokenRef.current = null;
    if (previousAuth && previousPush) {
      void unregisterPushNotifications(previousAuth, previousPush);
    }
  }, [token]);

  return null;
}
