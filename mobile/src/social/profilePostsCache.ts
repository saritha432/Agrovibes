import type { HomePost } from "../services/api";

type ProfilePostsCache = {
  userId: number;
  userPosts: HomePost[];
  savedPosts: HomePost[];
  taggedPosts: HomePost[];
  savedLoaded: boolean;
  taggedLoaded: boolean;
  fetchedAt: number;
};

let cache: ProfilePostsCache | null = null;

const CACHE_TTL_MS = 45_000;

export function readProfilePostsCache(userId: number): ProfilePostsCache | null {
  if (!cache || cache.userId !== userId) return null;
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
  return cache;
}

export function writeProfilePostsCache(partial: Partial<ProfilePostsCache> & { userId: number }) {
  const prev = cache && cache.userId === partial.userId ? cache : null;
  cache = {
    userId: partial.userId,
    userPosts: partial.userPosts ?? prev?.userPosts ?? [],
    savedPosts: partial.savedPosts ?? prev?.savedPosts ?? [],
    taggedPosts: partial.taggedPosts ?? prev?.taggedPosts ?? [],
    savedLoaded: partial.savedLoaded ?? prev?.savedLoaded ?? false,
    taggedLoaded: partial.taggedLoaded ?? prev?.taggedLoaded ?? false,
    fetchedAt: partial.fetchedAt ?? Date.now()
  };
}

export function clearProfilePostsCache() {
  cache = null;
}
