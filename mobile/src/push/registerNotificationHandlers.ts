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

function isDeclineAction(actionId: string) {
  return actionId === "DECLINE" || actionId.endsWith(":DECLINE") || actionId.endsWith(".DECLINE");
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

/** Register early so inline notification replies work while app is backgrounded. */
export function registerNotificationResponseHandler() {
  if (registered) return;
  registered = true;
  Notifications.addNotificationResponseReceivedListener((response) => {
    if (!claimNotificationResponse(response)) return;
    void (async () => {
      await handleNotificationResponse(response);
      // Avoid re-running Decline/Accept when app is opened later.
      await clearLastResponseSafe();
    })();
  });
}

/**
 * Cold-start only: process last response if the early listener did not.
 * Skip Decline — that path is handled by the early listener (opensAppToForeground: false).
 */
export async function handleColdStartNotificationResponse(options?: { authToken?: string | null }) {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;
  if (isDeclineAction(String(response.actionIdentifier || ""))) {
    claimNotificationResponse(response);
    await clearLastResponseSafe();
    return;
  }
  if (!claimNotificationResponse(response)) return;
  await handleNotificationResponse(response, options);
  await clearLastResponseSafe();
}
