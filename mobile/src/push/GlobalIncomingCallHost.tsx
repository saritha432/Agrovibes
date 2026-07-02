import React from "react";
import { Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { DirectCallView, type CallEndResult } from "../screens/messaging/DirectCallView";
import { buildDmCallMessage } from "../screens/messaging/dmMessageFormats";
import { sendDirectMessage } from "../services/api";
import { navigateToDirectChat } from "../navigation/navigationRef";
import { hideIncomingCallAndroidNotification } from "./incomingCallAndroidNotification";
import { clearIncomingCall, queueIncomingCall, subscribeIncomingCall, type QueuedIncomingCall } from "./incomingCallBridge";

export function GlobalIncomingCallHost() {
  const { token } = useAuth();
  const [call, setCall] = React.useState<QueuedIncomingCall | null>(null);
  const [connectEnabled, setConnectEnabled] = React.useState(false);
  const historySentRef = React.useRef(false);

  React.useEffect(() => {
    return subscribeIncomingCall((next) => {
      setCall(next);
      setConnectEnabled(!!next?.autoAccept);
      historySentRef.current = false;
    });
  }, []);

  const finishCall = React.useCallback(
    async (result: CallEndResult) => {
      const active = call;
      hideIncomingCallAndroidNotification();
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
        setConnectEnabled(true);
        navigateToDirectChat({
          peerUserId: call.callerId,
          peerName: call.callerName,
          peerAvatarUrl: call.callerAvatarUrl || undefined
        });
      }}
      onDecline={() => {
        void finishCall({ status: "declined", durationSec: 0 });
      }}
      onCallEnded={(result) => {
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
}
