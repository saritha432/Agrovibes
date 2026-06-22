import { Platform } from "react-native";
import type { AVPlaybackStatus } from "expo-av";

/** Max long edge for in-app feed/reel playback on native (4K decoders often OOM on Android). */
export const MAX_FEED_VIDEO_EDGE_PX = 1920;

export function readVideoSizeFromPlaybackStatus(status: AVPlaybackStatus): { width: number; height: number } {
  if (!status.isLoaded) return { width: 0, height: 0 };
  const raw = status as AVPlaybackStatus & {
    width?: number;
    height?: number;
    naturalSize?: { width: number; height: number };
  };
  return {
    width: Number(raw.naturalSize?.width ?? raw.width ?? 0),
    height: Number(raw.naturalSize?.height ?? raw.height ?? 0)
  };
}

export function isOversizedFeedVideo(width: number, height: number): boolean {
  if (Platform.OS === "web") return false;
  const w = Math.abs(Number(width) || 0);
  const h = Math.abs(Number(height) || 0);
  if (w <= 0 || h <= 0) return false;
  return Math.max(w, h) > MAX_FEED_VIDEO_EDGE_PX;
}

export function isOversizedUploadVideo(width: number, height: number): boolean {
  const w = Math.abs(Number(width) || 0);
  const h = Math.abs(Number(height) || 0);
  if (w <= 0 || h <= 0) return false;
  return Math.max(w, h) > MAX_FEED_VIDEO_EDGE_PX;
}
