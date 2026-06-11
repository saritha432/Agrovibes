import { Platform } from "react-native";

/** URLs stored in the DB are played as-is (Supabase public object URLs, etc.). */
export function videoPlaybackSources(url: string | undefined | null): string[] {
  const input = String(url || "").trim();
  if (!input) return [];
  if (Platform.OS === "web") return [input];
  return [input];
}

export function videoPlaybackUrl(url: string | undefined | null): string {
  return videoPlaybackSources(url)[0] || String(url || "").trim();
}
