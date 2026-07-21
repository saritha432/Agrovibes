import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCallRingingStatus } from "../services/api";
import { isCallRoomEnded, markCallRoomEnded } from "./cancelledCallRooms";

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

/** Returns false when the room is known ended or the server says it is no longer ringing. */
export async function verifyCallStillRinging(roomName: string, authToken?: string | null) {
  const room = String(roomName || "").trim();
  if (!room) return false;
  if (isCallRoomEnded(room)) return false;

  const token = await resolveAuthToken(authToken);
  if (!token) return true;

  try {
    const { ringing } = await fetchCallRingingStatus(token, room);
    if (!ringing) {
      markCallRoomEnded(room);
      return false;
    }
    return true;
  } catch {
    // Offline / API error — allow UI so a valid call is not blocked.
    return true;
  }
}
