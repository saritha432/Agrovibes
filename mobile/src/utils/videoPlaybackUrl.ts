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

/** Derive MediaConvert outputs from the original S3/CloudFront upload URL when API rows are stale. */
export function inferTranscodedUrlsFromVideoUrl(videoUrl: string | undefined | null): {
  playbackUrl?: string;
  hlsUrl?: string;
} {
  const uri = normalizeVideoPlaybackUri(videoUrl);
  const match = uri.match(/^(https?:\/\/[^/]+)\/agrovibes\/videos\/([^/?#]+)\.(mp4|mov|m4v|webm)$/i);
  if (!match) return {};
  const origin = match[1];
  const stem = match[2];
  return {
    playbackUrl: `${origin}/agrovibes/playback/${stem}.mp4`,
    hlsUrl: `${origin}/agrovibes/hls/${stem}/master.m3u8`
  };
}

/**
 * Instagram-style start order:
 * 1. Fast-start 480p MP4 (moov at front)
 * 2. Native HLS — adaptive ladder (Main profile, device-friendly)
 * 3. Original upload MP4 — last resort
 *
 * Inferred playback/HLS paths are only added when the API already has at least one
 * transcode URL (job completed). Otherwise we play the original directly — guessing
 * CloudFront paths that were never created causes 403 loops and blocks playback.
 */
export function videoPlaybackSources(
  url: string | undefined | null,
  hlsUrl?: string | undefined | null,
  playbackUrl?: string | undefined | null
): string[] {
  const apiPlayback = normalizeVideoPlaybackUri(playbackUrl);
  const apiHls = normalizeVideoPlaybackUri(hlsUrl);
  const hasApiTranscode = Boolean(apiPlayback || apiHls);
  const inferred = hasApiTranscode ? inferTranscodedUrlsFromVideoUrl(url) : {};

  const sources: string[] = [];
  pushUnique(sources, apiPlayback);
  pushUnique(sources, inferred.playbackUrl);
  const hls = apiHls || normalizeVideoPlaybackUri(inferred.hlsUrl);
  const hasHls = Platform.OS !== "web" && !!hls && /\.m3u8(\?|#|$)/i.test(hls);
  if (hasHls) {
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

/** HTTP 403/404 on a CDN URL — transcoded file likely missing or not public yet. */
export function isMissingMediaUrlError(error: unknown): boolean {
  const msg = String(error ?? "");
  return /InvalidResponseCodeException|Response code: 403|Response code: 404|404|403 Forbidden/i.test(msg);
}

/** ExoPlayer hardware H.264 decoder failed (common on 1080p High Profile uploads). */
export function isHardwareDecoderError(error: unknown): boolean {
  const msg = String(error ?? "");
  return /MediaCodec|DecoderInitialization|Decoder init failed|c2\.qti\.avc|OMX\.|avc1\.|HEVC|h264/i.test(msg);
}

export function nextVideoErrorAction(
  error: unknown,
  sourceIndex: number,
  sourceCount: number
): "ignore" | "next-source" {
  // Try every fallback URL before giving up (480p MP4 → HLS → original).
  if (sourceIndex + 1 < sourceCount) return "next-source";
  if (isTransientVideoPlaybackError(error)) return "ignore";
  return "ignore";
}
