import { useWindowDimensions } from "react-native";
import type { HomePost, HomeStory } from "../services/api";

/** Ignore dead Cloudinary URLs (account disabled → 401). */
export function stripLegacyCloudinaryUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  const u = String(url).trim();
  if (!u || /res\.cloudinary\.com/i.test(u)) return null;
  return u;
}

/**
 * Resize a Supabase Storage image URL to a given pixel width using its built-in
 * image transform API. Falls back to original URL for non-Supabase or video URLs.
 *
 * Supabase transform: /storage/v1/object/public/<bucket>/<path>
 *   → /storage/v1/render/image/public/<bucket>/<path>?width=W&quality=75&resize=cover
 */
export function resizeSupabaseImageUrl(
  url: string | null | undefined,
  widthPx: number
): string | null {
  const cleaned = stripLegacyCloudinaryUrl(url);
  if (!cleaned) return null;

  // Only resize static images — skip video, HLS, audio (by extension or /videos/ path)
  if (/\.(mp4|mov|webm|m3u8|m4v|mkv|avi|ts|mp3|aac|wav)(\?|$)/i.test(cleaned)) return cleaned;
  if (/\/agrovibes\/videos\//i.test(cleaned) || /\/videos\//i.test(cleaned)) return cleaned;

  // Supabase public storage URL pattern
  if (/\/storage\/v1\/object\/public\//i.test(cleaned)) {
    try {
      const u = new URL(cleaned);
      // Already a render/image URL — just update width
      if (u.pathname.includes("/render/image/")) {
        u.searchParams.set("width", String(widthPx));
        u.searchParams.set("quality", "75");
        return u.toString();
      }
      // Rewrite to render endpoint
      const renderPath = u.pathname.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/"
      );
      u.pathname = renderPath;
      u.searchParams.set("width", String(widthPx));
      u.searchParams.set("quality", "75");
      u.searchParams.set("resize", "cover");
      return u.toString();
    } catch {
      return cleaned;
    }
  }

  return cleaned;
}

/** Screen-width pixels for feed images (portrait phone = ~1080px logical → 640 sufficient at @3x). */
const FEED_IMAGE_WIDTH = 640;
/** Thumbnail / avatar size — small, load fast */
const AVATAR_WIDTH = 120;
/** Story / thumbnail strip */
const THUMB_WIDTH = 320;

export function sanitizeHomePost(post: HomePost): HomePost {
  const imageUrls = post.imageUrls
    ?.map((u) => resizeSupabaseImageUrl(u, FEED_IMAGE_WIDTH))
    .filter((u): u is string => Boolean(u));
  return {
    ...post,
    videoUrl: stripLegacyCloudinaryUrl(post.videoUrl) ?? undefined,
    hlsUrl: stripLegacyCloudinaryUrl(post.hlsUrl) ?? undefined,
    playbackUrl: stripLegacyCloudinaryUrl(post.playbackUrl) ?? undefined,
    imageUrl: resizeSupabaseImageUrl(post.imageUrl, FEED_IMAGE_WIDTH) ?? undefined,
    thumbnailUrl: resizeSupabaseImageUrl(post.thumbnailUrl, THUMB_WIDTH) ?? undefined,
    authorAvatarUrl: resizeSupabaseImageUrl(post.authorAvatarUrl, AVATAR_WIDTH),
    musicAudioUrl: stripLegacyCloudinaryUrl(post.musicAudioUrl),
    ...(imageUrls?.length ? { imageUrls } : {}),
    recentLikers: post.recentLikers?.map((l) => ({
      ...l,
      avatarUrl: resizeSupabaseImageUrl(l.avatarUrl, AVATAR_WIDTH) ?? undefined
    })),
    recentResharers: post.recentResharers?.map((r) => ({
      ...r,
      avatarUrl: resizeSupabaseImageUrl(r.avatarUrl, AVATAR_WIDTH) ?? undefined
    })),
    repost: post.repost
      ? {
          ...post.repost,
          byAvatarUrl: resizeSupabaseImageUrl(post.repost.byAvatarUrl, AVATAR_WIDTH)
        }
      : post.repost
  };
}

export function sanitizeHomeStory(story: HomeStory): HomeStory {
  return {
    ...story,
    videoUrl: stripLegacyCloudinaryUrl(story.videoUrl),
    imageUrl: resizeSupabaseImageUrl(story.imageUrl, FEED_IMAGE_WIDTH),
    avatarUrl: resizeSupabaseImageUrl(story.avatarUrl, AVATAR_WIDTH)
  };
}

/** Hook — returns a function to resize any remote image to the current screen width. */
export function useScreenWidthImageUrl() {
  const { width } = useWindowDimensions();
  const px = Math.round(width * (typeof globalThis !== "undefined" ? (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1 : 1));
  return (url: string | null | undefined) => resizeSupabaseImageUrl(url, Math.min(px, 1080));
}
