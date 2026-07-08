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
    byId.set(post.id, prev ? { ...prev, ...post } : post);
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
  const seen = new Set<string>();
  const out: HomePost[] = [];
  for (const post of [...repostItems, ...basePosts]) {
    const key = post.feedEntryKey || `post:${post.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(post);
  }
  return out.sort((a, b) => feedSortTime(b) - feedSortTime(a) || b.id - a.id);
}
