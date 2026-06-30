import React from "react";
import { Linking, Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { fetchHomePost } from "../services/api";
import { runPendingNotificationNavigation, scheduleNotificationNavigation } from "../push/notificationNavigation";
import { navigationRef, navigateToJoinLive, navigateToPublicProfile } from "./navigationRef";
import { persistPendingReelDeepLink } from "./pendingReelDeepLink";
import { parseProfileDeepLink, parseReelDeepLink } from "./reelDeepLink";
import { queueOpenSharedPostViewer } from "./sharedPostViewerBridge";

export function ReelDeepLinkBootstrap() {
  const { token } = useAuth();
  const tokenRef = React.useRef(token);
  tokenRef.current = token;

  const openReelPostId = React.useCallback((postId: number) => {
    const navReady = navigationRef.isReady();
    const route = navReady ? navigationRef.getCurrentRoute()?.name : undefined;
    const onAuthFlow =
      !route ||
      route === "Splash" ||
      route === "InitialSetup" ||
      route === "AuthChoice" ||
      route === "OtpVerify" ||
      route === "ForgotPassword" ||
      route === "ForgotPasswordOtp" ||
      route === "PersonalInfo" ||
      route === "RoleSelection" ||
      route === "BuyerInterests" ||
      route === "BuyerDelivery" ||
      route === "BuyerWalkthrough" ||
      route === "SellerFarm" ||
      route === "SellerKYC" ||
      route === "SellerBank" ||
      route === "ExpertDomain" ||
      route === "ExpertCredentials" ||
      route === "ExpertVerification" ||
      route === "SecurityVerification";

    if (onAuthFlow) {
      void persistPendingReelDeepLink(postId);
    }

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

  const openFromUrl = React.useCallback((url: string) => {
    const postId = parseReelDeepLink(url);
    if (postId) {
      openReelPostId(postId);
      return;
    }

    const profile = parseProfileDeepLink(url);
    if (profile) {
      scheduleNotificationNavigation(() => {
        navigateToPublicProfile({
          userId: profile.userId,
          userName: profile.userName || "User"
        });
      });
      runPendingNotificationNavigation();
    }
  }, [openReelPostId]);

  React.useEffect(() => {
    if (Platform.OS === "web") return;

    void Linking.getInitialURL().then((url) => {
      if (url) openFromUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      openFromUrl(url);
    });

    return () => subscription.remove();
  }, [openFromUrl]);

  return null;
}
