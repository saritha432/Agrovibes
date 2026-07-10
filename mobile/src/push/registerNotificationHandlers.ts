import * as Notifications from "expo-notifications";
import { handleNotificationResponse } from "./notificationNavigation";

let registered = false;

/** Register early so inline notification replies work while app is backgrounded. */
export function registerNotificationResponseHandler() {
  if (registered) return;
  registered = true;
  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleNotificationResponse(response);
  });
}
