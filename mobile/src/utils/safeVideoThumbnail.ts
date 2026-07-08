import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { ensureLocalFileUri } from "./mediaLocalUri";

type ThumbnailOptions = {
  time?: number;
  quality?: number;
};

const THUMB_UPLOAD_TIMEOUT_MS = 6000;

/**
 * Android's MediaMetadataRetriever (used by expo-video-thumbnails) can hard-crash
 * on remote/http sources. Only generate thumbnails for on-device media URIs.
 */
export function canGenerateNativeVideoThumbnail(uri: string | null | undefined): boolean {
  const value = String(uri || "").trim();
  if (!value || Platform.OS === "web") return false;

  const lower = value.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return false;
  if (lower.startsWith("blob:") || lower.startsWith("data:")) return false;

  if (lower.startsWith("file://") || lower.startsWith("content://")) return true;
  if (Platform.OS === "ios" && (lower.startsWith("ph://") || lower.startsWith("assets-library://"))) {
    return true;
  }

  if (!value.includes("://") && (value.startsWith("/") || /^[a-z]:[\\/]/i.test(value))) {
    return true;
  }

  return false;
}

export async function getNativeVideoThumbnail(
  uri: string | null | undefined,
  options: ThumbnailOptions = {}
): Promise<{ uri: string } | null> {
  const source = String(uri || "").trim();
  if (!canGenerateNativeVideoThumbnail(source)) return null;

  try {
    const localSource = await ensureLocalFileUri(source, ".mp4");
    return await VideoThumbnails.getThumbnailAsync(localSource, {
      time: options.time ?? 400,
      quality: options.quality ?? 0.72
    });
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => {
      setTimeout(() => resolve(undefined), ms);
    })
  ]);
}

/** Best-effort still frame upload for new reels/posts. Returns undefined when extraction fails. */
export async function uploadVideoThumbnailFromUri(
  videoUri: string,
  uploadImage: (fileUri: string) => Promise<{ url?: string | null }>
): Promise<string | undefined> {
  const attempts: ThumbnailOptions[] = [
    { time: 0, quality: 0.72 },
    { time: 400, quality: 0.72 },
    { time: 1000, quality: 0.65 },
    { time: 2000, quality: 0.5 }
  ];

  const task = (async () => {
    for (const options of attempts) {
      try {
        const thumb = await getNativeVideoThumbnail(videoUri, options);
        if (!thumb?.uri) continue;
        const { url } = await uploadImage(thumb.uri);
        if (url) return url;
      } catch {
        /* try next frame */
      }
    }
    return undefined;
  })();

  return withTimeout(task, THUMB_UPLOAD_TIMEOUT_MS);
}
