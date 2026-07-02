import React from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "../auth/AuthContext";
import { queueJoinLive } from "../navigation/liveJoinBridge";
import { navigateToJoinLive } from "../navigation/navigationRef";
import {
  addNotificationReceivedListener,
  registerPushNotifications,
  setupDirectMessageNotificationCategory,
  setupIncomingCallNotificationCategories,
  unregisterPushNotifications
} from "./pushNotifications";
import { handleNotificationResponse } from "./notificationNavigation";
import { registerNotificationResponseHandler } from "./registerNotificationHandlers";
import { presentIncomingCallFromPush } from "./GlobalIncomingCallHost";

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

    void setupDirectMessageNotificationCategory();
    void setupIncomingCallNotificationCategories();
    registerNotificationResponseHandler();

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void handleNotificationResponse(response, { authToken: authTokenRef.current });
    });

    const receivedSub = addNotificationReceivedListener((event) => {
      const data = event.request.content.data || {};
      const type = String(data.type || "");
      if (type !== "incoming_call" && type !== "live_share") return;
      if (type === "live_share") {
        const postId = Number(data.postId);
        if (Number.isFinite(postId) && postId > 0) {
          queueJoinLive(postId);
          navigateToJoinLive();
        }
        return;
      }
      const callerId = Number(data.callerId);
      const roomName = String(data.roomName || "").trim();
      const mode = String(data.mode || "voice") === "video" ? "video" : "voice";
      const callerName = String(event.request.content.title || "Someone").trim() || "Someone";
      const callerAvatarUrl = String(data.callerAvatarUrl || "").trim() || null;
      if (Number.isFinite(callerId) && callerId > 0 && roomName) {
        presentIncomingCallFromPush({
          callerId,
          callerName,
          roomName,
          mode,
          callerAvatarUrl
        });
      }
    });
    return () => {
      receivedSub.remove();
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
