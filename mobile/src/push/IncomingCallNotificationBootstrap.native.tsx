import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import { sendDirectMessage } from "../services/api";
import { navigateToDirectChat } from "../navigation/navigationRef";
import { buildDmCallMessage } from "../screens/messaging/dmMessageFormats";
import { presentIncomingCallFromPush } from "./GlobalIncomingCallHost";
import { handleFcmRemoteMessage } from "./handleFcmRemoteMessage";
import {
  addIncomingCallAnswerListener,
  addIncomingCallEndListener,
  displayIncomingCallAndroidNotification,
  hideIncomingCallAndroidNotification,
  isIncomingCallNotificationModuleReady,
  openIncomingCallApp,
  parseIncomingCallActionPayload,
  parseIncomingCallRemoteMessage,
  removeIncomingCallAnswerListener,
  removeIncomingCallEndListener
} from "./incomingCallAndroidNotification";

const AUTH_STORAGE_KEY = "agrovibes.auth";

function getFirebaseMessaging() {
  try {
    return require("@react-native-firebase/messaging").default as () => {
      onMessage: (handler: (message: Parameters<typeof parseIncomingCallRemoteMessage>[0]) => void) => () => void;
    };
  } catch {
    return null;
  }
}

async function resolveAuthToken(explicit?: string | null) {
  const direct = String(explicit || "").trim();
  if (direct) return direct;
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string } | null;
    return String(parsed?.token || "").trim() || null;
  } catch {
    return null;
  }
}

async function declineIncomingCall(
  callerId: number,
  mode: "voice" | "video",
  authToken?: string | null
) {
  if (!callerId) return;
  const token = await resolveAuthToken(authToken);
  if (!token) return;
  try {
    await sendDirectMessage(
      token,
      callerId,
      buildDmCallMessage({
        mode,
        status: "declined",
        durationSec: 0,
        direction: "incoming"
      })
    );
  } catch {
    // no-op
  }
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
      hideIncomingCallAndroidNotification();
      const parsed = parseIncomingCallActionPayload(data.payload);
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
        void declineIncomingCall(parsed.callerId, parsed.mode, tokenRef.current);
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
