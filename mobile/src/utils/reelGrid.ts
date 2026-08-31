import type { HomePost } from "../services/api";

export const REEL_GRID_TILE_A = "#303132";
export const REEL_GRID_TILE_B = "#383838";

export function reelGridTileBackground(index: number, columns = 3) {
  const row = Math.floor(index / columns);
  const col = index % columns;
  return (row + col) % 2 === 0 ? REEL_GRID_TILE_A : REEL_GRID_TILE_B;
}

export function reelPlayerBackground(_index: number) {
  return "#000";
}

export function isReelPost(post: HomePost): boolean {
  return Boolean(String(post.videoUrl || "").trim());
}

/** True when the creator attached a separate music/audio track (plays alongside muted video). */
export function postHasAttachedMusic(post: HomePost): boolean {
  return Boolean(String(post.musicAudioUrl ?? "").trim());
}

/** Show volume/mute control when the post can play audio (video soundtrack or attached music). */
export function postShowsVolumeControl(post: HomePost): boolean {
  return postHasAttachedMusic(post) || Boolean(String(post.videoUrl ?? "").trim());
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

/**
 * Portrait / near-reel aspect → cover (full-bleed).
 * Landscape / wide → contain so the frame isn't cropped into a "zoom".
 */
export function pickReelVideoFit(videoWidth: number, videoHeight: number): "cover" | "contain" {
  const w = Number(videoWidth);
  const h = Number(videoHeight);
  if (!(w > 0 && h > 0)) return "cover";
  // Wider than ~3:4 → show full frame (contain) instead of cropping.
  if (w / h > 0.85) return "contain";
  return "cover";
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
