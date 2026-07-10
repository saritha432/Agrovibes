import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { handleNotificationResponse } from "./notificationNavigation";

let registered = false;
let notifeeRegistered = false;

/** Register early so inline notification replies work while app is backgrounded. */
export function registerNotificationResponseHandler() {
  if (registered) return;
  registered = true;
  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleNotificationResponse(response);
  });
  registerNotifeeReplyHandlers();
}

function registerNotifeeReplyHandlers() {
  if (notifeeRegistered || Platform.OS !== "android") return;
  notifeeRegistered = true;
  try {
    const notifee = require("@notifee/react-native").default as {
      onForegroundEvent: (handler: (event: NotifeeEvent) => void) => () => void;
      onBackgroundEvent: (handler: (event: NotifeeEvent) => Promise<void>) => void;
    };
    const { EventType } = require("@notifee/react-native") as {
      EventType: { ACTION_PRESS: number; PRESS: number };
    };

    const handle = async (event: NotifeeEvent) => {
      const { type, detail } = event;
      if (type !== EventType.ACTION_PRESS && type !== EventType.PRESS) return;
      const actionId = String(detail.pressAction?.id || "").trim();
      const data = (detail.notification?.data || {}) as Record<string, unknown>;
      if (String(data.type || "") !== "direct_message") return;

      // Map Notifee event → expo-notifications-shaped response for shared handler.
      const response = {
        actionIdentifier: actionId === "REPLY" || actionId === "reply" ? "REPLY" : Notifications.DEFAULT_ACTION_IDENTIFIER,
        userText: String(detail.input || "").trim() || undefined,
        notification: {
          date: Date.now(),
          request: {
            identifier: String(detail.notification?.id || ""),
            content: {
              title: String(detail.notification?.title || ""),
              body: String(detail.notification?.body || ""),
              data
            },
            trigger: null
          }
        }
      } as Notifications.NotificationResponse;

      await handleNotificationResponse(response);
    };

    notifee.onForegroundEvent((event) => {
      void handle(event);
    });
    notifee.onBackgroundEvent(async (event) => {
      await handle(event);
    });
  } catch {
    notifeeRegistered = false;
  }
}

type NotifeeEvent = {
  type: number;
  detail: {
    pressAction?: { id?: string };
    input?: string;
    notification?: {
      id?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    };
  };
};
