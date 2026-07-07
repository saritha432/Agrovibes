import { handleFcmRemoteMessage } from "./handleFcmRemoteMessage";

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
