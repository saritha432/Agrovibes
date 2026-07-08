import * as FileSystem from "expo-file-system";

/** Copy gallery/camera URIs to a real file path so upload + thumbnails work on Android. */
export async function ensureLocalFileUri(uri: string, ext = ".mp4"): Promise<string> {
  const value = String(uri || "").trim();
  if (!value) return value;

  const lower = value.toLowerCase();
  if (
    lower.startsWith("file://") ||
    (!value.includes("://") && (value.startsWith("/") || /^[a-z]:[\\/]/i.test(value)))
  ) {
    return value;
  }

  if (lower.startsWith("content://") || lower.startsWith("ph://") || lower.startsWith("assets-library://")) {
    const dest = `${FileSystem.cacheDirectory}cv-local-${Date.now()}${ext}`;
    await FileSystem.copyAsync({ from: value, to: dest });
    return dest;
  }

  return value;
}
