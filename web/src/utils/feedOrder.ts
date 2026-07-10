import type { HomePost } from "../api/types";

const FRESH_POST_PRIORITY_MS = 30 * 60 * 1000;

function postCreatedMs(post: HomePost) {
  const t = Date.parse(String(post.createdAt || ""));
  return Number.isFinite(t) ? t : 0;
}

function seededPostScore(post: HomePost, seed: number): number {
  const input = `${seed}:${post.id}:${postCreatedMs(post)}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Shuffle older posts per session while keeping fresh content near the top. */
export function orderPostsForFeed(
  list: HomePost[],
  seed: number,
  nowMs: number,
  viewerUserId?: number
): HomePost[] {
  let pinned: HomePost | undefined;
  const fresh: HomePost[] = [];
  const rest: HomePost[] = [];

  for (const post of list) {
    const created = postCreatedMs(post);
    if (
      viewerUserId &&
      Number(post.userId) === viewerUserId &&
      (!pinned || postCreatedMs(post) > postCreatedMs(pinned))
    ) {
      if (pinned) {
        (postCreatedMs(pinned) > 0 && nowMs - postCreatedMs(pinned) <= FRESH_POST_PRIORITY_MS
          ? fresh
          : rest
        ).push(pinned);
      }
      pinned = post;
    } else if (created > 0 && nowMs - created <= FRESH_POST_PRIORITY_MS) {
      fresh.push(post);
    } else {
      rest.push(post);
    }
  }

  fresh.sort((a, b) => postCreatedMs(b) - postCreatedMs(a) || b.id - a.id);
  rest.sort(
    (a, b) =>
      seededPostScore(a, seed) - seededPostScore(b, seed) ||
      postCreatedMs(b) - postCreatedMs(a) ||
      b.id - a.id
  );
  return [...(pinned ? [pinned] : []), ...fresh, ...rest];
}

export function isDropPost(post: HomePost) {
  return Boolean(String(post.videoUrl || "").trim());
}

export function dropCaption(caption?: string | null) {
  return String(caption || "")
    .replace(/^\[(?:REEL|POST|LIVE|STORY)\]\s*/i, "")
    .trim();
}

export function dropMusicLabel(post: HomePost) {
  return String(post.musicLabel || "").trim() || null;
}

export function postShowsMusicRow(post: HomePost) {
  return Boolean(String(post.musicLabel ?? "").trim() || String(post.musicAudioUrl ?? "").trim());
}

export function reelGridStillUri(post: HomePost): string | null {
  const th = post.thumbnailUrl?.trim();
  if (th) return th;
  const img = post.imageUrl?.trim();
  if (img) return img;
  const carousel0 = post.imageUrls?.find((u) => typeof u === "string" && u.trim())?.trim();
  if (carousel0) return carousel0;
  return null;
}

export function reelGridTileBackground(index: number, columns = 3) {
  const row = Math.floor(index / columns);
  const col = index % columns;
  return (row + col) % 2 === 0 ? "#303132" : "#383838";
}
