import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureAndroidChannels } from "./pushNotifications";

type FcmRemoteMessage = {
  data?: Record<string, unknown>;
  notification?: { title?: string; body?: string };
};

export async function displayFcmDataNotification(remoteMessage: FcmRemoteMessage | null | undefined) {
  const data = remoteMessage?.data || {};
  const type = String(data.type || "").trim();
  // System FCM notification payloads cannot show Expo action buttons (Reply / Answer).
  // For DMs, always re-post through Expo when we have category metadata.
  if (remoteMessage?.notification && type !== "direct_message") return;

  const title = String(data.title || remoteMessage?.notification?.title || "").trim();
  const body = String(data.message || data.body || remoteMessage?.notification?.body || "").trim();
  if (!title && !body) return;

  await ensureAndroidChannels();

  const channelId = String(data.channelId || "default").trim() || "default";
  const categoryId = String(data.categoryId || "").trim() || undefined;
  const priority =
    channelId === "incoming_calls"
      ? Notifications.AndroidNotificationPriority.MAX
      : Notifications.AndroidNotificationPriority.HIGH;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: title || "Cropvibe",
      body: body || "New message",
      data,
      categoryIdentifier: categoryId,
      sound: "default",
      ...(Platform.OS === "android" ? { channelId, priority } : {})
    },
    trigger: null
  });
}
