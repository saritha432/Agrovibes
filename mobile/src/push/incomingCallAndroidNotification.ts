import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import type { IncomingCallNotificationPayload } from "./incomingCallNotifications";

export type ParsedIncomingCallPush = IncomingCallNotificationPayload;

export function isIncomingCallNotificationModuleReady() {
  return false;
}

export function parseIncomingCallRemoteMessage(
  _message?: FirebaseMessagingTypes.RemoteMessage | null
): ParsedIncomingCallPush | null {
  return null;
}

export function displayIncomingCallAndroidNotification(_payload: ParsedIncomingCallPush) {
  // Android-only CallStyle notifications.
}

export function hideIncomingCallAndroidNotification() {
  // no-op
}

export function parseIncomingCallActionPayload(
  _payload?: string | Record<string, unknown> | null
): ParsedIncomingCallPush | null {
  return null;
}

export function addIncomingCallAnswerListener(_handler: (data: { payload?: string }) => void) {
  // no-op
}

export function addIncomingCallEndListener(_handler: (data: { endAction?: string; payload?: string }) => void) {
  // no-op
}

export function removeIncomingCallAnswerListener() {
  // no-op
}

export function removeIncomingCallEndListener() {
  // no-op
}

export function openIncomingCallApp() {
  // no-op
}
