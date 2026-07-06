import React from "react";
import { onDirectMessage } from "../services/socketChat";
import { handleCalleeRingCancelledMessage } from "./incomingCallSignal";

export function CallSignalBootstrap() {
  React.useEffect(() => {
    return onDirectMessage((payload) => {
      void handleCalleeRingCancelledMessage(payload.message);
    });
  }, []);

  return null;
}
