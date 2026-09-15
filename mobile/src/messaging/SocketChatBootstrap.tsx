import React from "react";
import { useAuth } from "../auth/AuthContext";
import { connectSocketChat, disconnectSocketChat, onStoryViewed } from "../services/socketChat";
import { markStoryIdsViewed } from "../navigation/storyActivityBridge";

export function SocketChatBootstrap() {
  const { token } = useAuth();

  React.useEffect(() => {
    if (!token) {
      disconnectSocketChat();
      return;
    }
    connectSocketChat(token);
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
