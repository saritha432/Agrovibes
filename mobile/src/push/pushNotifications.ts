import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "../services/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
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
