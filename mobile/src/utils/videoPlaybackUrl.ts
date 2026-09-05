import { Platform } from "react-native";

export type ExpoAvVideoSource = {
  uri: string;
  overrideFileExtensionAndroid?: string;
  headers?: Record<string, string>;
};

export type VideoPlayerSource = ExpoAvVideoSource;

export type VideoPlaybackPost = {
  videoUrl?: string | null;
  hlsUrl?: string | null;
  playbackUrl?: string | null;
};

/** Android cleartext is blocked; older rows may still store http:// URLs that work in desktop Chrome. */
export function normalizeVideoPlaybackUri(url: string | undefined | null): string {
  const input = String(url || "").trim();
  if (/^http:\/\//i.test(input)) return `https://${input.slice(7)}`;
  return input;
}

function pushUnique(list: string[], url: string | undefined | null) {
  const clean = normalizeVideoPlaybackUri(url);
  if (!clean || list.includes(clean)) return;
  list.push(clean);
}

/**
 * Instagram-style start order:
 * 1. Fast-start 480p MP4 (moov at front) — first frame after a few hundred KB
 * 2. Native HLS — adaptive 240p+ when the small MP4 is not ready yet
 * 3. Original upload MP4 — last resort (often large)
 * Web skips HLS (Chrome has no native HLS in the expo-av video tag).
 */
export function videoPlaybackSources(
  url: string | undefined | null,
  hlsUrl?: string | undefined | null,
  playbackUrl?: string | undefined | null
): string[] {
  const sources: string[] = [];
  pushUnique(sources, playbackUrl);
  const hls = normalizeVideoPlaybackUri(hlsUrl);
  if (Platform.OS !== "web" && hls && /\.m3u8(\?|#|$)/i.test(hls)) {
    pushUnique(sources, hls);
  }
  pushUnique(sources, url);
  return sources;
}

export function videoPlaybackSourcesForPost(post: VideoPlaybackPost | null | undefined): string[] {
  if (!post) return [];
  return videoPlaybackSources(post.videoUrl, post.hlsUrl, post.playbackUrl);
}

export function videoPlaybackUrl(
  url: string | undefined | null,
  hlsUrl?: string | undefined | null,
  playbackUrl?: string | undefined | null
): string {
  return videoPlaybackSources(url, hlsUrl, playbackUrl)[0] || normalizeVideoPlaybackUri(url);
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
