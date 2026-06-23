import Constants from "expo-constants";

type AnalyticsModule = typeof import("@react-native-firebase/analytics").default;
type CrashlyticsModule = typeof import("@react-native-firebase/crashlytics").default;

/** Available in EAS/dev-client builds; not in Expo Go. */
export const isNativeFirebaseAvailable = Constants.appOwnership !== "expo";

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
