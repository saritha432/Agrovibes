import { Platform } from "react-native";
import type { AppPlaybackStatus } from "./videoPlaybackStatus";

/**
 * Soft limit for feed playback warnings.
 * Do NOT hard-block above this — ProGuard-broken compressor in release used to
 * leave 4K originals, and hard-blocking made reels look like still images /
 * blank fullscreen. Let ExoPlayer try; OOM is rare on modern devices.
 */
export const MAX_FEED_VIDEO_EDGE_PX = 4096;

export function readVideoSizeFromPlaybackStatus(status: AppPlaybackStatus): { width: number; height: number } {
  if (!status.isLoaded) return { width: 0, height: 0 };
  const raw = status as AppPlaybackStatus & {
    width?: number;
    height?: number;
    naturalSize?: { width: number; height: number };
  };
  return {
    width: Number(raw.naturalSize?.width ?? raw.width ?? 0),
    height: Number(raw.naturalSize?.height ?? raw.height ?? 0)
  };
}

/** Kept for callers; currently never blocks so release builds keep playing. */
export function isOversizedFeedVideo(width: number, height: number): boolean {
  if (Platform.OS === "web") return false;
  const w = Math.abs(Number(width) || 0);
  const h = Math.abs(Number(height) || 0);
  if (w <= 0 || h <= 0) return false;
  // Soft warn only — hard-block caused blank reels when compression failed in release.
  if (Math.max(w, h) > MAX_FEED_VIDEO_EDGE_PX) {
    console.warn(`[Cropvibe Video] large frame ${w}x${h}, still attempting playback`);
  }
  return false;
}

export function isOversizedUploadVideo(width: number, height: number): boolean {
  const w = Math.abs(Number(width) || 0);
  const h = Math.abs(Number(height) || 0);
  if (w <= 0 || h <= 0) return false;
  return Math.max(w, h) > MAX_FEED_VIDEO_EDGE_PX;
}
