import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "../services/api";

let incomingCallCategoriesReady: Promise<void> | null = null;

/**
 * Fresh channel IDs force Android to recreate channels with sound.
 * Channel sound/importance cannot be changed after first creation (OEM/user settings).
 * v3: drop COMMUNICATION_* audio usage — some OEMs routed that to a silent stream
 * while notification volume was on (other apps sounded fine, Cropvibe did not).
 */
export const ANDROID_CHANNELS = {
  default: "general_v3",
  /** Heads-up banners for DMs while another app is open */
  directMessages: "direct_messages_v3",
  /** Heads-up / full-screen style for incoming calls */
  incomingCalls: "incoming_calls_v3",
  missedCalls: "missed_calls_v3"
} as const;

export function ensureIncomingCallCategoriesReady() {
  if (!incomingCallCategoriesReady) {
    incomingCallCategoriesReady = setupIncomingCallNotificationCategories().catch(() => {
      incomingCallCategoriesReady = null;
    });
  }
  return incomingCallCategoriesReady;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data || {}) as Record<string, unknown>;
    const type = String(data.type || "");
    if (type === "call_cancelled") {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.MIN
      };
    }
    const isIncomingCall = type === "incoming_call";
    const isDirectMessage = type === "direct_message";
    if (isIncomingCall || isDirectMessage) {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: !isIncomingCall,
        priority: Notifications.AndroidNotificationPriority.MAX
      };
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH
    };
  }
});

export async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;

  // Remove older channels that may have been created silent / with bad audio attributes.
  for (const legacyId of [
    "default",
    "direct_messages",
    "incoming_calls",
    "missed_calls",
    "direct_messages_v2",
    "incoming_calls_v2",
    "missed_calls_v2"
  ]) {
    try {
      await Notifications.deleteNotificationChannelAsync(legacyId);
    } catch {
      // no-op
    }
  }

  const notificationAudio = {
    usage: Notifications.AndroidAudioUsage.NOTIFICATION,
    contentType: Notifications.AndroidAudioContentType.SONIFICATION
  };

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.default, {
    name: "General",
    description: "Likes, comments, follows, and other Cropvibe alerts",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#C9FF35",
    showBadge: true,
    audioAttributes: notificationAudio
  });
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.directMessages, {
    name: "Messages",
    description: "Direct message alerts (with sound)",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#C9FF35",
    showBadge: true,
    audioAttributes: notificationAudio
  });
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.incomingCalls, {
    name: "Calls",
    description: "Incoming voice and video calls (with ringtone sound)",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 800, 400, 800, 400, 800],
    lightColor: "#C9FF35",
    showBadge: false,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION
    }
  });
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.missedCalls, {
    name: "Missed calls",
    description: "Missed and declined call alerts",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#C9FF35",
    showBadge: true,
    audioAttributes: notificationAudio
  });
}

let cachedToken: string | null = null;

async function getFirebaseMessagingToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const messagingModule = require("@react-native-firebase/messaging").default as (() => {
      registerDeviceForRemoteMessages: () => Promise<void>;
      requestPermission: () => Promise<number>;
      getToken: () => Promise<string>;
    }) & { AuthorizationStatus: { AUTHORIZED: number; PROVISIONAL: number } };
    if (typeof messagingModule !== "function") return null;

    const messaging = messagingModule();
    if (Platform.OS === "android") {
      try {
        await messaging.requestPermission();
      } catch {
        // POST_NOTIFICATIONS may already be granted via expo-notifications.
      }
    }
    if (Platform.OS === "ios") {
      await messaging.registerDeviceForRemoteMessages();
      const authStatus = await messaging.requestPermission();
      const enabled =
        authStatus === messagingModule.AuthorizationStatus.AUTHORIZED ||
        authStatus === messagingModule.AuthorizationStatus.PROVISIONAL;
      if (!enabled) return null;
    }

    const token = String((await messaging.getToken()) || "").trim();
    return token || null;
  } catch {
    return null;
  }
}

export async function getNativePushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  await ensureAndroidChannels();

  const firebaseToken = await getFirebaseMessagingToken();
  if (firebaseToken) {
    cachedToken = firebaseToken;
    return firebaseToken;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.projectId;

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  const token = String(deviceToken?.data || "").trim();
  if (!token) return null;

  if (projectId && Platform.OS === "ios") {
    try {
      const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
      if (expoToken?.data) {
        cachedToken = expoToken.data;
        return expoToken.data;
      }
    } catch {
      // Native FCM/APNs token is enough for firebase-admin.
    }
  }

  cachedToken = token;
  return token;
}

export function getCachedPushToken() {
  return cachedToken;
}

export async function registerPushNotifications(authToken: string | null | undefined) {
  if (!authToken) return null;
  const token = await getNativePushToken();
  if (!token) return null;
  await registerPushToken(authToken, {
    token,
    platform: Platform.OS === "ios" ? "ios" : "android"
  });
  return token;
}

export async function unregisterPushNotifications(
  authToken: string | null | undefined,
  deviceToken?: string | null
) {
  const token = String(deviceToken || cachedToken || "").trim();
  if (!authToken || !token) return;
  try {
    await unregisterPushToken(authToken, token);
  } catch {
    // no-op
  } finally {
    if (!deviceToken || deviceToken === cachedToken) {
      cachedToken = null;
    }
  }
}

export function addNotificationResponseListener(
  listener: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export function addNotificationReceivedListener(listener: (event: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(listener);
}

export async function setupDirectMessageNotificationCategory() {
  if (Platform.OS === "web") return;
  await ensureAndroidChannels();
  await Notifications.setNotificationCategoryAsync("DIRECT_MESSAGE", [
    {
      identifier: "REPLY",
      buttonTitle: "Reply",
      textInput: {
        submitButtonTitle: "Send",
        placeholder: "Message..."
      },
      options: {
        opensAppToForeground: false
      }
    }
  ]);
}

export async function setupIncomingCallNotificationCategories() {
  if (Platform.OS === "web") return;
  await ensureAndroidChannels();
  await Notifications.setNotificationCategoryAsync("INCOMING_VOICE_CALL", [
    {
      identifier: "DECLINE",
      buttonTitle: "Decline",
      options: {
        isDestructive: true,
        opensAppToForeground: false
      }
    },
    {
      identifier: "ACCEPT",
      buttonTitle: "Answer",
      options: {
        opensAppToForeground: true
      }
    }
  ]);
  await Notifications.setNotificationCategoryAsync("INCOMING_VIDEO_CALL", [
    {
      identifier: "DECLINE",
      buttonTitle: "Decline",
      options: {
        isDestructive: true,
        opensAppToForeground: false
      }
    },
    {
      identifier: "ACCEPT",
      buttonTitle: "Video",
      options: {
        opensAppToForeground: true
      }
    }
  ]);
}

export async function setupMissedCallNotificationCategory() {
  if (Platform.OS === "web") return;
  await ensureAndroidChannels();
  await Notifications.setNotificationCategoryAsync("MISSED_CALL", [
    {
      identifier: "CALL_BACK",
      buttonTitle: "Call back",
      options: {
        opensAppToForeground: true
      }
    },
    {
      identifier: "MESSAGE",
      buttonTitle: "Message",
      options: {
        opensAppToForeground: true
      }
    }
  ]);
}
