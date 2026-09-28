import type { HomePost } from "../api/types";

/** Returns the stored media URL for HTML5 video (Supabase public URLs, etc.). */
export function resolveWebVideoUrl(raw: string | null | undefined): string | null {
  const input = String(raw || "").trim();
  return input || null;
}

export function isHlsPlaybackUri(url: string | null | undefined): boolean {
  return /\.m3u8(\?|#|$)/i.test(String(url || "").trim());
}

export function playbackSourceKind(url: string | null | undefined): "hls" | "mp4" | "original" {
  const uri = String(url || "").trim();
  if (isHlsPlaybackUri(uri)) return "hls";
  if (/\/agrovibes\/playback\//i.test(uri)) return "mp4";
  return "original";
}

/** Safari / iOS Chrome can play HLS natively; Chromium desktop cannot. */
export function webCanPlayNativeHls(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("video");
    const type = probe.canPlayType("application/vnd.apple.mpegURL");
    return type === "probably" || type === "maybe";
  } catch {
    return false;
  }
}

function pushUnique(list: string[], url: string | null | undefined) {
  const clean = resolveWebVideoUrl(url);
  if (!clean || list.includes(clean)) return;
  list.push(clean);
}

/**
 * HLS master first when the browser can play it, then 480p MP4, then original.
 * Chromium falls back to MP4 so playback does not wait on a failed .m3u8.
 */
export function resolveWebPostVideoSources(
  post: Pick<HomePost, "playbackUrl" | "hlsUrl" | "videoUrl">
): string[] {
  const sources: string[] = [];
  const hls = resolveWebVideoUrl(post.hlsUrl);
  const preferHls = !!hls && webCanPlayNativeHls();
  if (preferHls) pushUnique(sources, hls);
  pushUnique(sources, post.playbackUrl);
  if (!preferHls) pushUnique(sources, hls);
  pushUnique(sources, post.videoUrl);
  return sources;
}

export function resolveWebPostVideoUrl(
  post: Pick<HomePost, "playbackUrl" | "hlsUrl" | "videoUrl">
): string | null {
  return resolveWebPostVideoSources(post)[0] || null;
}
