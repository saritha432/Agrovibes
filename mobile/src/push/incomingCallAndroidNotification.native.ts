import { AppState, NativeModules, Platform } from "react-native";
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { displayIncomingCallNotification } from "./incomingCallNotifications";
import type { IncomingCallNotificationPayload } from "./incomingCallNotifications";

const CALL_CHANNEL_ID = "incoming_calls";
const CALL_TIMEOUT_MS = 45_000;

export type ParsedIncomingCallPush = IncomingCallNotificationPayload;

type CallNotificationModule = {
  displayNotification: (
    uuid: string,
    avatar: string | null,
    timeout: number | null,
    options: Record<string, unknown>
  ) => void;
  hideNotification: () => void;
  addEventListener: (event: "answer" | "endCall", handler: (data: Record<string, unknown>) => void) => void;
  removeEventListener: (event: "answer" | "endCall") => void;
  backToApp: () => void;
};

let callModule: CallNotificationModule | null = null;

function hasLinkedCallNotificationNativeModule() {
  return Platform.OS === "android" && !!NativeModules.FullScreenNotificationIncomingCall;
}

function getCallNotificationModule(): CallNotificationModule | null {
  if (!hasLinkedCallNotificationNativeModule()) return null;
  if (callModule) return callModule;
  try {
    // Only load JS when native is linked — the package throws on method calls otherwise.
    callModule = require("react-native-full-screen-notification-incoming-call").default as CallNotificationModule;
  } catch {
    callModule = null;
  }
  return callModule;
}

export function isIncomingCallNotificationModuleReady() {
  return hasLinkedCallNotificationNativeModule();
}

function callPayloadJson(payload: IncomingCallNotificationPayload) {
  return JSON.stringify({
    callerId: payload.callerId,
    callerName: payload.callerName,
    roomName: payload.roomName,
    mode: payload.mode,
    callerAvatarUrl: payload.callerAvatarUrl || ""
  });
}

export function parseIncomingCallRemoteMessage(
  message: FirebaseMessagingTypes.RemoteMessage | null | undefined
): ParsedIncomingCallPush | null {
  const data = message?.data || {};
  if (String(data.type || "") !== "incoming_call") return null;

  const callerId = Number(data.callerId);
  const roomName = String(data.roomName || "").trim();
  if (!Number.isFinite(callerId) || callerId <= 0 || !roomName) return null;

  const mode = String(data.mode || "voice") === "video" ? "video" : "voice";
  const callerName = String(data.callerName || data.title || "Someone").trim() || "Someone";
  const callerAvatarUrl = String(data.callerAvatarUrl || "").trim() || null;

  return {
    callerId,
    callerName,
    roomName,
    mode,
    callerAvatarUrl
  };
}

export async function displayIncomingCallAndroidNotification(payload: ParsedIncomingCallPush) {
  const isForeground = AppState.currentState === "active";
  const isVideo = payload.mode === "video";
  const avatar = String(payload.callerAvatarUrl || "").trim();

  // Foreground calls use the in-app overlay (presentIncomingCallFromPush).
  if (isForeground) return;

  // Expo notifications work reliably from FCM background/killed handlers.
  await displayIncomingCallNotification(payload);

  const module = getCallNotificationModule();
  if (!module) return;

  try {
    module.displayNotification(payload.roomName, avatar || null, CALL_TIMEOUT_MS, {
      channelId: CALL_CHANNEL_ID,
      channelName: "Calls",
      notificationIcon: "ic_launcher",
      notificationTitle: payload.callerName,
      notificationBody: isVideo ? "Incoming video call" : "Incoming voice call",
      answerText: isVideo ? "Video" : "Answer",
      declineText: "Decline",
      isVideo,
      payload: callPayloadJson(payload)
    });
  } catch {
    // Expo notification already shown above.
  }
}

export function hideIncomingCallAndroidNotification() {
  const module = getCallNotificationModule();
  if (!module) return;
  module.hideNotification();
}

export function parseIncomingCallActionPayload(payload?: string | null): ParsedIncomingCallPush | null {
  const raw = String(payload || "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const callerId = Number(parsed.callerId);
    const roomName = String(parsed.roomName || "").trim();
    if (!Number.isFinite(callerId) || callerId <= 0 || !roomName) return null;
    const mode = String(parsed.mode || "voice") === "video" ? "video" : "voice";
    const callerName = String(parsed.callerName || "Someone").trim() || "Someone";
    const callerAvatarUrl = String(parsed.callerAvatarUrl || "").trim() || null;
    return { callerId, callerName, roomName, mode, callerAvatarUrl };
  } catch {
    return null;
  }
}

export function addIncomingCallAnswerListener(handler: (data: { payload?: string }) => void) {
  getCallNotificationModule()?.addEventListener("answer", handler);
}

export function addIncomingCallEndListener(handler: (data: { endAction?: string; payload?: string }) => void) {
  getCallNotificationModule()?.addEventListener("endCall", handler);
}

export function removeIncomingCallAnswerListener() {
  getCallNotificationModule()?.removeEventListener("answer");
}

export function removeIncomingCallEndListener() {
  getCallNotificationModule()?.removeEventListener("endCall");
}

export function openIncomingCallApp() {
  const module = getCallNotificationModule();
  if (!module) return;
  module.backToApp();
}
