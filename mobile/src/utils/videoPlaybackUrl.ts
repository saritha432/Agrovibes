import { Platform } from "react-native";

export type ExpoAvVideoSource = {
  uri: string;
  overrideFileExtensionAndroid?: string;
  headers?: Record<string, string>;
};

export type VideoPlayerSource = ExpoAvVideoSource;

/** Android cleartext is blocked; older rows may still store http:// URLs that work in desktop Chrome. */
export function normalizeVideoPlaybackUri(url: string | undefined | null): string {
  const input = String(url || "").trim();
  if (/^http:\/\//i.test(input)) return `https://${input.slice(7)}`;
  return input;
}

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
  const input = normalizeVideoPlaybackUri(url);
  if (!input) return [];
  const hls = normalizeVideoPlaybackUri(hlsUrl);
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
  return videoPlaybackSources(url, hlsUrl)[0] || normalizeVideoPlaybackUri(url);
}

/**
 * ExoPlayer infers type from the URL path. Signed CDN keys and .mov files often have
 * no usable extension, so the same clip plays in a browser and fails on Android.
 */
export function expoAvVideoSource(url: string | undefined | null): ExpoAvVideoSource {
  const uri = normalizeVideoPlaybackUri(url);
  const path = uri.split("?")[0].split("#")[0].toLowerCase();
  let overrideFileExtensionAndroid = "mp4";
  if (/\.m3u8$/i.test(path)) overrideFileExtensionAndroid = "m3u8";
  else if (/\.webm$/i.test(path)) overrideFileExtensionAndroid = "webm";
  const source: ExpoAvVideoSource = { uri, overrideFileExtensionAndroid };
  if (Platform.OS !== "web") {
    source.headers = { Accept: "*/*" };
  }
  return source;
}

export const videoPlayerSource = expoAvVideoSource;

/** Audio-focus / network blips must not mark a reel as permanently unavailable. */
export function isTransientVideoPlaybackError(error: unknown): boolean {
  const msg = String(error ?? "");
  return /AudioFocusNotAcquired|audio.?focus|staysActiveInBackground|background|not yet loaded|Player is not loaded|Trying to play a sound|INTERRUPTION|timeout|TIMED_OUT|HttpDataSource|Unable to connect|UnknownHost|NETWORK|socket|ECONNRESET|ENETUNREACH|502|503|429/i.test(
    msg
  );
}

export function nextVideoErrorAction(
  error: unknown,
  sourceIndex: number,
  sourceCount: number
): "ignore" | "next-source" {
  if (isTransientVideoPlaybackError(error)) return "ignore";
  if (sourceIndex + 1 < sourceCount) return "next-source";
  // Keep the same native player mounted — remounting during load is what flickers.
  return "ignore";
}
