import { getFirebaseCrashlytics, isNativeFirebaseAvailable } from "./firebaseNative";

export async function setCrashlyticsUserId(userId: string | null) {
  const crashlytics = getFirebaseCrashlytics();
  if (!crashlytics) return;
  await crashlytics().setUserId(userId || "");
}

export function logCrashlyticsMessage(message: string) {
  const crashlytics = getFirebaseCrashlytics();
  if (!crashlytics) {
    if (__DEV__ && !isNativeFirebaseAvailable) {
      console.debug("[crashlytics]", message);
    }
    return;
  }
  crashlytics().log(message);
}

export function recordCrashlyticsError(error: unknown, context?: string) {
  const crashlytics = getFirebaseCrashlytics();
  if (!crashlytics) {
    if (__DEV__) {
      console.warn("[crashlytics] error", context || "", error);
    }
    return;
  }
  if (context) crashlytics().log(context);
  const err = error instanceof Error ? error : new Error(String(error));
  crashlytics().recordError(err);
}

export function installGlobalCrashHandler() {
  if (!getFirebaseCrashlytics()) return;
  const defaultHandler = (ErrorUtils as { getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void })
    .getGlobalHandler?.();
  if (!defaultHandler) return;
  (ErrorUtils as { setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void }).setGlobalHandler(
    (error, isFatal) => {
      recordCrashlyticsError(error, isFatal ? "fatal" : "non-fatal");
      defaultHandler(error, isFatal);
    }
  );
}
