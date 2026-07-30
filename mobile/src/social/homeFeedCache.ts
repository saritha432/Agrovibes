import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HomePost } from "../services/api";

const STORAGE_KEY_PREFIX = "agrovibes.homeFeed.v3";
const MAX_CACHED = 40;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEnvelope = {
  posts: HomePost[];
  savedAt: number;
};

function cacheKeyForViewer(viewerKey?: string | number | null) {
  const key = viewerKey != null && String(viewerKey).trim() ? String(viewerKey).trim() : "anon";
  return `${STORAGE_KEY_PREFIX}.${key}`;
}

export async function readHomeFeedCache(viewerKey?: string | number | null): Promise<HomePost[] | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKeyForViewer(viewerKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed?.posts?.length) return null;
    if (Date.now() - (parsed.savedAt || 0) > CACHE_TTL_MS) return null;
    return parsed.posts;
  } catch {
    return null;
  }
}

export async function clearHomeFeedCache(viewerKey?: string | number | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKeyForViewer(viewerKey));
  } catch {
    // ignore disk errors
  }
}

export async function writeHomeFeedCache(posts: HomePost[], viewerKey?: string | number | null): Promise<void> {
  if (!posts.length) return;
  try {
    const envelope: CacheEnvelope = {
      posts: posts.slice(0, MAX_CACHED),
      savedAt: Date.now()
    };
    await AsyncStorage.setItem(cacheKeyForViewer(viewerKey), JSON.stringify(envelope));
  } catch {
    // ignore disk errors
  }
}

function sortHomeFeedPosts(posts: HomePost[]): HomePost[] {
  return posts.sort((a, b) => {
    const bTime = Date.parse(String(b.createdAt || "")) || 0;
    const aTime = Date.parse(String(a.createdAt || "")) || 0;
    return bTime - aTime || b.id - a.id;
  });
}

function mergePostRow(prev: HomePost | undefined, post: HomePost): HomePost {
  if (!prev) return post;
  return {
    ...prev,
    ...post,
    resharesCount: Math.max(Number(prev.resharesCount ?? 0), Number(post.resharesCount ?? 0))
  };
}

/** Merge by id but keep the viewer's current scroll order (no re-sort). */
export function mergeHomeFeedPreservingOrder(fresh: HomePost[], existing: HomePost[]): HomePost[] {
  if (!existing.length) return fresh.slice();
  if (!fresh.length) return existing.slice();
  const freshById = new Map<number, HomePost>();
  for (const post of fresh) freshById.set(post.id, post);
  const seen = new Set<number>();
  const out: HomePost[] = [];
  for (const prev of existing) {
    const next = freshById.get(prev.id);
    if (next) {
      out.push(mergePostRow(prev, next));
      seen.add(prev.id);
    } else {
      out.push(prev);
    }
  }
  for (const post of fresh) {
    if (!seen.has(post.id)) out.push(post);
  }
  return out;
}

/** Merge fresh page(s) with existing feed — newer API data wins per id. Does not remove stale rows. */
export function mergeHomeFeedPosts(fresh: HomePost[], existing: HomePost[]): HomePost[] {
  const byId = new Map<number, HomePost>();
  for (const post of existing) byId.set(post.id, post);
  for (const post of fresh) {
    byId.set(post.id, mergePostRow(byId.get(post.id), post));
  }
  return sortHomeFeedPosts(Array.from(byId.values()));
}

/**
 * Reconcile the home feed with a fresh first page from the API.
 * Drops posts in the first-page id range that the API no longer returns
 * (private accounts, deletes, blocks, etc.) while keeping older load-more rows.
 * Preserves the current on-screen order so scrolling does not jump.
 */
export function reconcileHomeFeedWithFirstPage(fresh: HomePost[], existing: HomePost[]): HomePost[] {
  if (!fresh.length) return [];
  if (!existing.length) return fresh.slice();
  const minFreshId = Math.min(...fresh.map((p) => Number(p.id)).filter((id) => Number.isFinite(id) && id > 0));
  if (!Number.isFinite(minFreshId)) return mergeHomeFeedPreservingOrder(fresh, existing);

  const freshById = new Map<number, HomePost>();
  for (const post of fresh) freshById.set(post.id, post);
  const seen = new Set<number>();
  const out: HomePost[] = [];

  for (const prev of existing) {
    const id = Number(prev.id);
    const fromFresh = freshById.get(prev.id);
    if (fromFresh) {
      out.push(mergePostRow(prev, fromFresh));
      seen.add(prev.id);
      continue;
    }
    // Keep older load-more rows (below the first-page window).
    if (Number.isFinite(id) && id < minFreshId) {
      out.push(prev);
      seen.add(prev.id);
    }
    // Else: first-page id missing from API → drop (private/deleted/blocked).
  }

  // Brand-new first-page posts (not already shown) go to the front in API order.
  const brandNew: HomePost[] = [];
  for (const post of fresh) {
    if (!seen.has(post.id)) brandNew.push(post);
  }
  return brandNew.length ? [...brandNew, ...out] : out;
}

function feedSortTime(post: HomePost): number {
  return Date.parse(String(post.repost?.repostedAt || post.createdAt || "")) || 0;
}

/** Blend repost rows from followed users into the home feed (Instagram-style). */
export function mergeRepostFeedItems(basePosts: HomePost[], repostItems: HomePost[]): HomePost[] {
  if (!repostItems.length) return basePosts;
  const repostByPostId = new Map<number, HomePost>();
  for (const repostPost of repostItems) {
    const existing = repostByPostId.get(repostPost.id);
    if (!existing || feedSortTime(repostPost) > feedSortTime(existing)) {
      repostByPostId.set(repostPost.id, repostPost);
    }
  }

  const out: HomePost[] = basePosts.map((post) => {
    const repostRow = repostByPostId.get(post.id);
    if (!repostRow?.repost) return post;
    return {
      ...post,
      repost: repostRow.repost,
      resharesCount: Math.max(Number(post.resharesCount ?? 0), Number(repostRow.resharesCount ?? 0)),
      viewerHasReshared: post.viewerHasReshared ?? repostRow.viewerHasReshared
    };
  });

  // Append repost-only rows without re-sorting the whole feed (avoids jump-to-top).
  const presentIds = new Set(out.map((post) => post.id));
  for (const repostPost of repostItems) {
    if (!presentIds.has(repostPost.id)) out.push(repostPost);
  }
  return out;
}

/** Prefer API count; fall back when repost metadata exists but count was not loaded yet. */
export function shownResharesCount(post: HomePost): number {
  const fromApi = Number(post.resharesCount ?? 0);
  if (fromApi > 0) return fromApi;
  if (post.recentResharers?.length) return post.recentResharers.length;
  if (post.repost || post.viewerHasReshared) return 1;
  return 0;
}

/** Latest resharers for stacked avatar UI (max 4). */
export function latestResharersForDisplay(post: HomePost): Array<{
  userId?: number;
  fullName: string;
  avatarUrl?: string | null;
}> {
  if (Array.isArray(post.recentResharers) && post.recentResharers.length) {
    return post.recentResharers.slice(0, 4).map((r) => ({
      userId: r.userId,
      fullName: String(r.fullName || "").trim() || "User",
      avatarUrl: r.avatarUrl
    }));
  }
  if (post.repost) {
    return [
      {
        userId: post.repost.byUserId,
        fullName: String(post.repost.byUserName || "").trim() || "User",
        avatarUrl: post.repost.byAvatarUrl
      }
    ];
  }
  return [];
}
