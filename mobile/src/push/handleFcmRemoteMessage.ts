import {
  displayIncomingCallAndroidNotification,
  parseIncomingCallRemoteMessage
} from "./incomingCallAndroidNotification";
import { displayIncomingCallNotification } from "./incomingCallNotifications";
import { displayFcmDataNotification } from "./displayFcmDataNotification";

type FcmRemoteMessage = Parameters<typeof parseIncomingCallRemoteMessage>[0];

export async function handleFcmRemoteMessage(remoteMessage: FcmRemoteMessage | null | undefined) {
  const call = parseIncomingCallRemoteMessage(remoteMessage);
  if (call) {
    try {
      await displayIncomingCallAndroidNotification(call);
    } catch {
      await displayIncomingCallNotification(call);
    }
    return;
  }
  await displayFcmDataNotification(remoteMessage);
}
