import { createNavigationContainerRef, CommonActions, StackActions } from "@react-navigation/native";
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
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(StackActions.push("DirectChat", params));
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
  // Always push. `navigate()` reuses an existing PublicProfile in the stack (for example
  // after jumping back to Home via tabs) and can no-op or show the previous person.
  navigationRef.dispatch(StackActions.push("PublicProfile", params));
}

export function navigateToJoinLive() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Home" });
  }
}

export function navigateToHome() {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(
    CommonActions.navigate({ name: "Main", params: { screen: "Home" }, merge: true })
  );
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
