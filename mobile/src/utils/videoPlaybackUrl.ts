import { Platform } from "react-native";

/**
 * Playback source list. Prefer HLS (.m3u8) on native when available; keep MP4 as fallback.
 * Web keeps progressive MP4 for broader browser support.
 */
export function videoPlaybackSources(
  url: string | undefined | null,
  hlsUrl?: string | undefined | null
): string[] {
  const input = String(url || "").trim();
  if (!input) return [];
  const hls = String(hlsUrl || "").trim();
  const hlsOk = !!hls && /\.m3u8(\?|#|$)/i.test(hls);
  if (hlsOk && Platform.OS !== "web") {
    return input && input !== hls ? [hls, input] : [hls];
  }
  return [input];
}

export function videoPlaybackUrl(
  url: string | undefined | null,
  hlsUrl?: string | undefined | null
): string {
  return videoPlaybackSources(url, hlsUrl)[0] || String(url || "").trim();
}
