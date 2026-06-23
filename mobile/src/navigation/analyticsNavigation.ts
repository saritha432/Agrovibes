import { logAnalyticsScreen } from "../firebase/analytics";
import { navigationRef } from "./navigationRef";

export function trackNavigationScreen() {
  if (!navigationRef.isReady()) return;
  const route = navigationRef.getCurrentRoute();
  if (!route?.name) return;
  void logAnalyticsScreen(route.name);
}
