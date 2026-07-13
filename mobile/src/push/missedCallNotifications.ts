import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ANDROID_CHANNELS, setupMissedCallNotificationCategory } from "./pushNotifications";

export type MissedCallNotificationPayload = {
  callerId: number;
  callerName: string;
  mode: "voice" | "video";
  callerAvatarUrl?: string | null;
};

function missedCallIdentifier(callerId: number) {
  return `missed_call:${callerId}`;
}

export async function displayMissedCallNotification(payload: MissedCallNotificationPayload) {
  if (Platform.OS === "web") return null;

  const callerId = Number(payload.callerId);
  if (!Number.isFinite(callerId) || callerId <= 0) return null;

  await setupMissedCallNotificationCategory();

  const mode = payload.mode === "video" ? "video" : "voice";
  const callerName = String(payload.callerName || "Someone").trim() || "Someone";
  const body = mode === "video" ? "Missed video call" : "Missed voice call";
  const identifier = missedCallIdentifier(callerId);

  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // no-op
  }

  return Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: callerName,
      body,
      categoryIdentifier: "MISSED_CALL",
      sound: "default",
      data: {
        type: "missed_call",
        mode,
        callerId: String(callerId),
        callerAvatarUrl: String(payload.callerAvatarUrl || "").trim()
      },
      ...(Platform.OS === "android"
        ? {
            channelId: ANDROID_CHANNELS.missedCalls,
            priority: Notifications.AndroidNotificationPriority.HIGH
          }
        : { priority: Notifications.AndroidNotificationPriority.HIGH })
    },
    trigger: null
  });
}

export async function dismissMissedCallNotification(callerId: number) {
  try {
    await Notifications.dismissNotificationAsync(missedCallIdentifier(callerId));
  } catch {
    // no-op
  }
}
