import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureAndroidChannels, setupDirectMessageNotificationCategory } from "./pushNotifications";

export function stripSenderPrefix(rawBody: string, actorName: string): string {
  const raw = String(rawBody || "").trim();
  const name = String(actorName || "").trim();
  if (!name) return raw;
  const prefix = `${name}:`;
  if (raw.toLowerCase().startsWith(prefix.toLowerCase())) {
    return raw.slice(prefix.length).trim();
  }
  return raw;
}

export function dmNotificationIdentifier(peerUserId: string | number): string {
  return `dm-${peerUserId}`;
}

export async function mergeDmNotificationBody(identifier: string, newLine: string): Promise<string> {
  const line = String(newLine || "").trim();
  if (!line) return "";

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const existing = presented.find((n) => n.request.identifier === identifier);
    const prev = String(existing?.request.content.body || "").trim();
    if (!prev) return line;
    if (prev === line || prev.endsWith(`\n${line}`) || prev.includes(`\n${line}\n`)) {
      return prev;
    }
    return `${prev}\n${line}`;
  } catch {
    return line;
  }
}

export async function presentDirectMessageNotification({
  peerUserId,
  peerName,
  senderName,
  messageText,
  data
}: {
  peerUserId: string | number;
  peerName: string;
  senderName: string;
  messageText: string;
  data?: Record<string, unknown>;
}) {
  const actorId = String(peerUserId).trim();
  if (!actorId) return;

  const sender = String(senderName || peerName || "").trim() || "Someone";
  const text = stripSenderPrefix(String(messageText || "").trim(), sender);
  const line = text ? `${sender}: ${text}` : sender;
  const identifier = dmNotificationIdentifier(actorId);
  const body = await mergeDmNotificationBody(identifier, line);
  const conversationTitle = String(peerName || sender).trim() || sender;

  await ensureAndroidChannels();
  await setupDirectMessageNotificationCategory();

  const payloadData = {
    ...(data || {}),
    type: "direct_message",
    categoryId: "DIRECT_MESSAGE",
    actorId,
    actorName: sender,
    senderName: sender,
    peerName: conversationTitle
  };

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: conversationTitle,
      body,
      data: payloadData,
      categoryIdentifier: "DIRECT_MESSAGE",
      sound: "default",
      ...(Platform.OS === "android"
        ? {
            channelId: "direct_messages",
            priority: Notifications.AndroidNotificationPriority.HIGH
          }
        : {})
    },
    trigger: null
  });
}
