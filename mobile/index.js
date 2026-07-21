import "fast-text-encoding";
import "./src/push/notificationBackgroundTask";
import { registerBackgroundNotificationTask } from "./src/push/notificationBackgroundTask";
import { registerIncomingCallMessagingBackground } from "./src/push/incomingCallMessagingBackground";
import { registerIncomingCallNativeActionHandlers } from "./src/push/incomingCallNativeActionHandlers";
import { registerNotificationResponseHandler } from "./src/push/registerNotificationHandlers";

// Must register before the app root so FCM + notification actions work when backgrounded/killed.
registerIncomingCallMessagingBackground();
registerIncomingCallNativeActionHandlers();
registerNotificationResponseHandler();
void registerBackgroundNotificationTask();

import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
