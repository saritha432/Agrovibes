import Constants from "expo-constants";
import { Platform } from "react-native";

/** Native Firebase modules are unavailable in Expo Go and on web. */
export const isNativeFirebaseAvailable =
  Platform.OS !== "web" && Constants.appOwnership !== "expo";

type AnalyticsModule = typeof import("@react-native-firebase/analytics").default;
type CrashlyticsModule = typeof import("@react-native-firebase/crashlytics").default;

let analytics: AnalyticsModule | null = null;
let crashlytics: CrashlyticsModule | null = null;

if (isNativeFirebaseAvailable) {
  try {
    analytics = require("@react-native-firebase/analytics").default;
    crashlytics = require("@react-native-firebase/crashlytics").default;
  } catch {
    analytics = null;
    crashlytics = null;
  }
}

export function getFirebaseAnalytics() {
  return analytics;
}

export function getFirebaseCrashlytics() {
  return crashlytics;
}
