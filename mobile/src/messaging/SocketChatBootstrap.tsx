import React from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { connectSocketChat, disconnectSocketChat, onDirectThreadUpdate, onStoryViewed } from "../services/socketChat";
import { markStoryIdsViewed } from "../navigation/storyActivityBridge";
import { reportDmDeliveredOnDevice } from "../push/reportDmDelivered";

export function SocketChatBootstrap() {
  const { token } = useAuth();

  React.useEffect(() => {
    if (!token) {
      disconnectSocketChat();
      return;
    }
    connectSocketChat(token);
    // App/socket online → any pending DMs on this device are delivered.
    void reportDmDeliveredOnDevice({ token });
  }, [token]);

  React.useEffect(() => {
    if (!token || Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void reportDmDeliveredOnDevice({ token });
    });
    return () => sub.remove();
  }, [token]);

  React.useEffect(() => {
    if (!token) return;
    return onDirectThreadUpdate((update) => {
      // New inbound thread activity means the message reached this device.
      if (Number(update?.unreadDelta) > 0) {
        void reportDmDeliveredOnDevice({ token });
      }
    });
  }, [token]);

  React.useEffect(() => {
    return onStoryViewed((payload) => {
      const storyId = Number(payload?.storyId);
      if (!Number.isFinite(storyId) || storyId <= 0) return;
      markStoryIdsViewed([storyId]);
    });
  }, []);

  return null;
}
