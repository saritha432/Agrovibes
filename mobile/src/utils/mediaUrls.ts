import type { HomePost, HomeStory } from "../services/api";

/** Ignore dead Cloudinary URLs (account disabled → 401). */
export function stripLegacyCloudinaryUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  const u = String(url).trim();
  if (!u || /res\.cloudinary\.com/i.test(u)) return null;
  return u;
}

export function sanitizeHomePost(post: HomePost): HomePost {
  const imageUrls = post.imageUrls
    ?.map((u) => stripLegacyCloudinaryUrl(u))
    .filter((u): u is string => Boolean(u));
  return {
    ...post,
    videoUrl: stripLegacyCloudinaryUrl(post.videoUrl) ?? undefined,
    hlsUrl: stripLegacyCloudinaryUrl(post.hlsUrl) ?? undefined,
    imageUrl: stripLegacyCloudinaryUrl(post.imageUrl) ?? undefined,
    thumbnailUrl: stripLegacyCloudinaryUrl(post.thumbnailUrl) ?? undefined,
    authorAvatarUrl: stripLegacyCloudinaryUrl(post.authorAvatarUrl),
    musicAudioUrl: stripLegacyCloudinaryUrl(post.musicAudioUrl),
    ...(imageUrls?.length ? { imageUrls } : {}),
    recentLikers: post.recentLikers?.map((l) => ({
      ...l,
      avatarUrl: stripLegacyCloudinaryUrl(l.avatarUrl) ?? undefined
    })),
    recentResharers: post.recentResharers?.map((r) => ({
      ...r,
      avatarUrl: stripLegacyCloudinaryUrl(r.avatarUrl) ?? undefined
    })),
    repost: post.repost
      ? {
          ...post.repost,
          byAvatarUrl: stripLegacyCloudinaryUrl(post.repost.byAvatarUrl)
        }
      : post.repost
  };
}

export function sanitizeHomeStory(story: HomeStory): HomeStory {
  return {
    ...story,
    videoUrl: stripLegacyCloudinaryUrl(story.videoUrl),
    imageUrl: stripLegacyCloudinaryUrl(story.imageUrl),
    avatarUrl: stripLegacyCloudinaryUrl(story.avatarUrl)
  };
}
