import "fast-text-encoding";
import { registerIncomingCallMessagingBackground } from "./src/push/incomingCallMessagingBackground";
import { registerNotificationResponseHandler } from "./src/push/registerNotificationHandlers";

// Must register before the app root so FCM data messages work when backgrounded/killed.
registerIncomingCallMessagingBackground();
registerNotificationResponseHandler();

import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
