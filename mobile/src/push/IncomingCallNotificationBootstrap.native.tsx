import React from "react";
import { handleFcmRemoteMessage } from "./handleFcmRemoteMessage";
import { parseIncomingCallRemoteMessage } from "./incomingCallAndroidNotification";

function getFirebaseMessaging() {
  try {
    return require("@react-native-firebase/messaging").default as () => {
      onMessage: (handler: (message: Parameters<typeof parseIncomingCallRemoteMessage>[0]) => void) => () => void;
    };
  } catch {
    return null;
  }
}

/** Foreground FCM listener only — native answer/decline handlers register in index.js. */
export function IncomingCallNotificationBootstrap() {
  React.useEffect(() => {
    const messagingFactory = getFirebaseMessaging();
    if (!messagingFactory) return;

    let foregroundSub: (() => void) | null = null;
    try {
      foregroundSub = messagingFactory().onMessage(async (remoteMessage) => {
        await handleFcmRemoteMessage(remoteMessage);
      });
    } catch {
      // Firebase Messaging unavailable until native rebuild.
    }

    return () => {
      foregroundSub?.();
    };
  }, []);

  return null;
}
