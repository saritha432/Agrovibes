import AsyncStorage from "@react-native-async-storage/async-storage";
import { cancelDirectCall, sendDirectMessage } from "../services/api";
import { buildDmCallMessage } from "../screens/messaging/dmMessageFormats";
import { clearIncomingCall } from "./incomingCallBridge";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";
import { displayMissedCallNotification } from "./missedCallNotifications";

const AUTH_STORAGE_KEY = "agrovibes.auth";

/** Prevent double Decline (notification listener + cold-start last response). */
const recentDeclineKeys = new Map<string, number>();
const DECLINE_DEDUPE_MS = 8000;

function shouldSkipDuplicateDecline(key: string) {
  const now = Date.now();
  for (const [k, at] of recentDeclineKeys) {
    if (now - at > DECLINE_DEDUPE_MS) recentDeclineKeys.delete(k);
  }
  const prev = recentDeclineKeys.get(key);
  if (prev && now - prev < DECLINE_DEDUPE_MS) return true;
  recentDeclineKeys.set(key, now);
  return false;
}

async function resolveAuthToken(explicit?: string | null) {
  const direct = String(explicit || "").trim();
  if (direct) return direct;
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string } | null;
    return String(parsed?.token || "").trim() || null;
  } catch {
    return null;
  }
}

export async function completeIncomingCallDecline(input: {
  callerId: number;
  callerName: string;
  mode: "voice" | "video";
  roomName?: string;
  callerAvatarUrl?: string | null;
  authToken?: string | null;
  /** Timeout / auto-hide should be missed, not declined. */
  status?: "declined" | "missed";
}) {
  const callerId = Number(input.callerId);
  if (!Number.isFinite(callerId) || callerId <= 0) return;

  const roomName = String(input.roomName || "").trim();
  const mode = input.mode === "video" ? "video" : "voice";
  const status = input.status === "missed" ? "missed" : "declined";
  const dedupeKey = `${callerId}:${roomName || "_"}:${status}`;
  if (shouldSkipDuplicateDecline(dedupeKey)) {
    await clearIncomingCallNotifications(roomName || undefined);
    clearIncomingCall();
    return;
  }

  // Dismiss shade + native full-screen UI and close in-app incoming modal.
  await clearIncomingCallNotifications(roomName || undefined);
  clearIncomingCall();

  const callerName = String(input.callerName || "Someone").trim() || "Someone";
  const authToken = await resolveAuthToken(input.authToken);

  if (authToken) {
    if (roomName) {
      try {
        // Stop caller ringing immediately.
        await cancelDirectCall(authToken, {
          peerUserId: callerId,
          roomName,
          mode
        });
      } catch {
        // Continue and still send call-state message below.
      }
    }
    try {
      await sendDirectMessage(
        authToken,
        callerId,
        buildDmCallMessage({
          mode,
          status,
          durationSec: 0,
          direction: "incoming"
        })
      );
    } catch {
      // no-op
    }
  }

  await displayMissedCallNotification({
    callerId,
    callerName,
    mode,
    callerAvatarUrl: input.callerAvatarUrl
  });
}
