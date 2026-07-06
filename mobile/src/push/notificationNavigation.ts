import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendDirectMessage, fetchHomePost } from "../services/api";
import { navigationRef, navigateToDirectChat, navigateToDirectInbox, navigateToJoinLive } from "../navigation/navigationRef";
import { queueJoinLive } from "../navigation/liveJoinBridge";
import { queueOpenSharedPostViewer } from "../navigation/sharedPostViewerBridge";
import { presentIncomingCallFromPush } from "./GlobalIncomingCallHost";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";
import { completeIncomingCallDecline } from "./incomingCallDecline";
import { dismissMissedCallNotification } from "./missedCallNotifications";

const AUTH_STORAGE_KEY = "agrovibes.auth";

const AUTH_FLOW_ROUTES = new Set([
  "Splash",
  "InitialSetup",
  "AuthChoice",
  "OtpVerify",
  "ForgotPassword",
  "ForgotPasswordOtp",
  "PersonalInfo",
  "RoleSelection",
  "BuyerInterests",
  "BuyerDelivery",
  "BuyerWalkthrough",
  "SellerFarm",
  "SellerKYC",
  "SellerBank",
  "ExpertDomain",
  "ExpertCredentials",
  "ExpertVerification",
  "SecurityVerification"
]);

let pendingAction: (() => void) | null = null;
const replyInFlight = new Set<string>();

function isReplyAction(actionId: string) {
  return actionId === "REPLY" || actionId.endsWith(":REPLY") || actionId.endsWith(".REPLY");
}

function isDeclineCallAction(actionId: string) {
  return actionId === "DECLINE" || actionId.endsWith(":DECLINE") || actionId.endsWith(".DECLINE");
}

function isAcceptCallAction(actionId: string) {
  return actionId === "ACCEPT" || actionId.endsWith(":ACCEPT") || actionId.endsWith(".ACCEPT");
}

function isCallBackAction(actionId: string) {
  return actionId === "CALL_BACK" || actionId.endsWith(":CALL_BACK") || actionId.endsWith(".CALL_BACK");
}

function isMessageAction(actionId: string) {
  return actionId === "MESSAGE" || actionId.endsWith(":MESSAGE") || actionId.endsWith(".MESSAGE");
}

function dismissIncomingCallUi(roomName: string) {
  void clearIncomingCallNotifications(roomName);
}

function isAppReadyForNotificationNavigation() {
  if (!navigationRef.isReady()) return false;
  const route = navigationRef.getCurrentRoute()?.name;
  if (!route) return false;
  return !AUTH_FLOW_ROUTES.has(route);
}

export function runPendingNotificationNavigation() {
  if (!pendingAction || !isAppReadyForNotificationNavigation()) return;
  const action = pendingAction;
  pendingAction = null;
  action();
}

export function scheduleNotificationNavigation(action: () => void) {
  pendingAction = action;
  if (isAppReadyForNotificationNavigation()) {
    runPendingNotificationNavigation();
  }
}

function peerIdFromData(data: Record<string, unknown>) {
  const raw = data.actorId ?? data.senderId ?? data.peerUserId ?? data.callerId;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function resolveAuthToken(explicit?: string | null) {
  const direct = String(explicit || "").trim();
  if (direct) return direct;
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string } | null;
    const stored = String(parsed?.token || "").trim();
    return stored || null;
  } catch {
    return null;
  }
}

async function clearNotificationReplyUi(response: Notifications.NotificationResponse) {
  const identifier = String(response.notification.request.identifier || "").trim();
  if (!identifier) return;
  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // no-op
  }
}

function scheduleOpenPost(postId: number, authToken?: string | null) {
  scheduleNotificationNavigation(() => {
    navigateToJoinLive();
    void (async () => {
      try {
        const token = await resolveAuthToken(authToken);
        const { post } = await fetchHomePost(token, postId);
        queueOpenSharedPostViewer(post, true);
      } catch {
        // Post may have been removed or network failed.
      }
    })();
  });
}

async function handleIncomingCallDecline(
  data: Record<string, unknown>,
  title: string,
  options?: { authToken?: string | null }
) {
  const callerId = peerIdFromData(data);
  if (!callerId) return;
  const mode = String(data.mode || "voice") === "video" ? "video" : "voice";
  await completeIncomingCallDecline({
    callerId,
    callerName: title,
    mode,
    roomName: String(data.roomName || ""),
    callerAvatarUrl: String(data.callerAvatarUrl || "").trim() || null,
    authToken: options?.authToken
  });
}

function presentIncomingCallFromNotificationData(
  data: Record<string, unknown>,
  title: string,
  autoAccept: boolean
) {
  const callerId = peerIdFromData(data);
  const roomName = String(data.roomName || "").trim();
  const mode = String(data.mode || "voice") === "video" ? "video" : "voice";
  const callerAvatarUrl = String(data.callerAvatarUrl || "").trim() || null;
  if (!callerId || !roomName) return false;
  presentIncomingCallFromPush({
    callerId,
    callerName: title,
    roomName,
    mode,
    callerAvatarUrl,
    autoAccept
  });
  return true;
}

async function handleInlineReply(
  response: Notifications.NotificationResponse,
  options?: { authToken?: string | null }
) {
  const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
  const title = String(response.notification.request.content.title || "").trim() || "Someone";
  const type = String(data.type || "");
  const senderId = peerIdFromData(data);
  const text = String(response.userText || "").trim();

  await clearNotificationReplyUi(response);

  if (type !== "direct_message" || !senderId || !text) return;

  const dedupeKey = `${senderId}:${text}:${response.notification.request.identifier}`;
  if (replyInFlight.has(dedupeKey)) return;
  replyInFlight.add(dedupeKey);
  try {
    const authToken = await resolveAuthToken(options?.authToken);
    if (!authToken) return;
    await sendDirectMessage(authToken, senderId, text);
    if (isAppReadyForNotificationNavigation()) {
      navigateToDirectChat({ peerUserId: senderId, peerName: title });
    }
  } catch {
    // Reply already cleared from shade; message may retry from chat.
  } finally {
    replyInFlight.delete(dedupeKey);
  }
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  options?: { authToken?: string | null }
) {
  const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
  const title = String(response.notification.request.content.title || "").trim() || "Someone";
  const type = String(data.type || "");
  const actionId = response.actionIdentifier;

  if (isReplyAction(actionId)) {
    await handleInlineReply(response, options);
    return;
  }

  if (type === "incoming_call" && isDeclineCallAction(actionId)) {
    await clearNotificationReplyUi(response);
    await handleIncomingCallDecline(data, title, options);
    return;
  }

  let scheduled = false;
  const schedule = (action: () => void) => {
    scheduled = true;
    scheduleNotificationNavigation(action);
  };

  if (type === "missed_call") {
    const callerId = peerIdFromData(data);
    const mode = String(data.mode || "voice") === "video" ? "video" : "voice";
    if (callerId) {
      await dismissMissedCallNotification(callerId);
    }
    if (isCallBackAction(actionId) && callerId) {
      schedule(() => {
        navigateToDirectChat({
          peerUserId: callerId,
          peerName: title,
          peerAvatarUrl: String(data.callerAvatarUrl || "").trim() || undefined,
          autoStartCall: mode
        });
      });
    } else if (isMessageAction(actionId) && callerId) {
      schedule(() => {
        navigateToDirectChat({
          peerUserId: callerId,
          peerName: title,
          peerAvatarUrl: String(data.callerAvatarUrl || "").trim() || undefined
        });
      });
    } else if (callerId) {
      schedule(() => {
        navigateToDirectChat({
          peerUserId: callerId,
          peerName: title,
          peerAvatarUrl: String(data.callerAvatarUrl || "").trim() || undefined
        });
      });
    }
    if (scheduled) {
      runPendingNotificationNavigation();
    }
    return;
  }

  if (type === "incoming_call") {
    const autoAccept = isAcceptCallAction(actionId);
    await dismissIncomingCallUi(String(data.roomName || ""));
    const presented = presentIncomingCallFromNotificationData(data, title, autoAccept);
    if (presented) {
      const callerId = peerIdFromData(data);
      if (callerId) {
        schedule(() => {
          navigateToDirectChat({
            peerUserId: callerId,
            peerName: title,
            peerAvatarUrl: String(data.callerAvatarUrl || "").trim() || undefined
          });
        });
      }
    }
  } else if (type === "live_share") {
    const postId = Number(data.postId);
    const senderId = peerIdFromData(data);
    if (Number.isFinite(postId) && postId > 0) {
      schedule(() => {
        queueJoinLive(postId);
        navigateToJoinLive();
      });
    } else if (senderId) {
      schedule(() => {
        navigateToDirectChat({ peerUserId: senderId, peerName: title });
      });
    } else {
      schedule(() => navigateToDirectInbox());
    }
  } else if (type === "direct_message") {
    const senderId = peerIdFromData(data);
    if (senderId) {
      schedule(() => {
        navigateToDirectChat({ peerUserId: senderId, peerName: title });
      });
    } else {
      schedule(() => navigateToDirectInbox());
    }
  } else if (type === "live_start" || type === "live_scheduled" || type === "live_reminder") {
    const postId = Number(data.postId);
    schedule(() => {
      navigateToJoinLive();
      if (Number.isFinite(postId) && postId > 0) {
        queueJoinLive(postId);
      }
    });
  } else if (type === "post_like" || type === "post_comment" || type === "comment_reply") {
    const postId = Number(data.postId);
    if (Number.isFinite(postId) && postId > 0) {
      scheduleOpenPost(postId, options?.authToken);
      scheduled = true;
    }
  }

  if (scheduled) {
    runPendingNotificationNavigation();
  }
}
