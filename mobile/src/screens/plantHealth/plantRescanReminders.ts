import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ANDROID_CHANNELS } from "../../push/pushNotifications";

const STORAGE_KEY = "cropvibe.plantRescanReminders.v1";
const REMINDER_HOUR = 9;

type ReminderMap = Record<string, string>;

function reminderIdentifier(plantId: number) {
  return `plant_rescan:${plantId}`;
}

async function readMap(): Promise<ReminderMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as ReminderMap) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: ReminderMap) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // no-op
  }
}

export function isRescanReminderSupported() {
  return Platform.OS !== "web";
}

/** 9 AM on the due day; if that has already passed, tomorrow 9 AM. */
export function reminderFireDate(dueAt: Date) {
  const fire = new Date(dueAt);
  fire.setHours(REMINDER_HOUR, 0, 0, 0);
  const now = Date.now();
  if (fire.getTime() <= now + 60_000) {
    const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
    tomorrow.setHours(REMINDER_HOUR, 0, 0, 0);
    return tomorrow;
  }
  return fire;
}

/** Returns the scheduled reminder date (ISO) for a plant, or null. */
export async function getRescanReminder(plantId: number): Promise<string | null> {
  if (!isRescanReminderSupported()) return null;
  const map = await readMap();
  const iso = map[String(plantId)];
  if (!iso) return null;
  if (new Date(iso).getTime() < Date.now()) {
    delete map[String(plantId)];
    await writeMap(map);
    return null;
  }
  return iso;
}

export async function cancelRescanReminder(plantId: number) {
  if (!isRescanReminderSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderIdentifier(plantId));
  } catch {
    // no-op
  }
  const map = await readMap();
  if (map[String(plantId)]) {
    delete map[String(plantId)];
    await writeMap(map);
  }
}

/**
 * Schedules a local "time to re-scan" notification. Returns the fire date ISO,
 * or null when unsupported / notifications are not allowed.
 */
export async function scheduleRescanReminder(params: {
  plantId: number;
  title: string;
  body: string;
  dueAt: Date;
}): Promise<string | null> {
  if (!isRescanReminderSupported()) return null;
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return null;

  await cancelRescanReminder(params.plantId);
  const fireDate = reminderFireDate(params.dueAt);
  await Notifications.scheduleNotificationAsync({
    identifier: reminderIdentifier(params.plantId),
    content: {
      title: params.title,
      body: params.body,
      data: { type: "plant_rescan", plantId: String(params.plantId) }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNELS.default } : {})
    }
  });
  const map = await readMap();
  map[String(params.plantId)] = fireDate.toISOString();
  await writeMap(map);
  return fireDate.toISOString();
}
