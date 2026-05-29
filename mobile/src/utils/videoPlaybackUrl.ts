import { Platform } from "react-native";

/**
 * Native expo-av often fails on Cloudinary HLS (.m3u8). We try several MP4 URL shapes,
 * then fall back to the original URL (old APKs could play HLS on some devices).
 */
export function videoPlaybackSources(url: string | undefined | null): string[] {
  const input = String(url || "").trim();
  if (!input) return [];
  if (Platform.OS === "web") return [input];
  if (/supabase\.co\/storage\/v1\/object\/public\//i.test(input)) return [input];

  const candidates = new Set<string>();

  const add = (u: string) => {
    const t = u.trim();
    if (t) candidates.add(t);
  };

  const isCloudinaryVideo = /res\.cloudinary\.com/i.test(input) && /\/video\/upload\//i.test(input);
  if (isCloudinaryVideo) {
    // If the stored URL is a derived/transformed asset (can 401 on strict Cloudinary setups),
    // also try the original uploaded asset path without the transformation segment.
    const originalPath = input.replace(/\/video\/upload\/[^/]+\/(v\d+\/)/i, "/video/upload/$1");
    const transformedDetected = originalPath !== input;
    // Prefer original public asset first when transformed delivery is blocked.
    if (transformedDetected) add(originalPath);
    add(input);
    if (!transformedDetected) add(originalPath);
    if (/\.mp4($|\?)/i.test(originalPath)) {
      add(originalPath.replace(/\.mp4(?=\?|$)/i, ".m3u8"));
    } else if (/\.m3u8($|\?)/i.test(originalPath)) {
      add(originalPath.replace(/\.m3u8(?=\?|$)/i, ".mp4"));
    }
  } else {
    add(input);
  }

  if (isCloudinaryVideo && /\.m3u8($|\?)/i.test(input)) {
    add(
      input
        .replace(/\/video\/upload\/sp_auto[^/]*\//i, "/video/upload/c_limit,w_720,h_1280,vc_h264,ac_aac,br_1200k,q_auto:good,f_mp4/")
        .replace(/\.m3u8(?=\?|$)/i, ".mp4")
    );
    add(
      input.replace(/\/video\/upload\/sp_auto[^/]*\//i, "/video/upload/f_mp4/").replace(/\.m3u8(?=\?|$)/i, ".mp4")
    );
    add(input.replace(/\/video\/upload\/sp_auto[^/]*\//i, "/video/upload/").replace(/\.m3u8(?=\?|$)/i, ".mp4"));
  }

  // Keep insertion order: original URL first (old APK behavior), then fallbacks.
  return [...candidates];
}

/** Primary URL to try first (MP4 variants before HLS when applicable). */
export function videoPlaybackUrl(url: string | undefined | null): string {
  const sources = videoPlaybackSources(url);
  return sources[0] || String(url || "").trim();
}
