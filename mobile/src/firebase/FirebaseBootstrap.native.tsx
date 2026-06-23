import React from "react";
import { useAuth } from "../auth/AuthContext";
import { logAnalyticsEvent, setAnalyticsUserId } from "./analytics";
import { installGlobalCrashHandler, logCrashlyticsMessage, setCrashlyticsUserId } from "./crashlytics";
import { isNativeFirebaseAvailable } from "./firebaseNative";

export function FirebaseBootstrap() {
  const { user } = useAuth();

  React.useEffect(() => {
    if (!isNativeFirebaseAvailable) return;
    installGlobalCrashHandler();
    logCrashlyticsMessage("app_started");
    void logAnalyticsEvent("app_open");
  }, []);

  React.useEffect(() => {
    const userId = user?.id ? String(user.id) : null;
    void setAnalyticsUserId(userId);
    void setCrashlyticsUserId(userId);
    if (userId) {
      void logAnalyticsEvent("login_state", { authenticated: true });
    }
  }, [user?.id]);

  return null;
}
