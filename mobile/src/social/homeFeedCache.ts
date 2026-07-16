import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HomePost } from "../services/api";

const STORAGE_KEY_PREFIX = "agrovibes.homeFeed.v2";
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

/** Merge fresh page(s) with existing feed — newer API data wins per id. */
export function mergeHomeFeedPosts(fresh: HomePost[], existing: HomePost[]): HomePost[] {
  const byId = new Map<number, HomePost>();
  for (const post of existing) byId.set(post.id, post);
  for (const post of fresh) {
    const prev = byId.get(post.id);
    if (!prev) {
      byId.set(post.id, post);
      continue;
    }
    byId.set(post.id, {
      ...prev,
      ...post,
      resharesCount: Math.max(Number(prev.resharesCount ?? 0), Number(post.resharesCount ?? 0))
    });
  }
  return Array.from(byId.values()).sort((a, b) => {
    const bTime = Date.parse(String(b.createdAt || "")) || 0;
    const aTime = Date.parse(String(a.createdAt || "")) || 0;
    return bTime - aTime || b.id - a.id;
  });
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

  const presentIds = new Set(out.map((post) => post.id));
  for (const repostPost of repostItems) {
    if (!presentIds.has(repostPost.id)) out.push(repostPost);
  }
  return out.sort((a, b) => feedSortTime(b) - feedSortTime(a) || b.id - a.id);
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
