import React from "react";
import { useAuth } from "../auth/AuthContext";
import { connectSocketChat, disconnectSocketChat } from "../services/socketChat";

export function SocketChatBootstrap() {
  const { token } = useAuth();

  React.useEffect(() => {
    if (!token) {
      disconnectSocketChat();
      return;
    }
    connectSocketChat(token);
  }, [token]);

  return null;
}
