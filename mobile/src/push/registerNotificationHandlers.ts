import * as Notifications from "expo-notifications";
import { handleNotificationResponse } from "./notificationNavigation";

let registered = false;
let lastHandledResponseKey = "";

function responseDedupeKey(response: Notifications.NotificationResponse) {
  const id = String(response.notification.request.identifier || "").trim();
  const action = String(response.actionIdentifier || "");
  const date = String(response.notification.date || "");
  return `${id}|${action}|${date}`;
}

/** Returns true once per unique notification response; false if already handled. */
export function claimNotificationResponse(response: Notifications.NotificationResponse) {
  const key = responseDedupeKey(response);
  if (!key) return true;
  if (key === lastHandledResponseKey) return false;
  lastHandledResponseKey = key;
  return true;
}

async function clearLastResponseSafe() {
  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch {
    // Older native builds may not support clear.
  }
}

function isUsableNotificationResponse(response: Notifications.NotificationResponse | null | undefined) {
  if (!response?.notification?.request?.content) return false;
  return Boolean(String(response.actionIdentifier || "").trim());
}

/** Register early so inline notification replies work while app is backgrounded. */
export function registerNotificationResponseHandler() {
  if (registered) return;
  registered = true;
  Notifications.addNotificationResponseReceivedListener((response) => {
    if (!isUsableNotificationResponse(response)) return;
    if (!claimNotificationResponse(response)) return;
    void (async () => {
      await handleNotificationResponse(response);
      // Avoid re-running Decline/Accept when app is opened later.
      await clearLastResponseSafe();
    })();
  });
}

/**
 * Cold-start: process the last notification action if the background listener did not.
 */
export async function handleColdStartNotificationResponse(options?: { authToken?: string | null }) {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!isUsableNotificationResponse(response)) return;
  if (!claimNotificationResponse(response)) {
    await clearLastResponseSafe();
    return;
  }
  await handleNotificationResponse(response, options);
  await clearLastResponseSafe();
}
