import React from "react";
import { Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { DirectCallView, type CallEndResult } from "../screens/messaging/DirectCallView";
import { buildDmCallMessage } from "../screens/messaging/dmMessageFormats";
import { sendDirectMessage } from "../services/api";
import { hideIncomingCallAndroidNotification } from "./incomingCallAndroidNotification";
import { clearIncomingCall, queueIncomingCall, subscribeIncomingCall, type QueuedIncomingCall } from "./incomingCallBridge";
import { completeIncomingCallDecline } from "./incomingCallDecline";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";

export function GlobalIncomingCallHost() {
  const { token } = useAuth();
  const [call, setCall] = React.useState<QueuedIncomingCall | null>(null);
  const [connectEnabled, setConnectEnabled] = React.useState(false);
  const historySentRef = React.useRef(false);

  React.useEffect(() => {
    return subscribeIncomingCall((next) => {
      setCall(next);
      setConnectEnabled(!!next?.autoAccept);
      if (next) historySentRef.current = false;
    });
  }, []);

  const finishCall = React.useCallback(
    async (result: CallEndResult) => {
      const active = call;
      if (active?.roomName) {
        void clearIncomingCallNotifications(active.roomName);
      } else {
        hideIncomingCallAndroidNotification();
      }
      clearIncomingCall();
      setCall(null);
      setConnectEnabled(false);

      if (!token || !active || historySentRef.current) return;
      historySentRef.current = true;
      try {
        await sendDirectMessage(
          token,
          active.callerId,
          buildDmCallMessage({
            mode: active.mode,
            status: result.status,
            durationSec: result.durationSec,
            direction: "incoming"
          })
        );
      } catch {
        // keep app usable if history write fails
      }
    },
    [call, token]
  );

  if (Platform.OS === "web" || !call) return null;

  return (
    <DirectCallView
      visible
      roomName={call.roomName}
      mode={call.mode}
      direction="incoming"
      peerName={call.callerName}
      peerAvatarUrl={call.callerAvatarUrl}
      connectEnabled={connectEnabled}
      statusLabel={call.mode === "video" ? "Incoming video call" : "Incoming voice call"}
      onAccept={() => {
        void clearIncomingCallNotifications(call.roomName);
        setConnectEnabled(true);
      }}
      onDecline={() => {
        const active = call;
        // Close UI immediately; shared decline path cancels caller ring + writes history.
        historySentRef.current = true;
        clearIncomingCall();
        setCall(null);
        setConnectEnabled(false);
        if (!active) return;
        void completeIncomingCallDecline({
          callerId: active.callerId,
          callerName: active.callerName,
          mode: active.mode,
          roomName: active.roomName,
          callerAvatarUrl: active.callerAvatarUrl,
          authToken: token,
          status: "declined"
        });
      }}
      onCallEnded={(result) => {
        if (result.status === "declined") return;
        void finishCall(result);
      }}
      onClose={() => {
        clearIncomingCall();
        setCall(null);
        setConnectEnabled(false);
      }}
    />
  );
}

/** Normalize push / deep-link payload into the global incoming-call queue. */
export function presentIncomingCallFromPush(input: {
  callerId: number;
  callerName: string;
  roomName: string;
  mode: "voice" | "video";
  callerAvatarUrl?: string | null;
  autoAccept?: boolean;
}) {
  if (!input.callerId || !input.roomName) return;
  queueIncomingCall({
    callerId: input.callerId,
    callerName: input.callerName || "Someone",
    callerAvatarUrl: input.callerAvatarUrl,
    roomName: input.roomName,
    mode: input.mode,
    autoAccept: input.autoAccept
  });
  if (input.autoAccept) {
    void clearIncomingCallNotifications(input.roomName);
  }
}
