import * as Notifications from "expo-notifications";
import { handleNotificationResponse } from "./notificationNavigation";
import { claimNotificationResponse } from "./registerNotificationHandlers";

export const BACKGROUND_NOTIFICATION_TASK = "agrovibes-background-notification";

type TaskManagerModule = {
  defineTask: (name: string, handler: (payload: { data?: unknown; error?: unknown }) => Promise<void>) => void;
  isTaskRegisteredAsync: (name: string) => Promise<boolean>;
};

function getTaskManager(): TaskManagerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-task-manager") as TaskManagerModule;
  } catch {
    return null;
  }
}

const TaskManager = getTaskManager();

if (TaskManager) {
  try {
    TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
      if (error) return;
      const response = data as Notifications.NotificationResponse | undefined;
      if (!response) return;
      if (!claimNotificationResponse(response)) return;
      await handleNotificationResponse(response);
    });
  } catch {
    // Native ExpoTaskManager missing (Expo Go / outdated binary).
  }
}

export async function registerBackgroundNotificationTask() {
  if (!TaskManager) return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!registered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    }
  } catch {
    // Task registration requires a dev client / release build with expo-task-manager.
  }
}
