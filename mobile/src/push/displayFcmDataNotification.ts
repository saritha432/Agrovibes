import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureAndroidChannels } from "./pushNotifications";

type FcmRemoteMessage = {
  data?: Record<string, unknown>;
};

export async function displayFcmDataNotification(remoteMessage: FcmRemoteMessage | null | undefined) {
  const data = remoteMessage?.data || {};
  const title = String(data.title || "").trim();
  const body = String(data.message || data.body || "").trim();
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
