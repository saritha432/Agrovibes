import {
  displayIncomingCallAndroidNotification,
  parseIncomingCallRemoteMessage
} from "./incomingCallAndroidNotification";
import { displayIncomingCallNotification } from "./incomingCallNotifications";
import { displayFcmDataNotification } from "./displayFcmDataNotification";
import { presentIncomingCallFromPush } from "./GlobalIncomingCallHost";
import { ensureIncomingCallCategoriesReady } from "./pushNotifications";
import { AppState } from "react-native";

type FcmRemoteMessage = Parameters<typeof parseIncomingCallRemoteMessage>[0];

export async function handleFcmRemoteMessage(remoteMessage: FcmRemoteMessage | null | undefined) {
  const call = parseIncomingCallRemoteMessage(remoteMessage);
  if (call) {
    await ensureIncomingCallCategoriesReady();
    if (AppState.currentState === "active") {
      presentIncomingCallFromPush(call);
      return;
    }
    try {
      await displayIncomingCallAndroidNotification(call);
    } catch {
      await displayIncomingCallNotification(call);
    }
    return;
  }
  await displayFcmDataNotification(remoteMessage);
}
