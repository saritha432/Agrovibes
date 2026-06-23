import { getFirebaseAnalytics, isNativeFirebaseAvailable } from "./firebaseNative";

export async function logAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  const analytics = getFirebaseAnalytics();
  if (!analytics) {
    if (__DEV__ && !isNativeFirebaseAvailable) {
      console.debug("[analytics]", name, params || {});
    }
    return;
  }
  const cleanParams = params
    ? Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
      )
    : undefined;
  await analytics().logEvent(name, cleanParams);
}

export async function logAnalyticsScreen(screenName: string) {
  const analytics = getFirebaseAnalytics();
  if (!analytics) {
    if (__DEV__ && !isNativeFirebaseAvailable) {
      console.debug("[analytics] screen", screenName);
    }
    return;
  }
  await analytics().logScreenView({
    screen_name: screenName,
    screen_class: screenName
  });
}

export async function setAnalyticsUserId(userId: string | null) {
  const analytics = getFirebaseAnalytics();
  if (!analytics) return;
  await analytics().setUserId(userId);
}
