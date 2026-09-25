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

type DirectVideoUploadTicket = {
  uploadUrl: string;
  headers?: Record<string, string>;
  url: string;
  path: string;
};

async function uploadVideoDirectToS3(file: File, filename: string): Promise<{ url: string } | null> {
  const ticketRes = await fetchWithRetry(
    `${API_BASE_URL}/v1/media/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        mimeType: file.type || "video/mp4",
        byteSize: file.size
      })
    },
    30_000
  );
  if (ticketRes.status === 409 || ticketRes.status === 503) return null;
  if (!ticketRes.ok) {
    if (ticketRes.status >= 500) return null;
    let detail = `Upload failed (${ticketRes.status})`;
    try {
      const body = (await ticketRes.json()) as { message?: string };
      if (body?.message) detail = body.message;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const ticket = (await ticketRes.json()) as DirectVideoUploadTicket;
  if (!ticket?.uploadUrl || !ticket?.path) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  try {
    const putRes = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.headers || { "Content-Type": file.type || "video/mp4" },
      body: file,
      signal: controller.signal
    });
    if (!putRes.ok) {
      throw new Error(`Direct upload failed (${putRes.status})`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error || "");
    if (/aborted|abort|timed out|timeout/i.test(msg)) {
      throw new Error("Upload timed out. Check internet speed and try a smaller video.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  try {
    const completeRes = await fetchWithRetry(
      `${API_BASE_URL}/v1/media/upload-complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ticket.path })
      },
      30_000
    );
    if (completeRes.ok) {
      const done = (await completeRes.json()) as { url?: string };
      if (done?.url) return { url: done.url };
    }
  } catch {
    // Public object URL still works if finalize is delayed.
  }
  return { url: ticket.url };
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
  const filename = `video-${Date.now()}${ext.toLowerCase()}`;
  try {
    const direct = await uploadVideoDirectToS3(file, filename);
    if (direct?.url) return direct;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error || "");
    if (/timed out|maximum upload size|incomplete/i.test(msg)) throw error;
  }
  return uploadBlob(file, filename);
}

export async function uploadAudioFile(file: File | Blob, ext = ".m4a") {
  const suffix = ext.startsWith(".") ? ext : `.${ext}`;
  const name = file instanceof File && file.name ? file.name : `voice-${Date.now()}${suffix}`;
  return uploadBlob(file, name);
}

export async function uploadPickedMedia(file: File, meta?: PickerAssetMeta | null) {
  return shouldUseImageUpload(file, meta) ? uploadImageFile(file) : uploadVideoFile(file);
}
