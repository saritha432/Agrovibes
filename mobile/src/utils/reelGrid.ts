import type { HomePost } from "../services/api";

export function isReelPost(post: HomePost): boolean {
  return Boolean(String(post.videoUrl || "").trim());
}

/** Prefer a still image in explore/profile reel grids. */
export function reelGridStillUri(post: HomePost): string | null {
  const th = post.thumbnailUrl?.trim();
  if (th) return th;
  const img = post.imageUrl?.trim();
  if (img) return img;
  const carousel0 = post.imageUrls?.find((u) => typeof u === "string" && u.trim())?.trim();
  if (carousel0) return carousel0;
  return null;
}

export function postMatchesExploreQuery(post: HomePost, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    post.caption,
    post.userName,
    post.location,
    post.musicLabel
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}
