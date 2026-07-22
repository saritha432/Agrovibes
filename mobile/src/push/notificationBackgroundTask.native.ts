import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { handleNotificationResponse } from "./notificationNavigation";
import { claimNotificationResponse } from "./registerNotificationHandlers";

export const BACKGROUND_NOTIFICATION_TASK = "agrovibes-background-notification";

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;
  const response = data as Notifications.NotificationResponse | undefined;
  if (!response) return;
  if (!claimNotificationResponse(response)) return;
  await handleNotificationResponse(response);
});

export async function registerBackgroundNotificationTask() {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!registered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    }
  } catch {
    // Task registration requires a dev client / release build with expo-task-manager.
  }
}
