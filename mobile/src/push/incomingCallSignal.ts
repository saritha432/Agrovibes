import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { hideIncomingCallAndroidNotification } from "./incomingCallAndroidNotification";
import { clearIncomingCall, getPendingIncomingCall } from "./incomingCallBridge";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";
import { isCalleeRingCancelledSignal } from "../screens/messaging/dmMessageFormats";
import type { DirectMessageItem } from "../services/api";

export type CallCancelledPush = {
  roomName: string;
  callerId?: number;
};

export function parseCallCancelledRemoteMessage(
  message: FirebaseMessagingTypes.RemoteMessage | null | undefined
): CallCancelledPush | null {
  const data = message?.data || {};
  if (String(data.type || "") !== "call_cancelled") return null;
  const roomName = String(data.roomName || "").trim();
  if (!roomName) return null;
  const callerId = Number(data.callerId);
  return {
    roomName,
    callerId: Number.isFinite(callerId) && callerId > 0 ? callerId : undefined
  };
}

export async function dismissIncomingCallRinging(input?: CallCancelledPush) {
  const pending = getPendingIncomingCall();
  const roomName = String(input?.roomName || pending?.roomName || "").trim() || undefined;
  const callerId = input?.callerId;

  if (pending && callerId && pending.callerId !== callerId) return;

  if (roomName) {
    await clearIncomingCallNotifications(roomName);
  } else {
    await clearIncomingCallNotifications(null);
  }
  hideIncomingCallAndroidNotification();

  if (!pending || !roomName || pending.roomName === roomName) {
    clearIncomingCall();
  }
}

export function shouldDismissRingingForDirectMessage(message: DirectMessageItem) {
  if (!isCalleeRingCancelledSignal(message.body)) return false;
  const pending = getPendingIncomingCall();
  if (!pending) return true;
  if (Number(message.senderId) !== pending.callerId) return false;
  return true;
}

export async function handleCalleeRingCancelledMessage(message: DirectMessageItem) {
  if (!shouldDismissRingingForDirectMessage(message)) return;
  const pending = getPendingIncomingCall();
  await dismissIncomingCallRinging({
    roomName: pending?.roomName,
    callerId: Number(message.senderId)
  });
}
