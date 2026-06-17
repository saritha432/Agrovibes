import React from "react";
import { Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { navigateToDirectChat, navigateToDirectInbox, navigateToJoinLive } from "../navigation/navigationRef";
import { queueJoinLive } from "../navigation/liveJoinBridge";
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
      if (Number.isFinite(callerId) && callerId > 0 && roomName) {
        navigateToDirectChat({
          peerUserId: callerId,
          peerName: callerName,
          incomingCall: { roomName, mode, callerId }
        });
      }
    });
    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data || {};
      const type = String(data.type || "");
      if (type === "incoming_call") {
        const callerId = Number(data.callerId);
        const roomName = String(data.roomName || "").trim();
        const mode = String(data.mode || "voice") === "video" ? "video" : "voice";
        const callerName = String(response.notification.request.content.title || "Someone").trim() || "Someone";
        if (Number.isFinite(callerId) && callerId > 0 && roomName) {
          navigateToDirectChat({
            peerUserId: callerId,
            peerName: callerName,
            incomingCall: { roomName, mode, callerId }
          });
        }
        return;
      }
      if (type === "live_share") {
        const postId = Number(data.postId);
        if (Number.isFinite(postId) && postId > 0) {
          queueJoinLive(postId);
          navigateToJoinLive();
        } else {
          navigateToDirectInbox();
        }
        return;
      }
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
