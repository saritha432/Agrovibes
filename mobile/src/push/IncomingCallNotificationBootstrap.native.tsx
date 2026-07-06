import React from "react";
import { useAuth } from "../auth/AuthContext";
import { navigateToDirectChat } from "../navigation/navigationRef";
import { presentIncomingCallFromPush } from "./GlobalIncomingCallHost";
import { handleFcmRemoteMessage } from "./handleFcmRemoteMessage";
import { completeIncomingCallDecline } from "./incomingCallDecline";
import {
  addIncomingCallAnswerListener,
  addIncomingCallEndListener,
  hideIncomingCallAndroidNotification,
  isIncomingCallNotificationModuleReady,
  openIncomingCallApp,
  parseIncomingCallActionPayload,
  parseIncomingCallRemoteMessage,
  removeIncomingCallAnswerListener,
  removeIncomingCallEndListener
} from "./incomingCallAndroidNotification";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";

function getFirebaseMessaging() {
  try {
    return require("@react-native-firebase/messaging").default as () => {
      onMessage: (handler: (message: Parameters<typeof parseIncomingCallRemoteMessage>[0]) => void) => () => void;
    };
  } catch {
    return null;
  }
}

async function declineIncomingCall(
  parsed: {
    callerId: number;
    callerName: string;
    mode: "voice" | "video";
    roomName: string;
    callerAvatarUrl?: string | null;
  },
  authToken?: string | null
) {
  await completeIncomingCallDecline({
    callerId: parsed.callerId,
    callerName: parsed.callerName,
    mode: parsed.mode,
    roomName: parsed.roomName,
    callerAvatarUrl: parsed.callerAvatarUrl,
    authToken
  });
}

export function IncomingCallNotificationBootstrap() {
  const { token } = useAuth();
  const tokenRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  React.useEffect(() => {
    const showFromMessage = async (remoteMessage: Parameters<typeof parseIncomingCallRemoteMessage>[0]) => {
      await handleFcmRemoteMessage(remoteMessage);
    };

    let foregroundSub: (() => void) | null = null;
    const messagingFactory = getFirebaseMessaging();
    if (messagingFactory) {
      try {
        foregroundSub = messagingFactory().onMessage(async (remoteMessage) => {
          await showFromMessage(remoteMessage);
        });
      } catch {
        // Firebase Messaging unavailable until native rebuild.
      }
    }

    if (!isIncomingCallNotificationModuleReady()) {
      return () => {
        foregroundSub?.();
      };
    }

    const onAnswer = (data: { payload?: string }) => {
      const parsed = parseIncomingCallActionPayload(data.payload);
      if (parsed?.roomName) {
        void clearIncomingCallNotifications(parsed.roomName);
      } else {
        hideIncomingCallAndroidNotification();
      }
      if (!parsed?.callerId) {
        openIncomingCallApp();
        return;
      }

      presentIncomingCallFromPush({
        callerId: parsed.callerId,
        callerName: parsed.callerName,
        roomName: parsed.roomName,
        mode: parsed.mode,
        callerAvatarUrl: parsed.callerAvatarUrl,
        autoAccept: true
      });
      openIncomingCallApp();
      navigateToDirectChat({
        peerUserId: parsed.callerId,
        peerName: parsed.callerName,
        peerAvatarUrl: parsed.callerAvatarUrl || undefined
      });
    };

    const onEndCall = (data: { endAction?: string; payload?: string }) => {
      hideIncomingCallAndroidNotification();
      const parsed = parseIncomingCallActionPayload(data.payload);
      if (!parsed?.callerId) return;

      if (data.endAction === "ACTION_REJECTED_CALL" || data.endAction === "ACTION_HIDE_CALL") {
        void declineIncomingCall(parsed, tokenRef.current);
      }
    };

    addIncomingCallAnswerListener(onAnswer);
    addIncomingCallEndListener(onEndCall);

    return () => {
      foregroundSub?.();
      removeIncomingCallAnswerListener();
      removeIncomingCallEndListener();
    };
  }, []);

  return null;
}
