import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import type { HomePost } from "../services/api";
import { videoPlaybackUrl } from "./videoPlaybackUrl";

const previewCache = new Map<string, string>();

export function staticReelPreviewUri(post: HomePost): string | null {
  const thumb = String(post.thumbnailUrl || "").trim();
  if (thumb) return thumb;
  const img = String(post.imageUrl || "").trim() || String(post.imageUrls?.[0] || "").trim();
  return img || null;
}

export async function resolveReelPreviewUri(post: HomePost): Promise<string | null> {
  const staticUri = staticReelPreviewUri(post);
  if (staticUri) return staticUri;

  const video = String(post.videoUrl || "").trim();
  if (!video) return null;

  const cacheKey = `post:${post.id}:${video}`;
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  if (Platform.OS === "web") return null;

  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoPlaybackUrl(video), {
      time: 600,
      quality: 0.78
    });
    previewCache.set(cacheKey, uri);
    return uri;
  } catch {
    return null;
  }
}
