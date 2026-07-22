import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

/** Max long edge for post/story images uploaded to the server (feed-friendly). */
export const MAX_POST_IMAGE_EDGE_PX = 1440;
/** Max long edge for profile avatars. */
export const MAX_PROFILE_IMAGE_EDGE_PX = 720;
const WEBP_QUALITY = 0.72;

type PreparedImage = { uri: string; mime: string; filename: string };

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

function resizeActionsForMaxEdge(width: number, height: number, maxEdge: number): ImageManipulator.Action[] {
  const w = Math.abs(width) || 0;
  const h = Math.abs(height) || 0;
  if (!w || !h || Math.max(w, h) <= maxEdge) return [];
  if (w >= h) return [{ resize: { width: maxEdge } }];
  return [{ resize: { height: maxEdge } }];
}

/**
 * Compress + convert still images to WebP before upload.
 * User content policy: profile/posts → WebP, videos handled separately as MP4.
 */
export async function prepareImageForUpload(
  fileUri: string,
  options?: { maxEdge?: number; format?: "webp" | "jpeg" }
): Promise<PreparedImage> {
  const trimmed = String(fileUri || "").trim();
  if (!trimmed) throw new Error("Missing image uri");

  const maxEdge = options?.maxEdge ?? MAX_POST_IMAGE_EDGE_PX;
  const useWebp = options?.format !== "jpeg";
  const ext = useWebp ? "webp" : "jpg";
  const mime = useWebp ? "image/webp" : "image/jpeg";

  try {
    const { width, height } = await imageSize(trimmed);
    const actions = resizeActionsForMaxEdge(width, height, maxEdge);
    const result = await ImageManipulator.manipulateAsync(trimmed, actions, {
      compress: WEBP_QUALITY,
      format: useWebp ? ImageManipulator.SaveFormat.WEBP : ImageManipulator.SaveFormat.JPEG
    });
    return {
      uri: result.uri,
      mime,
      filename: `image-${Date.now()}.${ext}`
    };
  } catch {
    return {
      uri: trimmed,
      mime,
      filename: `image-${Date.now()}.${ext}`
    };
  }
}

export function prepareProfileImageForUpload(fileUri: string) {
  return prepareImageForUpload(fileUri, { maxEdge: MAX_PROFILE_IMAGE_EDGE_PX, format: "webp" });
}
