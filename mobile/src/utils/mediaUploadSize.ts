import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { MAX_MEDIA_UPLOAD_BYTES, MAX_MEDIA_UPLOAD_MB } from "../constants/uploadLimits";
import { isOversizedUploadVideo } from "./feedVideoLimits";

export function videoTooLargeError(actualBytes: number) {
  const mb = actualBytes / (1024 * 1024);
  return `Video is ${mb.toFixed(1)}MB. Maximum upload size is ${MAX_MEDIA_UPLOAD_MB}MB.`;
}

export function videoResolutionTooLargeError(width: number, height: number) {
  return `Video is ${width}×${height}. Maximum allowed is 1920px on the longest side — use 1080p or lower.`;
}

/** Reject 4K+ uploads before they reach the feed (prevents decoder OOM on viewers). */
export function assertVideoResolutionWithinLimit(width?: number, height?: number): void {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w > 0 && h > 0 && isOversizedUploadVideo(w, h)) {
    throw new Error(videoResolutionTooLargeError(w, h));
  }
}

/** Blocks upload before calling Supabase when the file is over the limit. */
export async function assertVideoUnderUploadLimit(fileUri: string): Promise<void> {
  const uri = String(fileUri || "").trim();
  if (!uri) return;

  let bytes = 0;
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    bytes = blob.size;
  } else {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists) return;
    bytes = (info as { size?: number }).size ?? 0;
  }

  if (bytes > 0 && bytes > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error(videoTooLargeError(bytes));
  }
}
