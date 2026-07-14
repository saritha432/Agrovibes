import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ANDROID_CHANNELS, NOTIFICATION_SOUNDS, ensureAndroidChannels, setupDirectMessageNotificationCategory } from "./pushNotifications";

const THREAD_KEY_PREFIX = "cropvibe.dm.notif.thread.v5.";
const AUTH_STORAGE_KEY = "agrovibes.auth";

type ThreadMessage = {
  fromPeer: boolean;
  senderName: string;
  text: string;
};

export function stripSenderPrefix(rawBody: string, actorName: string): string {
  let raw = String(rawBody || "").trim();
  const names = [actorName, "You", "you", "Me", "me"]
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  for (const name of names) {
    const prefix = `${name}:`;
    if (raw.toLowerCase().startsWith(prefix.toLowerCase())) {
      raw = raw.slice(prefix.length).trim();
      break;
    }
  }
  return raw;
}

export function dmNotificationIdentifier(peerUserId: string | number): string {
  return `dm-${String(peerUserId).trim()}`;
}

function threadStorageKey(peerUserId: string | number) {
  return `${THREAD_KEY_PREFIX}${String(peerUserId).trim()}`;
}

export async function resolveSelfDisplayName(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { user?: { fullName?: string; username?: string } } | null;
    return String(parsed?.user?.fullName || parsed?.user?.username || "").trim();
  } catch {
    return "";
  }
}

/** Always "Name: message" so both peer and self names stay visible. */
function renderNamedThreadBody(messages: ThreadMessage[]): string {
  return messages
    .map((msg) => {
      const name = String(msg.senderName || "").trim() || (msg.fromPeer ? "Someone" : "Me");
      const text = String(msg.text || "").trim();
      if (!text) return "";
      return `${name}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

function parseLegacyBody(raw: string, peerName: string, selfName: string): ThreadMessage[] {
  const peer = String(peerName || "").trim().toLowerCase();
  const self = String(selfName || "").trim().toLowerCase();
  const lines = String(raw || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ThreadMessage[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const colon = line.indexOf(":");
    if (colon > 0) {
      const name = line.slice(0, colon).trim();
      const text = line.slice(colon + 1).trim();
      if (!text) continue;
      const nameKey = name.toLowerCase();
      const fromPeer =
        nameKey === "you" || nameKey === "me"
          ? false
          : self && nameKey === self
            ? false
            : peer
              ? nameKey === peer
              : true;
      out.push({
        fromPeer,
        senderName: fromPeer ? peerName || name : selfName || name,
        text
      });
      continue;
    }

    // Older format: name on one line, text on the next
    const next = lines[i + 1];
    const nameKey = line.toLowerCase();
    if (
      next &&
      (nameKey === "you" ||
        nameKey === "me" ||
        (self && nameKey === self) ||
        (peer && nameKey === peer))
    ) {
      const fromPeer = !(nameKey === "you" || nameKey === "me" || (self && nameKey === self));
      out.push({
        fromPeer,
        senderName: fromPeer ? peerName || line : selfName || line,
        text: next
      });
      i += 1;
      continue;
    }

    out.push({
      fromPeer: true,
      senderName: peerName || "Someone",
      text: line
    });
  }
  return out;
}

async function readStoredThread(peerUserId: string | number): Promise<ThreadMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(threadStorageKey(peerUserId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const text = String(row.text || "").trim();
        if (!text) return null;
        return {
          fromPeer: row.fromPeer !== false,
          senderName: String(row.senderName || "").trim(),
          text
        } as ThreadMessage;
      })
      .filter((item): item is ThreadMessage => !!item);
  } catch {
    return [];
  }
}

async function writeStoredThread(peerUserId: string | number, messages: ThreadMessage[]) {
  try {
    await AsyncStorage.setItem(threadStorageKey(peerUserId), JSON.stringify(messages.slice(-8)));
  } catch {
    // no-op
  }
}

function appendUniqueMessage(messages: ThreadMessage[], next: ThreadMessage): ThreadMessage[] {
  const last = messages[messages.length - 1];
  if (
    last &&
    last.fromPeer === next.fromPeer &&
    last.text === next.text &&
    last.senderName === next.senderName
  ) {
    return messages;
  }
  return [...messages, next].slice(-8);
}

export async function dismissDmNotificationsForPeer(
  peerUserId: string | number,
  extraIdentifiers: string[] = []
) {
  const targetId = dmNotificationIdentifier(peerUserId);
  const ids = new Set<string>([
    targetId,
    ...extraIdentifiers.map((id) => String(id || "").trim()).filter(Boolean)
  ]);

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const item of presented) {
      const id = String(item.request.identifier || "").trim();
      const data = (item.request.content.data || {}) as Record<string, unknown>;
      const type = String(data.type || "").trim();
      const actorId = String(data.actorId || data.senderId || data.peerUserId || "").trim();
      if (type === "direct_message" && actorId && actorId === String(peerUserId).trim()) {
        if (id) ids.add(id);
      }
    }
  } catch {
    // continue
  }

  await Promise.all(
    [...ids].map(async (id) => {
      try {
        await Notifications.dismissNotificationAsync(id);
      } catch {
        // no-op
      }
    })
  );
}

/** Clear stored thread + shade card after the user opens/reads this chat. */
export async function clearDmNotificationThread(peerUserId: string | number) {
  const actorId = String(peerUserId || "").trim();
  if (!actorId) return;
  try {
    await AsyncStorage.removeItem(threadStorageKey(actorId));
  } catch {
    // no-op
  }
  await dismissDmNotificationsForPeer(actorId);
}

export async function presentDirectMessageNotification({
  peerUserId,
  peerName,
  senderName,
  messageText,
  fromPeer,
  data,
  previousBody,
  replaceIdentifier
}: {
  peerUserId: string | number;
  peerName: string;
  senderName: string;
  messageText: string;
  fromPeer?: boolean;
  data?: Record<string, unknown>;
  previousBody?: string | null;
  replaceIdentifier?: string | null;
}) {
  const actorId = String(peerUserId).trim();
  if (!actorId) return;

  const conversationTitle = String(peerName || "").trim() || "Someone";
  const storedSelfName = await resolveSelfDisplayName();
  const isFromPeer = fromPeer !== false;
  const displaySender = isFromPeer
    ? conversationTitle
    : String(senderName || "").trim() || storedSelfName || "Me";
  const selfName = storedSelfName || (isFromPeer ? "" : displaySender) || "Me";

  const text = stripSenderPrefix(String(messageText || "").trim(), displaySender);
  if (!text) return;

  let messages = await readStoredThread(actorId);
  if (!messages.length && previousBody) {
    messages = parseLegacyBody(previousBody, conversationTitle, selfName);
  }
  if (!messages.length) {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      const existing =
        presented.find((n) => n.request.identifier === dmNotificationIdentifier(actorId)) ||
        presented.find((n) => {
          const d = (n.request.content.data || {}) as Record<string, unknown>;
          return (
            String(d.type || "") === "direct_message" &&
            String(d.actorId || d.senderId || "").trim() === actorId
          );
        });
      if (existing) {
        messages = parseLegacyBody(
          String(existing.request.content.body || ""),
          conversationTitle,
          selfName
        );
      }
    } catch {
      // ignore
    }
  }

  messages = messages.map((m) =>
    m.fromPeer && !String(m.senderName || "").trim()
      ? { ...m, senderName: conversationTitle }
      : m
  );

  messages = appendUniqueMessage(messages, {
    fromPeer: isFromPeer,
    senderName: displaySender,
    text
  });
  await writeStoredThread(actorId, messages);

  const body = renderNamedThreadBody(messages);
  const identifier = dmNotificationIdentifier(actorId);

  await ensureAndroidChannels();
  await setupDirectMessageNotificationCategory();
  await dismissDmNotificationsForPeer(actorId, replaceIdentifier ? [replaceIdentifier] : []);

  // Small delay so Android treats this as a new alert (heads-up), not an in-place update.
  await new Promise((resolve) => setTimeout(resolve, 60));

  const payloadData = {
    ...(data || {}),
    type: "direct_message",
    categoryId: "DIRECT_MESSAGE",
    actorId,
    peerName: conversationTitle,
    peerUserId: actorId,
    actorName: conversationTitle,
    senderName: displaySender
  };

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: conversationTitle,
      body,
      data: payloadData,
      categoryIdentifier: "DIRECT_MESSAGE",
      sound: NOTIFICATION_SOUNDS.message,
      ...(Platform.OS === "android"
        ? {
            channelId: ANDROID_CHANNELS.directMessages,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 250, 250, 250]
          }
        : {})
    },
    trigger: null
  });
}
