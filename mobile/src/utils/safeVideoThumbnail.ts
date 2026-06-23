import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";

type ThumbnailOptions = {
  time?: number;
  quality?: number;
};

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

  // Local absolute paths (cache / recordings without a file:// prefix).
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
    return await VideoThumbnails.getThumbnailAsync(source, {
      time: options.time ?? 400,
      quality: options.quality ?? 0.72
    });
  } catch {
    return null;
  }
}
