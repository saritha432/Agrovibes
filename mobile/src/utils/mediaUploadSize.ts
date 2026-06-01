import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { MAX_MEDIA_UPLOAD_BYTES, MAX_MEDIA_UPLOAD_MB } from "../constants/uploadLimits";

export function videoTooLargeError(actualBytes: number) {
  const mb = actualBytes / (1024 * 1024);
  return `Video is ${mb.toFixed(1)}MB. Maximum upload size is ${MAX_MEDIA_UPLOAD_MB}MB.`;
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
