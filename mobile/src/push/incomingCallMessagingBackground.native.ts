import { handleFcmRemoteMessage } from "./handleFcmRemoteMessage";
import { presentIncomingCallFromPush } from "./GlobalIncomingCallHost";
import { completeIncomingCallDecline } from "./incomingCallDecline";
import {
  addIncomingCallAnswerListener,
  addIncomingCallEndListener,
  hideIncomingCallAndroidNotification,
  isIncomingCallNotificationModuleReady,
  openIncomingCallApp,
  parseIncomingCallActionPayload
} from "./incomingCallAndroidNotification";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";

function hasFirebaseMessagingNativeModule() {
  try {
    const messaging = require("@react-native-firebase/messaging").default;
    return typeof messaging === "function";
  } catch {
    return false;
  }
}

export function registerIncomingCallMessagingBackground() {
  if (!hasFirebaseMessagingNativeModule()) return;
  try {
    const messaging = require("@react-native-firebase/messaging").default;
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      await handleFcmRemoteMessage(remoteMessage);
    });
  } catch {
    // Native Firebase Messaging is unavailable until the dev client is rebuilt.
  }
}

let nativeCallHandlersRegistered = false;

/** Register before React mounts so decline/answer work when the app was killed. */
export function registerIncomingCallNativeActionHandlers() {
  if (nativeCallHandlersRegistered || !isIncomingCallNotificationModuleReady()) {
    return;
  }
  nativeCallHandlersRegistered = true;

  addIncomingCallAnswerListener((data) => {
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
  });

  addIncomingCallEndListener((data) => {
    hideIncomingCallAndroidNotification();
    const parsed = parseIncomingCallActionPayload(data.payload);
    if (!parsed?.callerId) return;

    if (data.endAction === "ACTION_REJECTED_CALL") {
      void completeIncomingCallDecline({
        callerId: parsed.callerId,
        callerName: parsed.callerName,
        mode: parsed.mode,
        roomName: parsed.roomName,
        callerAvatarUrl: parsed.callerAvatarUrl
      });
      return;
    }

    if (data.endAction === "ACTION_HIDE_CALL") {
      void completeIncomingCallDecline({
        callerId: parsed.callerId,
        callerName: parsed.callerName,
        mode: parsed.mode,
        roomName: parsed.roomName,
        callerAvatarUrl: parsed.callerAvatarUrl,
        status: "missed"
      });
    }
  });
}
