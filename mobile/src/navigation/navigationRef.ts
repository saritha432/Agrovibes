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
  const root = navigationRef.getRootState();
  const alreadyOnStack = root?.routes?.some((route) => route.name === "DirectChat") ?? false;
  // Cold start only has Main on the stack. `push` in that first moment is dropped
  // and the app stays on Home. `navigate` inserts DirectChat once the stack exists.
  if (!alreadyOnStack) {
    navigationRef.navigate("DirectChat", params);
    return;
  }
  navigationRef.dispatch(StackActions.push("DirectChat", params));
}

export function navigateToEditProfile() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("EditProfile");
  }
}

export function navigateToWeather() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Weather");
  }
}

export function navigateToPlantHealth() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("PlantHealth");
  }
}

export function navigateToPlantHealthPlant(plantId: number) {
  if (!navigationRef.isReady() || !plantId) return;
  navigationRef.dispatch(StackActions.push("PlantHealthPlant", { plantId }));
}

export function navigateToSchemes() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Schemes");
  }
}

export function navigateToSchemeDetail(schemeId: string) {
  if (!navigationRef.isReady() || !schemeId) return;
  navigationRef.dispatch(StackActions.push("SchemeDetail", { schemeId }));
}

export function navigateToUserSearch() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("DiscoverSearch");
  }
}

export function navigateToRentalCategory(categoryId: string, location: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("RentalCategory", { categoryId, location });
}

export function navigateToRentalBooking(listing: { id: string; title: string; category: string }, location: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("RentalBooking", {
    listingId: listing.id,
    title: listing.title,
    category: listing.category,
    location
  });
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
