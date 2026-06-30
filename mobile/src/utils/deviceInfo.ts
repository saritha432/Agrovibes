import * as Device from "expo-device";
import { Platform } from "react-native";

export type DevicePlatform = "android" | "ios" | "web" | "windows" | "unknown";

export function getDevicePlatform(): DevicePlatform {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "web") return "web";
  return "unknown";
}

export function getDeviceName(): string {
  const model = Device.modelName?.trim();
  const name = Device.deviceName?.trim();
  if (model && name && model !== name) return `${name} (${model})`;
  if (model) return model;
  if (name) return name;
  if (Platform.OS === "android") return "Android device";
  if (Platform.OS === "ios") return "iPhone";
  if (Platform.OS === "web") return "Web browser";
  return "Unknown device";
}

export function getLoginDevicePayload(locationLabel?: string | null) {
  return {
    deviceName: getDeviceName(),
    platform: getDevicePlatform(),
    locationLabel: locationLabel?.trim() || undefined
  };
}
