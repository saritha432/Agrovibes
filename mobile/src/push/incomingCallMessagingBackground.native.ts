import {
  displayIncomingCallAndroidNotification,
  parseIncomingCallRemoteMessage
} from "./incomingCallAndroidNotification";
import { displayFcmDataNotification } from "./displayFcmDataNotification";

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
    messaging().setBackgroundMessageHandler(
      async (remoteMessage: Parameters<typeof parseIncomingCallRemoteMessage>[0]) => {
        const call = parseIncomingCallRemoteMessage(remoteMessage);
        if (call) {
          await displayIncomingCallAndroidNotification(call);
          return;
        }
        await displayFcmDataNotification(remoteMessage);
      }
    );
  } catch {
    // Native Firebase Messaging is unavailable until the dev client is rebuilt.
  }
}
