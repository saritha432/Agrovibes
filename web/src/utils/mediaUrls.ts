import type { HomePost } from "../api/types";

function stripLegacyCloudinaryUrl(url: string | null | undefined): string | undefined {
  const input = String(url || "").trim();
  if (!input) return undefined;
  if (/res\.cloudinary\.com/i.test(input)) return undefined;
  return input;
}

export function sanitizeHomePost(post: HomePost): HomePost {
  return {
    ...post,
    videoUrl: stripLegacyCloudinaryUrl(post.videoUrl) ?? undefined,
    hlsUrl: stripLegacyCloudinaryUrl(post.hlsUrl) ?? undefined,
    playbackUrl: stripLegacyCloudinaryUrl(post.playbackUrl) ?? undefined,
    musicAudioUrl: stripLegacyCloudinaryUrl(post.musicAudioUrl) ?? undefined
  };
}
