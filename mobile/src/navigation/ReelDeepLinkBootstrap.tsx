import React from "react";
import { Linking, Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { fetchHomePost } from "../services/api";
import { runPendingNotificationNavigation, scheduleNotificationNavigation } from "../push/notificationNavigation";
import { navigateToJoinLive } from "./navigationRef";
import { parseReelDeepLink } from "./reelDeepLink";
import { queueOpenSharedPostViewer } from "./sharedPostViewerBridge";

export function ReelDeepLinkBootstrap() {
  const { token } = useAuth();
  const tokenRef = React.useRef(token);
  tokenRef.current = token;

  const openReelFromUrl = React.useCallback((url: string) => {
    const postId = parseReelDeepLink(url);
    if (!postId) return;

    scheduleNotificationNavigation(() => {
      navigateToJoinLive();
      void (async () => {
        try {
          const { post } = await fetchHomePost(tokenRef.current ?? null, postId);
          queueOpenSharedPostViewer(post, true);
        } catch {
          // Post may have been removed or network failed.
        }
      })();
    });
    runPendingNotificationNavigation();
  }, []);

  React.useEffect(() => {
    if (Platform.OS === "web") return;

    void Linking.getInitialURL().then((url) => {
      if (url) openReelFromUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      openReelFromUrl(url);
    });

    return () => subscription.remove();
  }, [openReelFromUrl]);

  return null;
}
