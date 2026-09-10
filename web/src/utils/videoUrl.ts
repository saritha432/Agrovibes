import type { HomePost } from "../api/types";

/** Returns the stored media URL for HTML5 video (Supabase public URLs, etc.). */
export function resolveWebVideoUrl(raw: string | null | undefined): string | null {
  const input = String(raw || "").trim();
  return input || null;
}

/** Prefer transcoded playback URL, then HLS, then original upload (matches mobile order). */
export function resolveWebPostVideoUrl(
  post: Pick<HomePost, "playbackUrl" | "hlsUrl" | "videoUrl">
): string | null {
  return (
    resolveWebVideoUrl(post.playbackUrl) ||
    resolveWebVideoUrl(post.hlsUrl) ||
    resolveWebVideoUrl(post.videoUrl)
  );
}
