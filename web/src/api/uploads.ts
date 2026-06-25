import { API_BASE_URL, fetchWithRetry } from "./client";

export type PickerAssetMeta = {
  type?: string | null;
  mimeType?: string | null;
  name?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

export function shouldUseImageUpload(file: File, meta?: PickerAssetMeta | null): boolean {
  const mime = (meta?.mimeType || meta?.type || file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (mime.startsWith("video/")) return false;
  if (mime.startsWith("audio/")) return false;
  const name = file.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i.test(name)) return true;
  if (/\.(mp4|mov|webm|m4v)$/i.test(name)) return false;
  return true;
}

async function uploadBlob(file: File | Blob, filename: string) {
  const form = new FormData();
  form.append("file", file, filename);
  const uploadRes = await fetchWithRetry(
    `${API_BASE_URL}/v1/media/upload`,
    { method: "POST", body: form },
    120_000
  );
  if (!uploadRes.ok) {
    let detail = `Upload failed (${uploadRes.status})`;
    try {
      const body = (await uploadRes.json()) as { message?: string; error?: string; hint?: string };
      const msg = body?.error || body?.message;
      if (msg) detail = `${msg}${body?.hint ? ` (${body.hint})` : ""}`;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const uploaded = (await uploadRes.json()) as { url?: string };
  if (!uploaded.url) throw new Error("Upload response missing URL");
  return { url: uploaded.url };
}

export async function uploadImageFile(file: File) {
  const ext = file.name.match(/\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i)?.[0] || ".jpg";
  return uploadBlob(file, `image-${Date.now()}${ext.toLowerCase()}`);
}

export async function uploadVideoFile(file: File) {
  const ext = file.name.match(/\.(mp4|mov|webm|m4v)$/i)?.[0] || ".mp4";
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("Maximum upload size is 50MB. Use a shorter clip or lower resolution.");
  }
  return uploadBlob(file, `video-${Date.now()}${ext.toLowerCase()}`);
}

export async function uploadAudioFile(file: File | Blob, ext = ".m4a") {
  return uploadBlob(file, `audio-${Date.now()}${ext}`);
}

export async function uploadPickedMedia(file: File, meta?: PickerAssetMeta | null) {
  return shouldUseImageUpload(file, meta) ? uploadImageFile(file) : uploadVideoFile(file);
}
