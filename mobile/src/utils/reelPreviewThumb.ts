import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import type { HomePost } from "../services/api";
import { getNativeVideoThumbnail } from "./safeVideoThumbnail";
import { videoPlaybackUrl } from "./videoPlaybackUrl";

const PREVIEW_CACHE_MAX = 80;
const previewCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
const skippedPreviewKeys = new Set<string>();

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
  skippedPreviewKeys.clear();
}

export function staticReelPreviewUri(post: HomePost): string | null {
  const thumb = String(post.thumbnailUrl || "").trim();
  if (thumb) return thumb;
  const img = String(post.imageUrl || "").trim() || String(post.imageUrls?.[0] || "").trim();
  return img || null;
}

/** One-off notification thumb: allows remote video on iOS; caches download on Android. */
export async function resolveNotificationVideoThumbnail(
  videoUrl: string | null | undefined,
  postId?: number
): Promise<string | null> {
  const source = String(videoUrl || "").trim();
  if (!source || Platform.OS === "web") return null;

  const playback = videoPlaybackUrl(source);
  const cacheKey = `notif:${postId ?? 0}:${playback}`;
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const task = (async () => {
    const localThumb = await getNativeVideoThumbnail(playback, { time: 600, quality: 0.72 });
    if (localThumb?.uri) {
      cacheSet(cacheKey, localThumb.uri);
      return localThumb.uri;
    }

    if (Platform.OS === "ios" && /^https?:\/\//i.test(playback)) {
      try {
        const thumb = await VideoThumbnails.getThumbnailAsync(playback, { time: 600, quality: 0.72 });
        if (thumb?.uri) {
          cacheSet(cacheKey, thumb.uri);
          return thumb.uri;
        }
      } catch {
        // fall through
      }
    }

    if (Platform.OS === "android" && /^https?:\/\//i.test(playback)) {
      try {
        const id = Number.isFinite(postId) && postId! > 0 ? postId : Math.abs(playback.length);
        const dest = `${FileSystem.cacheDirectory}cv-notif-${id}.mp4`;
        const info = await FileSystem.getInfoAsync(dest);
        const localUri = info.exists ? dest : (await FileSystem.downloadAsync(playback, dest)).uri;
        const thumb = await VideoThumbnails.getThumbnailAsync(localUri, { time: 600, quality: 0.65 });
        if (thumb?.uri) {
          cacheSet(cacheKey, thumb.uri);
          return thumb.uri;
        }
      } catch {
        // fall through
      }
    }

    skippedPreviewKeys.add(cacheKey);
    return null;
  })();

  inFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(cacheKey);
  }
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

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  if (Platform.OS === "web") return null;

  const playbackUri = videoPlaybackUrl(video);
  const task = (async () => {
    try {
      const thumb = await getNativeVideoThumbnail(playbackUri, { time: 600, quality: 0.78 });
      if (!thumb?.uri) {
        skippedPreviewKeys.add(cacheKey);
        return null;
      }
      cacheSet(cacheKey, thumb.uri);
      return thumb.uri;
    } catch {
      skippedPreviewKeys.add(cacheKey);
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
