import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendDirectMessage } from "../services/api";
import { navigationRef, navigateToDirectChat, navigateToDirectInbox, navigateToJoinLive } from "../navigation/navigationRef";
import { queueJoinLive } from "../navigation/liveJoinBridge";

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

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  options?: { authToken?: string | null }
) {
  const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
  const title = String(response.notification.request.content.title || "").trim() || "Someone";
  const type = String(data.type || "");
  const actionId = response.actionIdentifier;

  if (actionId === "REPLY") {
    if (type !== "direct_message") return;
    const senderId = peerIdFromData(data);
    const text = String(response.userText || "").trim();
    const authToken = await resolveAuthToken(options?.authToken);
    if (!senderId || !text || !authToken) return;
    void sendDirectMessage(authToken, senderId, text).catch(() => undefined);
    return;
  }

  if (type === "incoming_call") {
    const callerId = peerIdFromData(data);
    const roomName = String(data.roomName || "").trim();
    const mode = String(data.mode || "voice") === "video" ? "video" : "voice";
    if (!callerId || !roomName) return;
    scheduleNotificationNavigation(() => {
      navigateToDirectChat({
        peerUserId: callerId,
        peerName: title,
        incomingCall: { roomName, mode, callerId }
      });
    });
    return;
  }

  if (type === "live_share") {
    const postId = Number(data.postId);
    const senderId = peerIdFromData(data);
    if (Number.isFinite(postId) && postId > 0) {
      scheduleNotificationNavigation(() => {
        queueJoinLive(postId);
        navigateToJoinLive();
      });
      return;
    }
    if (senderId) {
      scheduleNotificationNavigation(() => {
        navigateToDirectChat({ peerUserId: senderId, peerName: title });
      });
      return;
    }
    scheduleNotificationNavigation(() => navigateToDirectInbox());
    return;
  }

  if (type === "direct_message") {
    const senderId = peerIdFromData(data);
    if (senderId) {
      scheduleNotificationNavigation(() => {
        navigateToDirectChat({ peerUserId: senderId, peerName: title });
      });
      return;
    }
    scheduleNotificationNavigation(() => navigateToDirectInbox());
    return;
  }

  if (type === "live_start" || type === "live_scheduled" || type === "live_reminder") {
    scheduleNotificationNavigation(() => navigateToJoinLive());
  }
}
