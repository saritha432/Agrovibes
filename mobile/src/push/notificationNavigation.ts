import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendDirectMessage, fetchHomePost } from "../services/api";
import { navigationRef, navigateToDirectChat, navigateToDirectInbox, navigateToHome, navigateToJoinLive, navigateToWeather } from "../navigation/navigationRef";
import { requestOpenNotificationSheet } from "../navigation/notificationSheetBridge";
import { queueJoinLive } from "../navigation/liveJoinBridge";
import { queueOpenSharedPostViewer } from "../navigation/sharedPostViewerBridge";
import { presentIncomingCallFromPush } from "./GlobalIncomingCallHost";
import { clearIncomingCallNotifications } from "./incomingCallNotifications";
import { completeIncomingCallDecline } from "./incomingCallDecline";
import { isCallRoomEnded, markCallRoomEnded } from "./cancelledCallRooms";
import { verifyCallStillRinging } from "./verifyCallRinging";
import { presentDirectMessageNotification } from "./dmNotificationThread";
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

type PendingNav = {
  action: () => void;
  expectRoute?: string;
  attempts: number;
};

let pendingNav: PendingNav | null = null;
let pendingRetryTimer: ReturnType<typeof setInterval> | null = null;
let verifyTimer: ReturnType<typeof setTimeout> | null = null;
let navigationReadyAt = 0;
let verifyInFlight = false;
const settleWaiters: Array<() => void> = [];
const PENDING_RETRY_MS = 250;
const PENDING_RETRY_MAX_MS = 20000;
/** Native stack drops a push dispatched in the same turn as NavigationContainer onReady. */
const NAV_SETTLE_MS = 450;
const MAX_NAV_ATTEMPTS = 8;
const replyInFlight = new Set<string>();
const FOLLOW_NOTIFICATION_TYPES = new Set(["follow_request", "follow_accept", "new_follow"]);
/** Same push can arrive via expo-notifications and Firebase "opened app" hooks. */
const TAP_DEDUPE_MS = 5000;
let lastTapKey = "";
let lastTapAt = 0;

function isDuplicateTap(data: Record<string, unknown>, actionId: string) {
  const key = [
    String(data.type || ""),
    String(data.postId || ""),
    String(data.followId || ""),
    String(data.actorId || data.senderId || data.callerId || ""),
    String(data.messageId || ""),
    actionId
  ].join("|");
  const now = Date.now();
  if (key === lastTapKey && now - lastTapAt < TAP_DEDUPE_MS) return true;
  lastTapKey = key;
  lastTapAt = now;
  return false;
}

function scheduleOpenNotificationsSheet() {
  scheduleNotificationNavigation(() => {
    navigateToHome();
    requestOpenNotificationSheet();
  });
}

function isReplyAction(actionId: string) {
  return actionId === "REPLY" || actionId.endsWith(":REPLY") || actionId.endsWith(".REPLY");
}

function isDeclineCallAction(actionId: string) {
  const id = String(actionId || "").trim().toUpperCase();
  if (!id || id === Notifications.DEFAULT_ACTION_IDENTIFIER.toUpperCase()) return false;
  return id === "DECLINE" || id.endsWith(":DECLINE") || id.endsWith(".DECLINE") || id.includes("DECLINE");
}

function isAcceptCallAction(actionId: string) {
  const id = String(actionId || "").trim().toUpperCase();
  if (!id || id === Notifications.DEFAULT_ACTION_IDENTIFIER.toUpperCase()) return false;
  return (
    id === "ACCEPT" ||
    id.endsWith(":ACCEPT") ||
    id.endsWith(".ACCEPT") ||
    id.includes("ANSWER") ||
    id.includes("VIDEO")
  );
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
  if (!navigationReadyAt || Date.now() - navigationReadyAt < NAV_SETTLE_MS) return false;
  const route = navigationRef.getCurrentRoute()?.name;
  if (!route) return false;
  if (AUTH_FLOW_ROUTES.has(route)) return false;
  return Boolean(navigationRef.getRootState()?.routes?.length);
}

function stopPendingRetry() {
  if (pendingRetryTimer) {
    clearInterval(pendingRetryTimer);
    pendingRetryTimer = null;
  }
}

function stopVerify() {
  if (verifyTimer) {
    clearTimeout(verifyTimer);
    verifyTimer = null;
  }
}

function releaseNavigationWaiters() {
  verifyInFlight = false;
  if (pendingNav) return;
  const waiters = settleWaiters.splice(0);
  for (const waiter of waiters) waiter();
}

/** Called from NavigationContainer onReady. Cold-start taps wait until the stack can accept a screen. */
export function markNavigationContainerReady() {
  if (!navigationReadyAt) navigationReadyAt = Date.now();
  startPendingRetry();
}

/** Resolves once a killed-state tap has been applied, or there was nothing to apply. */
export function whenNotificationNavigationSettled(fn: () => void) {
  if (!pendingNav && !verifyInFlight) {
    fn();
    return;
  }
  settleWaiters.push(fn);
}

export function runPendingNotificationNavigation() {
  if (!pendingNav || verifyInFlight || !isAppReadyForNotificationNavigation()) return;
  const current = pendingNav;
  pendingNav = null;
  stopPendingRetry();
  if (current.expectRoute) verifyInFlight = true;
  if (__DEV__) console.log("[notif] running pending navigation", current.expectRoute || "");
  try {
    current.action();
  } catch {
    verifyInFlight = false;
    releaseNavigationWaiters();
    return;
  }
  if (!current.expectRoute) {
    releaseNavigationWaiters();
    return;
  }
  const expectRoute = current.expectRoute;
  const started = Date.now();
  const check = () => {
    verifyTimer = null;
    if (navigationRef.getCurrentRoute()?.name === expectRoute) {
      releaseNavigationWaiters();
      return;
    }
    if (Date.now() - started < 1200) {
      verifyTimer = setTimeout(check, 150);
      return;
    }
    verifyInFlight = false;
    if (current.attempts + 1 >= MAX_NAV_ATTEMPTS) {
      releaseNavigationWaiters();
      return;
    }
    if (!pendingNav) {
      pendingNav = { ...current, attempts: current.attempts + 1 };
      startPendingRetry();
    } else {
      releaseNavigationWaiters();
    }
  };
  verifyTimer = setTimeout(check, 150);
}

/** Tap can arrive before the navigator is mounted; keep retrying until it can navigate. */
function startPendingRetry() {
  stopPendingRetry();
  if (!pendingNav) return;
  const startedAt = Date.now();
  pendingRetryTimer = setInterval(() => {
    if (!pendingNav || Date.now() - startedAt > PENDING_RETRY_MAX_MS) {
      const gaveUp = Boolean(pendingNav) && Date.now() - startedAt > PENDING_RETRY_MAX_MS;
      stopPendingRetry();
      if (gaveUp) {
        pendingNav = null;
        releaseNavigationWaiters();
      }
      return;
    }
    runPendingNotificationNavigation();
  }, PENDING_RETRY_MS);
}

export function scheduleNotificationNavigation(action: () => void, expectRoute?: string) {
  stopVerify();
  verifyInFlight = false;
  pendingNav = { action, expectRoute, attempts: 0 };
  if (isAppReadyForNotificationNavigation()) {
    runPendingNotificationNavigation();
    return;
  }
  startPendingRetry();
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

async function resolveCurrentUserName() {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { user?: { fullName?: string; username?: string } } | null;
    return String(parsed?.user?.fullName || parsed?.user?.username || "").trim();
  } catch {
    return "";
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
  autoAccept: boolean,
  options?: { authToken?: string | null }
) {
  const callerId = peerIdFromData(data);
  const roomName = String(data.roomName || "").trim();
  const mode = String(data.mode || "voice") === "video" ? "video" : "voice";
  const callerAvatarUrl = String(data.callerAvatarUrl || "").trim() || null;
  if (!callerId || !roomName) return false;

  void (async () => {
    if (isCallRoomEnded(roomName)) {
      await clearIncomingCallNotifications(roomName);
      return;
    }
    const stillRinging = await verifyCallStillRinging(roomName, options?.authToken);
    if (!stillRinging) {
      markCallRoomEnded(roomName);
      await clearIncomingCallNotifications(roomName);
      return;
    }
    presentIncomingCallFromPush({
      callerId,
      callerName: title,
      roomName,
      mode,
      callerAvatarUrl,
      autoAccept
    });
  })();

  return true;
}

async function handleInlineReply(
  response: Notifications.NotificationResponse,
  options?: { authToken?: string | null }
) {
  const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
  const type = String(data.type || "");
  const senderId = peerIdFromData(data);
  const text = String(response.userText || "").trim();
  const peerName =
    String(
      data.peerName ||
        response.notification.request.content.title ||
        data.actorName ||
        data.senderName ||
        ""
    ).trim() || "Someone";
  const previousBody = String(response.notification.request.content.body || "").trim();
  const replaceIdentifier = String(response.notification.request.identifier || "").trim();

  if (type !== "direct_message" || !senderId || !text) return;

  const dedupeKey = `${senderId}:${text}:${replaceIdentifier}`;
  if (replyInFlight.has(dedupeKey)) return;
  replyInFlight.add(dedupeKey);
  try {
    const authToken = await resolveAuthToken(options?.authToken);
    if (!authToken) return;
    await sendDirectMessage(authToken, senderId, text);
    // Real profile name only — never "You", never fall back to peer name.
    const selfName = await resolveCurrentUserName();
    await presentDirectMessageNotification({
      peerUserId: senderId,
      peerName,
      senderName: selfName || "Me",
      messageText: text,
      fromPeer: false,
      previousBody,
      replaceIdentifier,
      data: {
        ...data,
        type: "direct_message",
        actorId: String(senderId),
        peerUserId: String(senderId),
        peerName
      }
    });
  } catch {
    // Message may retry from chat.
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
  if (__DEV__) {
    console.log("[notif] tap received", { type, actionId, peer: peerIdFromData(data) });
  }

  if (isReplyAction(actionId)) {
    await handleInlineReply(response, options);
    return;
  }

  if (isDuplicateTap(data, actionId)) return;

  if (type === "incoming_call" && isDeclineCallAction(actionId)) {
    await clearNotificationReplyUi(response);
    await handleIncomingCallDecline(data, title, options);
    return;
  }

  let scheduled = false;
  const schedule = (action: () => void, expectRoute?: string) => {
    scheduled = true;
    scheduleNotificationNavigation(action, expectRoute);
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
      }, "DirectChat");
    } else if (isMessageAction(actionId) && callerId) {
      schedule(() => {
        navigateToDirectChat({
          peerUserId: callerId,
          peerName: title,
          peerAvatarUrl: String(data.callerAvatarUrl || "").trim() || undefined
        });
      }, "DirectChat");
    } else if (callerId) {
      schedule(() => {
        navigateToDirectChat({
          peerUserId: callerId,
          peerName: title,
          peerAvatarUrl: String(data.callerAvatarUrl || "").trim() || undefined
        });
      }, "DirectChat");
    }
    if (scheduled) {
      runPendingNotificationNavigation();
    }
    return;
  }

  if (type === "incoming_call") {
    const autoAccept = isAcceptCallAction(actionId);
    if (autoAccept) {
      await dismissIncomingCallUi(String(data.roomName || ""));
      presentIncomingCallFromNotificationData(data, title, true, options);
    } else if (!isDeclineCallAction(actionId)) {
      // Tap notification body: show incoming call UI without jumping into chat.
      presentIncomingCallFromNotificationData(data, title, false, options);
    }
    return;
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
      }, "DirectChat");
    } else {
      schedule(() => navigateToDirectInbox(), "Messages");
    }
  } else if (type === "direct_message") {
    const senderId = peerIdFromData(data);
    const peerName = String(data.peerName || data.actorName || title).trim() || title;
    if (senderId) {
      schedule(() => {
        navigateToDirectChat({ peerUserId: senderId, peerName });
      }, "DirectChat");
    } else {
      schedule(() => navigateToDirectInbox(), "Messages");
    }
  } else if (type === "live_start" || type === "live_scheduled" || type === "live_reminder") {
    const postId = Number(data.postId);
    schedule(() => {
      navigateToJoinLive();
      if (Number.isFinite(postId) && postId > 0) {
        queueJoinLive(postId);
      }
    });
  } else if (type === "post_like" || type === "post_comment" || type === "comment_reply" || type === "post_tag") {
    const postId = Number(data.postId);
    if (Number.isFinite(postId) && postId > 0) {
      scheduleOpenPost(postId, options?.authToken);
    } else {
      scheduleOpenNotificationsSheet();
    }
    scheduled = true;
  } else if (type === "weather_alert") {
    schedule(() => navigateToWeather(), "Weather");
  } else if (FOLLOW_NOTIFICATION_TYPES.has(type)) {
    scheduleOpenNotificationsSheet();
    scheduled = true;
  }

  if (scheduled) {
    runPendingNotificationNavigation();
  }
}
