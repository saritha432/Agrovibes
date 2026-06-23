import { AudioSession } from "@livekit/react-native";
import { Platform } from "react-native";
import type { Ionicons } from "@expo/vector-icons";

export type CallAudioRoute = "earpiece" | "speaker" | "bluetooth" | "headset";

export async function listCallAudioOutputs(): Promise<string[]> {
  try {
    return await AudioSession.getAudioOutputs();
  } catch {
    return [];
  }
}

export async function applyInitialCallAudioRoute(): Promise<CallAudioRoute> {
  const outputs = await listCallAudioOutputs();
  if (outputs.includes("bluetooth")) {
    await AudioSession.selectAudioOutput("bluetooth");
    return "bluetooth";
  }
  if (outputs.includes("headset")) {
    await AudioSession.selectAudioOutput("headset");
    return "headset";
  }
  if (Platform.OS === "ios") {
    await AudioSession.selectAudioOutput("default");
    return "earpiece";
  }
  const earpiece = outputs.find((o) => o === "earpiece");
  if (earpiece) {
    await AudioSession.selectAudioOutput(earpiece);
    return "earpiece";
  }
  return "earpiece";
}

export async function toggleCallAudioRoute(current: CallAudioRoute): Promise<CallAudioRoute> {
  const outputs = await listCallAudioOutputs();
  const hasBluetooth = outputs.includes("bluetooth");

  if (hasBluetooth) {
    if (current === "bluetooth") {
      if (Platform.OS === "ios") {
        await AudioSession.selectAudioOutput("force_speaker");
      } else {
        const speaker = outputs.find((o) => o === "speaker");
        if (speaker) await AudioSession.selectAudioOutput(speaker);
      }
      return "speaker";
    }
    await AudioSession.selectAudioOutput("bluetooth");
    return "bluetooth";
  }

  if (current === "speaker") {
    if (Platform.OS === "ios") {
      await AudioSession.selectAudioOutput("default");
    } else {
      const earpiece = outputs.find((o) => o === "earpiece");
      if (earpiece) await AudioSession.selectAudioOutput(earpiece);
    }
    return "earpiece";
  }

  if (Platform.OS === "ios") {
    await AudioSession.selectAudioOutput("force_speaker");
  } else {
    const speaker = outputs.find((o) => o === "speaker");
    if (speaker) await AudioSession.selectAudioOutput(speaker);
  }
  return "speaker";
}

export function callAudioRouteIcon(route: CallAudioRoute): keyof typeof Ionicons.glyphMap {
  if (route === "bluetooth") return "bluetooth";
  return "volume-high";
}
