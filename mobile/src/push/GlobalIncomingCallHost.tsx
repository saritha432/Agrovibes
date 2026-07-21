import React from "react";
import { Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { DirectCallView, type CallEndResult } from "../screens/messaging/DirectCallView";
import { buildDmCallMessage } from "../screens/messaging/dmMessageFormats";
import { sendDirectMessage } from "../services/api";
import { hideIncomingCallAndroidNotification } from "./incomingCallAndroidNotification";
import { isCallRoomEnded, markCallRoomEnded } from "./cancelledCallRooms";
import { clearIncomingCall, queueIncomingCall, subscribeIncomingCall, type QueuedIncomingCall } from "./incomingCallBridge";
import { completeIncomingCallDecline } from "./incomingCallDecline";
import { getLocalCallSession, setLocalCallSession } from "./localCallSession";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";
import { verifyCallStillRinging } from "./verifyCallRinging";

export function GlobalIncomingCallHost() {
  const { token } = useAuth();
  const [call, setCall] = React.useState<QueuedIncomingCall | null>(null);
  const [connectEnabled, setConnectEnabled] = React.useState(false);
  const historySentRef = React.useRef(false);

  React.useEffect(() => {
    return subscribeIncomingCall((next) => {
      setCall(next);
      setConnectEnabled(!!next?.autoAccept);
      if (next) {
        historySentRef.current = false;
        setLocalCallSession({ roomName: next.roomName, peerUserId: next.callerId });
      } else {
        setLocalCallSession(null);
      }
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
      setLocalCallSession(null);

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
      peerUserId={call.callerId}
      connectEnabled={connectEnabled}
      statusLabel={call.mode === "video" ? "Incoming video call" : "Incoming voice call"}
      onAccept={() => {
        void (async () => {
          const stillRinging = await verifyCallStillRinging(call.roomName, token);
          if (!stillRinging) {
            markCallRoomEnded(call.roomName);
            await clearIncomingCallNotifications(call.roomName);
            clearIncomingCall();
            setCall(null);
            setConnectEnabled(false);
            setLocalCallSession(null);
            return;
          }
          await clearIncomingCallNotifications(call.roomName);
          setConnectEnabled(true);
        })();
      }}
      onDecline={() => {
        const active = call;
        historySentRef.current = true;
        setConnectEnabled(false);
        setCall(null);
        clearIncomingCall();
        setLocalCallSession(null);
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
        setLocalCallSession(null);
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
  authToken?: string | null;
}) {
  if (!input.callerId || !input.roomName) return;

  void (async () => {
    if (isCallRoomEnded(input.roomName)) {
      await clearIncomingCallNotifications(input.roomName);
      return;
    }

    const stillRinging = await verifyCallStillRinging(input.roomName, input.authToken);
    if (!stillRinging) {
      markCallRoomEnded(input.roomName);
      await clearIncomingCallNotifications(input.roomName);
      return;
    }

    const active = getLocalCallSession();
    if (active && active.roomName !== input.roomName) {
      void completeIncomingCallDecline({
        callerId: input.callerId,
        callerName: input.callerName || "Someone",
        mode: input.mode,
        roomName: input.roomName,
        callerAvatarUrl: input.callerAvatarUrl,
        authToken: input.authToken,
        status: "declined"
      });
      return;
    }

    queueIncomingCall({
      callerId: input.callerId,
      callerName: input.callerName || "Someone",
      callerAvatarUrl: input.callerAvatarUrl,
      roomName: input.roomName,
      mode: input.mode,
      autoAccept: input.autoAccept
    });
    if (input.autoAccept) {
      await clearIncomingCallNotifications(input.roomName);
    }
  })();
}
