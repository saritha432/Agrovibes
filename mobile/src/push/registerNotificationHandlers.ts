import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { handleNotificationResponse, whenNotificationNavigationSettled } from "./notificationNavigation";

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

const COLD_START_POLL_MS = 400;
const COLD_START_POLL_MAX_MS = 6000;
let coldStartCaptureStarted = false;
let coldStartAuthToken: string | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Killed-state taps are often missing for the first moments after process start.
 * Poll until the OS hands over the response, then keep it until navigation lands.
 */
export function captureColdStartNotificationResponse(options?: { authToken?: string | null }) {
  if (options?.authToken) coldStartAuthToken = options.authToken;
  if (coldStartCaptureStarted || Platform.OS === "web") return;
  coldStartCaptureStarted = true;
  void (async () => {
    const started = Date.now();
    while (Date.now() - started < COLD_START_POLL_MAX_MS) {
      let response: Notifications.NotificationResponse | null = null;
      try {
        response = await Notifications.getLastNotificationResponseAsync();
      } catch {
        return;
      }
      if (response) {
        if (!claimNotificationResponse(response)) return;
        await handleNotificationResponse(response, { authToken: coldStartAuthToken });
        whenNotificationNavigationSettled(() => {
          void clearLastResponseSafe();
        });
        return;
      }
      await delay(COLD_START_POLL_MS);
    }
  })();
}

/** Cold-start: process last notification action if the early listener did not. */
export async function handleColdStartNotificationResponse(options?: { authToken?: string | null }) {
  captureColdStartNotificationResponse(options);
}

type FirebaseRemoteMessage = {
  messageId?: string;
  sentTime?: number;
  data?: Record<string, unknown>;
  notification?: { title?: string; body?: string };
};

type FirebaseMessagingFactory = () => {
  onNotificationOpenedApp: (handler: (message: FirebaseRemoteMessage | null) => void) => () => void;
  getInitialNotification: () => Promise<FirebaseRemoteMessage | null>;
};

let firebaseOpenRegistered = false;
let firebaseInitialCapture: Promise<FirebaseRemoteMessage | null> | null = null;
const handledFirebaseMessageIds = new Set<string>();

function getFirebaseMessaging(): FirebaseMessagingFactory | null {
  if (Platform.OS === "web") return null;
  try {
    const messaging = require("@react-native-firebase/messaging").default as FirebaseMessagingFactory;
    return typeof messaging === "function" ? messaging : null;
  } catch {
    return null;
  }
}

/** Android shows FCM `notification` pushes itself; their taps come through Firebase, not expo. */
function handleFirebaseOpenedMessage(message: FirebaseRemoteMessage | null | undefined) {
  if (!message) return;
  const messageId = String(message.messageId || "").trim();
  if (messageId) {
    if (handledFirebaseMessageIds.has(messageId)) return;
    handledFirebaseMessageIds.add(messageId);
  }
  const data = message.data || {};
  const response = {
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: {
      date: Number(message.sentTime) || Date.now(),
      request: {
        identifier: `fcm-${messageId}`,
        content: {
          title: message.notification?.title ?? String(data.title || ""),
          body: message.notification?.body ?? String(data.message || data.body || ""),
          data
        },
        trigger: null
      }
    }
  } as unknown as Notifications.NotificationResponse;
  if (!claimNotificationResponse(response)) return;
  void handleNotificationResponse(response);
}

export function registerFirebaseNotificationOpenHandler() {
  if (firebaseOpenRegistered) return;
  const messaging = getFirebaseMessaging();
  if (!messaging) return;
  try {
    messaging().onNotificationOpenedApp(handleFirebaseOpenedMessage);
    firebaseOpenRegistered = true;
  } catch {
    // Native Firebase Messaging unavailable in this binary.
  }
}

/**
 * Android often returns null from getInitialNotification on the first call after a
 * killed launch. Keep the message until navigation can open the target screen.
 */
export function captureFirebaseInitialNotification() {
  if (firebaseInitialCapture || Platform.OS === "web") return firebaseInitialCapture;
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    firebaseInitialCapture = Promise.resolve(null);
    return firebaseInitialCapture;
  }
  firebaseInitialCapture = (async () => {
    const started = Date.now();
    while (Date.now() - started < COLD_START_POLL_MAX_MS) {
      try {
        const message = await messaging().getInitialNotification();
        if (message) return message;
      } catch {
        return null;
      }
      await delay(COLD_START_POLL_MS);
    }
    return null;
  })();
  return firebaseInitialCapture;
}

export async function handleFirebaseInitialNotification() {
  const message = await captureFirebaseInitialNotification();
  if (!message) return;
  handleFirebaseOpenedMessage(message);
}
