import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureAndroidChannels, setupDirectMessageNotificationCategory } from "./pushNotifications";

type FcmRemoteMessage = {
  data?: Record<string, unknown>;
  notification?: { title?: string; body?: string };
};

export async function displayFcmDataNotification(remoteMessage: FcmRemoteMessage | null | undefined) {
  const data = remoteMessage?.data || {};
  const type = String(data.type || "").trim();
  const isDirectMessage = type === "direct_message";

  // System FCM notification payloads cannot show Expo action buttons (Reply / Answer).
  if (remoteMessage?.notification && !isDirectMessage) return;

  const title = String(data.title || remoteMessage?.notification?.title || "").trim();
  const body = String(data.message || data.body || remoteMessage?.notification?.body || "").trim();
  if (!title && !body) return;

  await ensureAndroidChannels();
  if (isDirectMessage) {
    await setupDirectMessageNotificationCategory();
  }

  const channelId = isDirectMessage
    ? "direct_messages"
    : String(data.channelId || "default").trim() || "default";
  const categoryId = isDirectMessage
    ? "DIRECT_MESSAGE"
    : String(data.categoryId || "").trim() || undefined;
  const priority =
    channelId === "incoming_calls"
      ? Notifications.AndroidNotificationPriority.MAX
      : Notifications.AndroidNotificationPriority.HIGH;

  const actorId = String(data.actorId || "").trim();
  const identifier = isDirectMessage && actorId ? `dm-${actorId}` : undefined;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: title || "Cropvibe",
      body: body || "New message",
      data: { ...data, type: type || "direct_message", categoryId },
      categoryIdentifier: categoryId,
      sound: "default",
      ...(Platform.OS === "android" ? { channelId, priority } : {})
    },
    trigger: null
  });
}
