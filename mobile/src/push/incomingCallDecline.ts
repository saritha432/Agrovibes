import AsyncStorage from "@react-native-async-storage/async-storage";
import { cancelDirectCall, sendDirectMessage } from "../services/api";
import { buildDmCallMessage } from "../screens/messaging/dmMessageFormats";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";
import { displayMissedCallNotification } from "./missedCallNotifications";

const AUTH_STORAGE_KEY = "agrovibes.auth";

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
}) {
  const callerId = Number(input.callerId);
  if (!Number.isFinite(callerId) || callerId <= 0) return;

  const roomName = String(input.roomName || "").trim();
  await clearIncomingCallNotifications(roomName || undefined);

  const mode = input.mode === "video" ? "video" : "voice";
  const callerName = String(input.callerName || "Someone").trim() || "Someone";
  const authToken = await resolveAuthToken(input.authToken);

  if (authToken) {
    if (roomName) {
      try {
        // Ensure caller-side ringing push is cancelled immediately.
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
          status: "declined",
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
