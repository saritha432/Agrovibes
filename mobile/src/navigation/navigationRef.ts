import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./RootNavigator";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToCart() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Market", params: { screen: "Cart" } });
  }
}
