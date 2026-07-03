import "fast-text-encoding";
import { registerIncomingCallMessagingBackground } from "./src/push/incomingCallMessagingBackground";
import "./src/push/registerNotificationHandlers";

// Must register before the app root so FCM data messages work when backgrounded/killed.
registerIncomingCallMessagingBackground();

import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
