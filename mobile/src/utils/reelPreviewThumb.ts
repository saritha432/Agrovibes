import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import type { HomePost } from "../services/api";
import { videoPlaybackUrl } from "./videoPlaybackUrl";

const PREVIEW_CACHE_MAX = 80;
const previewCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

function canGenerateVideoThumbnail(uri: string): boolean {
  const trimmed = String(uri || "").trim();
  if (!trimmed) return false;
  // Android MediaMetadataRetriever often native-crashes on remote URLs (setDataSource 0x80000000).
  if (Platform.OS === "android" && /^https?:\/\//i.test(trimmed)) return false;
  return trimmed.startsWith("file://") || trimmed.startsWith("content://");
}

function cacheSet(key: string, uri: string) {
  if (previewCache.size >= PREVIEW_CACHE_MAX && !previewCache.has(key)) {
    const oldest = previewCache.keys().next().value;
    if (oldest) previewCache.delete(oldest);
  }
  previewCache.set(key, uri);
}

export function clearReelPreviewCache() {
  previewCache.clear();
  inFlight.clear();
}

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

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  if (Platform.OS === "web") return null;

  const playbackUri = videoPlaybackUrl(video);
  if (!canGenerateVideoThumbnail(playbackUri)) return null;

  const task = (async () => {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(playbackUri, {
        time: 600,
        quality: 0.78
      });
      cacheSet(cacheKey, uri);
      return uri;
    } catch {
      return null;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, task);
  return task;
}

/** Generate missing reel stills with a small concurrency cap (grid screens). */
export async function hydrateReelPreviews(
  posts: HomePost[],
  onResolved: (postId: number, uri: string) => void,
  options?: { maxConcurrent?: number; isCancelled?: () => boolean }
): Promise<void> {
  const maxConcurrent = Math.max(1, options?.maxConcurrent ?? 2);
  const isCancelled = options?.isCancelled ?? (() => false);
  const queue = posts.filter((post) => String(post.videoUrl || "").trim() && !staticReelPreviewUri(post));

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      if (isCancelled()) return;
      const post = queue[cursor++];
      const uri = await resolveReelPreviewUri(post);
      if (!uri || isCancelled()) continue;
      onResolved(post.id, uri);
    }
  };

  await Promise.all(Array.from({ length: Math.min(maxConcurrent, queue.length || 1) }, () => worker()));
}
