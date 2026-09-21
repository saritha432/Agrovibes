import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import type { HomePost } from "../services/api";
import { getNativeVideoThumbnail } from "./safeVideoThumbnail";
import { videoPlaybackUrl } from "./videoPlaybackUrl";

const PREVIEW_CACHE_MAX = 200;
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

function stableStillPath(cacheFileId: string | number): string | null {
  const base = FileSystem.cacheDirectory;
  if (!base) return null;
  const id = String(cacheFileId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "v";
  return `${base}cv-still-${id}.jpg`;
}

/**
 * expo-video-thumbnails writes into a shared cache folder that can be purged as more
 * stills are generated — earlier Image URIs then go blank. Copy to a stable per-id path.
 */
async function persistStillUri(
  tempUri: string,
  cacheFileId?: string | number
): Promise<string> {
  if (cacheFileId == null) return tempUri;
  const dest = stableStillPath(cacheFileId);
  if (!dest) return tempUri;
  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) {
      // Refresh if we have a newer temp frame.
      try {
        await FileSystem.deleteAsync(dest, { idempotent: true });
      } catch {
        return dest;
      }
    }
    await FileSystem.copyAsync({ from: tempUri, to: dest });
    return dest;
  } catch {
    return tempUri;
  }
}

async function readPersistedStill(cacheFileId?: string | number): Promise<string | null> {
  if (cacheFileId == null) return null;
  const dest = stableStillPath(cacheFileId);
  if (!dest) return null;
  try {
    const info = await FileSystem.getInfoAsync(dest);
    return info.exists ? dest : null;
  } catch {
    return null;
  }
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

/**
 * Extract a still from a local or remote video.
 * Android MediaMetadataRetriever crashes on remote URLs, so we download first.
 * Always persist the resulting JPEG under a stable per-post path.
 */
async function extractVideoStillUri(
  playback: string,
  options: { time?: number; quality?: number; cacheFileId?: string | number } = {}
): Promise<string | null> {
  if (!playback || Platform.OS === "web") return null;
  const time = options.time ?? 600;
  const quality = options.quality ?? 0.72;

  const existing = await readPersistedStill(options.cacheFileId);
  if (existing) return existing;

  const finalize = async (tempUri: string | null | undefined) => {
    if (!tempUri) return null;
    return persistStillUri(tempUri, options.cacheFileId);
  };

  const localThumb = await getNativeVideoThumbnail(playback, { time, quality });
  if (localThumb?.uri) return finalize(localThumb.uri);

  if (!/^https?:\/\//i.test(playback)) return null;

  if (Platform.OS === "ios") {
    try {
      const thumb = await VideoThumbnails.getThumbnailAsync(playback, { time, quality });
      if (thumb?.uri) return finalize(thumb.uri);
    } catch {
      // fall through to download path
    }
  }

  // Android (and iOS fallback): download a short-lived local copy, then extract.
  try {
    const idRaw = options.cacheFileId != null ? String(options.cacheFileId) : String(Math.abs(playback.length));
    const id = idRaw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "v";
    const dest = `${FileSystem.cacheDirectory}cv-reel-vid-${id}.mp4`;
    const info = await FileSystem.getInfoAsync(dest);
    const localUri = info.exists ? dest : (await FileSystem.downloadAsync(playback, dest)).uri;
    const thumb = await VideoThumbnails.getThumbnailAsync(localUri, {
      time,
      quality: Platform.OS === "android" ? Math.min(quality, 0.65) : quality
    });
    if (thumb?.uri) return finalize(thumb.uri);
  } catch {
    // ignore
  }

  return null;
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
    const uri = await extractVideoStillUri(playback, {
      time: 600,
      quality: 0.72,
      cacheFileId: postId && postId > 0 ? `n${postId}` : undefined
    });
    if (uri) {
      cacheSet(cacheKey, uri);
      return uri;
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
      const uri = await extractVideoStillUri(playbackUri, {
        time: 600,
        quality: 0.78,
        cacheFileId: post.id > 0 ? post.id : undefined
      });
      if (!uri) {
        skippedPreviewKeys.add(cacheKey);
        return null;
      }
      cacheSet(cacheKey, uri);
      return uri;
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
