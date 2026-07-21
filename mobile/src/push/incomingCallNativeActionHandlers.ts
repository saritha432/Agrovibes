import { Platform } from "react-native";
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

let registered = false;

/** Register before React mounts so decline/answer work when the app was killed. */
export function registerIncomingCallNativeActionHandlers() {
  if (registered || Platform.OS !== "android" || !isIncomingCallNotificationModuleReady()) {
    return;
  }
  registered = true;

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
