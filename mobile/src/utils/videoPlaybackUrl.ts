import { Platform } from "react-native";

/**
 * Playback source list.
 * Prefer progressive MP4 first — HLS start can stall for seconds (playlist + segments)
 * and a failed HLS attempt before MP4 fallback makes reels feel "slow" or blank.
 * Keep HLS as secondary on native when available.
 */
export function videoPlaybackSources(
  url: string | undefined | null,
  hlsUrl?: string | undefined | null
): string[] {
  const input = String(url || "").trim();
  if (!input) return [];
  const hls = String(hlsUrl || "").trim();
  const hlsOk = !!hls && /\.m3u8(\?|#|$)/i.test(hls);
  if (hlsOk && Platform.OS !== "web" && input !== hls) {
    return [input, hls];
  }
  return [input];
}

export function videoPlaybackUrl(
  url: string | undefined | null,
  hlsUrl?: string | undefined | null
): string {
  return videoPlaybackSources(url, hlsUrl)[0] || String(url || "").trim();
}
