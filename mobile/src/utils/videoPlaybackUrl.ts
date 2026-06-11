import { Platform } from "react-native";

/**
 * TEMP while Supabase billing inactive: fallback sample reels when storage returns 402.
 * RESTORE WHEN SUPABASE PAID — set to false (or comment out the fallback block below).
 */
const APK_TEST_SUPABASE_VIDEO_FALLBACK = true;

const APK_TEST_FALLBACK_VIDEOS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
];

function fallbackIndexForUrl(url: string): number {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % APK_TEST_FALLBACK_VIDEOS.length;
}

/** URLs stored in the DB are played as-is (Supabase public object URLs, etc.). */
export function videoPlaybackSources(url: string | undefined | null): string[] {
  const input = String(url || "").trim();
  if (!input) return [];

  const sources = [input];

  // RESTORE WHEN SUPABASE PAID — comment out fallback block below (set APK_TEST_SUPABASE_VIDEO_FALLBACK = false).
  if (
    APK_TEST_SUPABASE_VIDEO_FALLBACK &&
    /supabase\.co\/storage/i.test(input) &&
    APK_TEST_FALLBACK_VIDEOS.length > 0
  ) {
    sources.push(APK_TEST_FALLBACK_VIDEOS[fallbackIndexForUrl(input)]!);
  }

  if (Platform.OS === "web") return sources;
  return sources;
}

export function videoPlaybackUrl(url: string | undefined | null): string {
  return videoPlaybackSources(url)[0] || String(url || "").trim();
}
