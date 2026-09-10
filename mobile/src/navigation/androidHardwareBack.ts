import { BackHandler, Platform, type NativeEventSubscription } from "react-native";
import { CommonActions } from "@react-navigation/native";
import { navigationRef } from "./navigationRef";
import { tryCloseCreateModal } from "./createModalBridge";
import { tryExitHomeReelImmersive } from "./homeReelImmersiveBridge";
import { tryFocusedScreenBack, hasFocusedScreenBack } from "./focusedScreenBackBridge";
import { tryHandleNotificationSheetBack } from "./notificationSheetBridge";
import { tryClosePostsReelModal } from "./postsReelModalBridge";

let backSubscription: NativeEventSubscription | null = null;

/** Leaf routes that sit at the root of each bottom tab (back on these may exit or go Home). */
const TAB_ROOT_ROUTE_NAMES = new Set([
  "Home",
  "Search",
  "Services",
  "Messages",
  "Profile",
  "MarketplaceHome",
  "LearnHome"
]);

function navigateToHomeTab(): void {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(
    CommonActions.navigate({ name: "Main", params: { screen: "Home" }, merge: true })
  );
}

function handleNavigationFallback(): boolean {
  const currentName = navigationRef.getCurrentRoute()?.name ?? "";

  if (!currentName || currentName === "Home") {
    return false;
  }

  if (!TAB_ROOT_ROUTE_NAMES.has(currentName)) {
    navigationRef.goBack();
    return true;
  }

  navigateToHomeTab();
  return true;
}

/**
 * Single Android hardware-back handler for the whole app.
 * Overlays → focused screen (same as in-app back) → navigation fallback → exit on Home root.
 */
function handleHardwareBack(): boolean {
  if (!navigationRef.isReady()) return false;

  if (tryCloseCreateModal()) return true;
  if (tryHandleNotificationSheetBack()) return true;
  if (tryClosePostsReelModal()) return true;
  if (tryExitHomeReelImmersive()) return true;

  if (tryFocusedScreenBack()) return true;

  // Focused screen exists but returned false — still avoid exiting when possible.
  if (hasFocusedScreenBack()) {
    return handleNavigationFallback();
  }

  return handleNavigationFallback();
}

export function installAndroidHardwareBackHandler() {
  if (Platform.OS !== "android" || backSubscription) return;
  backSubscription = BackHandler.addEventListener("hardwareBackPress", handleHardwareBack);
}
