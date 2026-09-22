import AsyncStorage from "@react-native-async-storage/async-storage";
import { markDirectMessagesDelivered } from "../services/api";

const AUTH_STORAGE_KEY = "agrovibes.auth";

async function readStoredAuthToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    const token = String(parsed?.token || "").trim();
    return token || null;
  } catch {
    return null;
  }
}

/** Tell the server this device received DM(s) so the sender gets double ticks. */
export async function reportDmDeliveredOnDevice(opts?: {
  token?: string | null;
  messageId?: number | string | null;
  messageIds?: Array<number | string> | null;
}) {
  const token = String(opts?.token || "").trim() || (await readStoredAuthToken());
  if (!token) return;
  const ids = [
    ...(Array.isArray(opts?.messageIds) ? opts!.messageIds! : []),
    ...(opts?.messageId != null ? [opts.messageId] : [])
  ]
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  try {
    await markDirectMessagesDelivered(token, ids.length ? ids : undefined);
  } catch {
    // Best-effort; ticks can still update when chat opens.
  }
}
