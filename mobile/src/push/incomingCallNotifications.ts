import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { hideIncomingCallAndroidNotification } from "./incomingCallAndroidNotification";
import { ANDROID_CHANNELS, setupIncomingCallNotificationCategories } from "./pushNotifications";

export type IncomingCallNotificationPayload = {
  callerId: number;
  callerName: string;
  roomName: string;
  mode: "voice" | "video";
  callerAvatarUrl?: string | null;
};

function notificationIdentifier(roomName: string) {
  return `incoming_call:${String(roomName || "").trim()}`;
}

function categoryForMode(mode: "voice" | "video") {
  return mode === "video" ? "INCOMING_VIDEO_CALL" : "INCOMING_VOICE_CALL";
}

export async function displayIncomingCallNotification(payload: IncomingCallNotificationPayload) {
  if (Platform.OS === "web") return null;

  const roomName = String(payload.roomName || "").trim();
  const callerId = Number(payload.callerId);
  if (!roomName || !Number.isFinite(callerId) || callerId <= 0) return null;

  await setupIncomingCallNotificationCategories();

  const mode = payload.mode === "video" ? "video" : "voice";
  const callerName = String(payload.callerName || "Someone").trim() || "Someone";
  const identifier = notificationIdentifier(roomName);

  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // no-op
  }

  return Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: callerName,
      body: mode === "video" ? "Incoming video call" : "Incoming voice call",
      categoryIdentifier: categoryForMode(mode),
      sound: "default",
      sticky: true,
      data: {
        type: "incoming_call",
        mode,
        roomName,
        callerId: String(callerId),
        callerAvatarUrl: String(payload.callerAvatarUrl || "").trim()
      },
      ...(Platform.OS === "android"
        ? {
            channelId: ANDROID_CHANNELS.incomingCalls,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 800, 400, 800, 400, 800]
          }
        : { priority: Notifications.AndroidNotificationPriority.MAX })
    },
    trigger: null
  });
}

export async function dismissIncomingCallNotification(roomName: string) {
  const identifier = notificationIdentifier(roomName);
  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // no-op
  }
}

/** Remove incoming-call alerts from the shade after answer, decline, or connect. */
export async function clearIncomingCallNotifications(roomName?: string | null) {
  if (Platform.OS === "web") return;

  const trimmedRoom = String(roomName || "").trim();
  if (trimmedRoom) {
    await dismissIncomingCallNotification(trimmedRoom);
  }

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const item of presented) {
      const data = (item.request.content.data || {}) as Record<string, unknown>;
      if (String(data.type || "") !== "incoming_call") continue;
      const itemRoom = String(data.roomName || "").trim();
      if (trimmedRoom && itemRoom && itemRoom !== trimmedRoom) continue;
      const identifier = String(item.request.identifier || "").trim();
      if (identifier) {
        await Notifications.dismissNotificationAsync(identifier);
      }
    }
  } catch {
    // no-op
  }

  hideIncomingCallAndroidNotification();
}
