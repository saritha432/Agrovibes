import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { hideIncomingCallAndroidNotification } from "./incomingCallAndroidNotification";
import { clearIncomingCall, getPendingIncomingCall } from "./incomingCallBridge";
import { isCallRoomEnded, markCallRoomEnded } from "./cancelledCallRooms";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";
import { verifyCallStillRinging } from "./verifyCallRinging";

/** Dismiss incoming-call UI/notifications when the caller already ended the ring. */
export async function dismissStaleIncomingCallNotifications(authToken?: string | null) {
  if (Platform.OS === "web") return;

  const pending = getPendingIncomingCall();
  if (pending?.roomName) {
    const stillRinging = await verifyCallStillRinging(pending.roomName, authToken);
    if (!stillRinging) {
      markCallRoomEnded(pending.roomName);
      await clearIncomingCallNotifications(pending.roomName);
      hideIncomingCallAndroidNotification();
      clearIncomingCall();
    }
  }

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const item of presented) {
      const data = (item.request.content.data || {}) as Record<string, unknown>;
      if (String(data.type || "") !== "incoming_call") continue;
      const roomName = String(data.roomName || "").trim();
      if (!roomName) continue;
      if (isCallRoomEnded(roomName)) {
        await clearIncomingCallNotifications(roomName);
        continue;
      }
      const stillRinging = await verifyCallStillRinging(roomName, authToken);
      if (!stillRinging) {
        markCallRoomEnded(roomName);
        await clearIncomingCallNotifications(roomName);
      }
    }
  } catch {
    // no-op
  }

  hideIncomingCallAndroidNotification();
}
