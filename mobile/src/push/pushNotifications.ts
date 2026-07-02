import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "../services/api";

let incomingCallCategoriesReady: Promise<void> | null = null;

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
    const isIncomingCall = String(data.type || "") === "incoming_call";
    if (isIncomingCall) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
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

let cachedToken: string | null = null;

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    description: "General Cropvibe notifications",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#C9FF35"
  });
  await Notifications.setNotificationChannelAsync("direct_messages", {
    name: "Messages",
    description: "Direct message notifications with reply",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#C9FF35"
  });
  await Notifications.setNotificationChannelAsync("incoming_calls", {
    name: "Calls",
    description: "Incoming voice and video calls",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    sound: "default",
    vibrationPattern: [0, 800, 400, 800, 400, 800],
    lightColor: "#C9FF35",
    enableVibrate: true
  });
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

  await ensureAndroidChannel();

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
      }
    } catch {
      // Native FCM/APNs token is enough for firebase-admin.
    }
  }

  cachedToken = token;
  return token;
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
  await ensureAndroidChannel();
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
  await ensureAndroidChannel();
  await Notifications.setNotificationCategoryAsync("INCOMING_VOICE_CALL", [
    {
      identifier: "DECLINE",
      buttonTitle: "Decline",
      options: {
        isDestructive: true,
        opensAppToForeground: true
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
        opensAppToForeground: true
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
