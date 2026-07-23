import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

/** Max long edge for uploaded feed/reel videos (portrait height or landscape width). */
export const MAX_UPLOAD_VIDEO_EDGE_PX = 720;
/** Target bitrate ~2 Mbps — feed-friendly without looking heavily compressed. */
export const UPLOAD_VIDEO_BITRATE = 2_000_000;
/** Skip compression for already-small clips (bytes). */
export const MIN_BYTES_TO_COMPRESS = 3 * 1024 * 1024;

export type PreparedVideo = {
  uri: string;
  mime: string;
  filename: string;
  compressed: boolean;
};

async function fileSizeBytes(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists) return 0;
    return Number((info as { size?: number }).size ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * Compress native videos to ~720p / ~2 Mbps before upload.
 * Falls back to the original file on web, Expo Go (no native module), or any failure.
 */
export async function prepareVideoForUpload(
  fileUri: string,
  options?: { width?: number; height?: number }
): Promise<PreparedVideo> {
  const trimmed = String(fileUri || "").trim();
  if (!trimmed) throw new Error("Missing video uri");

  const nameFromUri = trimmed.split("?")[0].match(/\.(mp4|mov|webm|m4v)$/i);
  const sourceExt = nameFromUri ? nameFromUri[0].toLowerCase() : ".mp4";
  const fallbackMime =
    sourceExt === ".webm"
      ? "video/webm"
      : sourceExt === ".mov"
        ? "video/quicktime"
        : sourceExt === ".m4v"
          ? "video/x-m4v"
          : "video/mp4";
  const fallback: PreparedVideo = {
    uri: trimmed,
    mime: fallbackMime,
    filename: `video-${Date.now()}${sourceExt}`,
    compressed: false
  };

  if (Platform.OS === "web") return fallback;

  const originalBytes = await fileSizeBytes(trimmed);
  const longEdge = Math.max(Number(options?.width) || 0, Number(options?.height) || 0);
  const alreadySmall =
    (originalBytes > 0 && originalBytes <= MIN_BYTES_TO_COMPRESS) &&
    (longEdge <= 0 || longEdge <= MAX_UPLOAD_VIDEO_EDGE_PX);
  if (alreadySmall) return fallback;

  try {
    // Native-only module; require lazily so web/Metro don't hard-fail.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Video } = require("react-native-compressor") as {
      Video: {
        compress: (
          url: string,
          opts?: {
            compressionMethod?: "auto" | "manual";
            maxSize?: number;
            bitrate?: number;
            minimumFileSizeForCompress?: number;
          }
        ) => Promise<string>;
      };
    };

    const compressedUri = await Video.compress(trimmed, {
      compressionMethod: "manual",
      maxSize: MAX_UPLOAD_VIDEO_EDGE_PX,
      bitrate: UPLOAD_VIDEO_BITRATE,
      minimumFileSizeForCompress: 0
    });

    const out = String(compressedUri || "").trim();
    if (!out || out === trimmed) return fallback;

    const compressedBytes = await fileSizeBytes(out);
    // Prefer original if compression somehow grew the file.
    if (originalBytes > 0 && compressedBytes > 0 && compressedBytes >= originalBytes) {
      return fallback;
    }

    return {
      uri: out,
      mime: "video/mp4",
      filename: `video-${Date.now()}.mp4`,
      compressed: true
    };
  } catch {
    return fallback;
  }
}
