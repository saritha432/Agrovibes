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

export type ReelVideoFrame = {
  width: number;
  height: number;
};

/**
 * Reel feed sizing: always span the full container width (no side pillarboxing).
 * Landscape clips top/bottom only when taller than the slot; portrait may clip slightly
 * at top/bottom rather than shrinking width.
 */
export function computeReelVideoFrame(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  _containerHeight?: number
): ReelVideoFrame {
  const vw = videoWidth > 0 ? videoWidth : 9;
  const vh = videoHeight > 0 ? videoHeight : 16;
  const aspect = vw / vh;
  const cw = Math.max(1, containerWidth);

  return {
    width: cw,
    height: cw / aspect
  };
}

/** Reels in the home/profile feed always width-fill. */
export function pickReelVideoFit(
  _videoWidth: number,
  _videoHeight: number,
  _containerWidth?: number,
  _containerHeight?: number
): "cover" | "contain" {
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
