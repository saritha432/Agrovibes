import { Platform } from "react-native";
import type { HomePost } from "../services/api";
import { getNativeVideoThumbnail } from "./safeVideoThumbnail";
import { videoPlaybackUrl } from "./videoPlaybackUrl";

const previewCache = new Map<string, string>();
const skippedPreviewKeys = new Set<string>();

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
  if (skippedPreviewKeys.has(cacheKey)) return null;

  if (Platform.OS === "web") return null;

  const playbackSource = videoPlaybackUrl(video);
  const thumb = await getNativeVideoThumbnail(playbackSource, { time: 600, quality: 0.78 });
  if (!thumb?.uri) {
    skippedPreviewKeys.add(cacheKey);
    return null;
  }

  previewCache.set(cacheKey, thumb.uri);
  return thumb.uri;
}
