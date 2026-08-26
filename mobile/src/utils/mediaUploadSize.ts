import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { MAX_MEDIA_UPLOAD_BYTES, MAX_MEDIA_UPLOAD_MB } from "../constants/uploadLimits";
import { isOversizedUploadVideo } from "./feedVideoLimits";

/** Incomplete MP4s from a failed compressor are often ~28 bytes (ftyp only). */
export const MIN_VALID_VIDEO_UPLOAD_BYTES = 80 * 1024;

export function videoTooLargeError(actualBytes: number) {
  const mb = actualBytes / (1024 * 1024);
  return `Video is ${mb.toFixed(1)}MB. Maximum upload size is ${MAX_MEDIA_UPLOAD_MB}MB.`;
}

export function videoTooSmallError(actualBytes: number) {
  return `Video file looks incomplete (${Math.max(0, actualBytes)} bytes). Please try recording or picking the video again.`;
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

async function readFileBytes(fileUri: string): Promise<number> {
  const uri = String(fileUri || "").trim();
  if (!uri) return 0;
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return blob.size;
  }
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) return 0;
  return (info as { size?: number }).size ?? 0;
}

/** Blocks upload before calling the API when the file is over/under size limits. */
export async function assertVideoUnderUploadLimit(fileUri: string): Promise<void> {
  const bytes = await readFileBytes(fileUri);
  if (bytes > 0 && bytes < MIN_VALID_VIDEO_UPLOAD_BYTES) {
    throw new Error(videoTooSmallError(bytes));
  }
  if (bytes > 0 && bytes > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error(videoTooLargeError(bytes));
  }
}
