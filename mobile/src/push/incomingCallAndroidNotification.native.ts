import { AppState, NativeModules, Platform } from "react-native";
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { displayIncomingCallNotification } from "./incomingCallNotifications";
import type { IncomingCallNotificationPayload } from "./incomingCallNotifications";
import { ANDROID_CHANNELS } from "./pushNotifications";

const CALL_CHANNEL_ID = ANDROID_CHANNELS.incomingCalls;
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

function callPayloadMap(payload: IncomingCallNotificationPayload) {
  return {
    callerId: String(payload.callerId),
    callerName: payload.callerName,
    roomName: payload.roomName,
    mode: payload.mode,
    callerAvatarUrl: payload.callerAvatarUrl || ""
  };
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
  if (AppState.currentState === "active") return;

  // Expo notification actions (Answer/Decline) are reliable when the app is killed or backgrounded.
  await displayIncomingCallNotification(payload);

  const isVideo = payload.mode === "video";
  const avatar = String(payload.callerAvatarUrl || "").trim();
  const nativeOptions = {
    channelId: CALL_CHANNEL_ID,
    channelName: "Calls",
    notificationIcon: "ic_launcher",
    notificationTitle: payload.callerName,
    notificationBody: isVideo ? "Incoming video call" : "Incoming voice call",
    answerText: "Answer",
    declineText: "Decline",
    notificationColor: "cropvibe_call_accent",
    notificationSound: "incoming_ring",
    isVideo,
    payload: callPayloadMap(payload)
  };

  const module = getCallNotificationModule();
  if (!module) return;

  try {
    module.displayNotification(payload.roomName, avatar || null, CALL_TIMEOUT_MS, nativeOptions);
  } catch {
    // Expo notification above still handles answer/decline.
  }
}

export function hideIncomingCallAndroidNotification() {
  const module = getCallNotificationModule();
  if (!module) return;
  try {
    module.hideNotification();
  } catch {
    // no-op
  }
}

export function parseIncomingCallActionPayload(payload?: string | Record<string, unknown> | null): ParsedIncomingCallPush | null {
  if (payload && typeof payload === "object") {
    const callerId = Number((payload as Record<string, unknown>).callerId);
    const roomName = String((payload as Record<string, unknown>).roomName || "").trim();
    if (!Number.isFinite(callerId) || callerId <= 0 || !roomName) return null;
    const mode = String((payload as Record<string, unknown>).mode || "voice") === "video" ? "video" : "voice";
    const callerName = String((payload as Record<string, unknown>).callerName || "Someone").trim() || "Someone";
    const callerAvatarUrl = String((payload as Record<string, unknown>).callerAvatarUrl || "").trim() || null;
    return { callerId, callerName, roomName, mode, callerAvatarUrl };
  }
  const raw = String(payload || "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parseIncomingCallActionPayload(parsed);
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
