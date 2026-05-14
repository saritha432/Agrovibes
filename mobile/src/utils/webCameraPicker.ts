/// <reference lib="dom" />
import type { ImagePickerAsset, ImagePickerResult } from "expo-image-picker";
import { CameraType, MediaTypeOptions } from "expo-image-picker";

const WEB_ACCEPT: Record<MediaTypeOptions, string> = {
  [MediaTypeOptions.All]: "video/mp4,video/quicktime,video/x-m4v,video/*,image/*",
  [MediaTypeOptions.Videos]: "video/mp4,video/quicktime,video/x-m4v,video/*",
  [MediaTypeOptions.Images]: "image/*"
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read captured media."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function probeImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve({ width: 0, height: 0 });
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

function probeVideoMeta(dataUrl: string): Promise<{ width: number; height: number; durationMs: number | null }> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve({ width: 0, height: 0, durationMs: null });
      return;
    }
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const width = v.videoWidth || 0;
      const height = v.videoHeight || 0;
      const durationMs = Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : null;
      v.removeAttribute("src");
      v.load();
      resolve({ width, height, durationMs });
    };
    v.onerror = () => resolve({ width: 0, height: 0, durationMs: null });
    v.src = dataUrl;
  });
}

async function fileToAsset(file: File): Promise<ImagePickerAsset> {
  const uri = await readFileAsDataUrl(file);
  const mimeType = file.type || undefined;
  const looksVideo = Boolean(mimeType?.startsWith("video/"));

  if (looksVideo) {
    const { width, height, durationMs } = await probeVideoMeta(uri);
    return {
      uri,
      width,
      height,
      mimeType,
      type: "video",
      duration: durationMs,
      fileName: file.name || null
    };
  }

  const { width, height } = await probeImageSize(uri);
  return {
    uri,
    width,
    height,
    mimeType,
    type: "image",
    fileName: file.name || null
  };
}

/**
 * Web: expo-image-picker's launchCameraAsync only sets capture="camera", so browsers ignore
 * front vs back. HTML Media Capture uses capture="user" | "environment" for facing.
 */
export function launchWebCameraAsyncWithFacing(options: {
  mediaTypes: MediaTypeOptions;
  cameraType: CameraType;
}): Promise<ImagePickerResult> {
  if (typeof document === "undefined") {
    return Promise.resolve({ canceled: true, assets: null });
  }

  const accept = WEB_ACCEPT[options.mediaTypes] ?? WEB_ACCEPT[MediaTypeOptions.Images];
  const captureFacing = options.cameraType === CameraType.front ? "user" : "environment";

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.style.display = "none";
    input.type = "file";
    input.setAttribute("accept", accept);
    input.setAttribute("capture", captureFacing);

    let settled = false;
    const finish = (result: ImagePickerResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      if (input.parentNode) input.parentNode.removeChild(input);
      resolve(result);
    };

    const onWindowFocus = () => {
      setTimeout(() => {
        if (settled) return;
        if (!input.files?.length) finish({ canceled: true, assets: null });
      }, 400);
    };

    input.addEventListener("change", () => {
      void (async () => {
        const file = input.files?.[0];
        if (!file) {
          finish({ canceled: true, assets: null });
          return;
        }
        try {
          const asset = await fileToAsset(file);
          finish({ canceled: false, assets: [asset] });
        } catch {
          finish({ canceled: true, assets: null });
        }
      })();
    });

    document.body.appendChild(input);
    window.addEventListener("focus", onWindowFocus);
    input.click();
  });
}
