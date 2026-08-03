import { createNavigationContainerRef, StackActions } from "@react-navigation/native";
import type { RootStackParamList } from "./RootNavigator";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToCart() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Market", params: { screen: "Cart" } });
  }
}

export function navigateToDirectInbox() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Messages" });
  }
}

export function navigateToDirectChat(params: RootStackParamList["DirectChat"]) {
  if (navigationRef.isReady()) {
    navigationRef.navigate("DirectChat", params);
  }
}

export function navigateToEditProfile() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("EditProfile");
  }
}

export function navigateToUserSearch() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Search" });
  }
}

export function navigateToPublicProfile(params: RootStackParamList["PublicProfile"]) {
  if (!navigationRef.isReady()) return;
  // Push so opening a mutual/follower from an existing PublicProfile stacks a new screen
  // instead of silently updating (or no-op'ing) the current route.
  const current = navigationRef.getCurrentRoute();
  if (current?.name === "PublicProfile") {
    navigationRef.dispatch(StackActions.push("PublicProfile", params));
    return;
  }
  navigationRef.navigate("PublicProfile", params);
}

export function navigateToJoinLive() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Home" });
  }
}

export function navigateToHome() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Home" });
  }
}

export function navigateToMyProfile() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Profile" });
  }
}

export function resetToLoginAfterPasswordReset(loginPhone: string) {
  if (!navigationRef.isReady()) return false;
  navigationRef.reset({
    index: 0,
    routes: [
      {
        name: "AuthChoice",
        params: { initialMode: "login", passwordResetSuccess: true, loginPhone }
      }
    ]
  });
  return true;
}
