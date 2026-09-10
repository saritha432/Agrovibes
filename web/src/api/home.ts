import { API_BASE_URL, fetchWithAuth, fetchWithRetry, parseJsonOrThrow } from "./client";
import type { NetworkPerson } from "./profile";
import type { HomePost, HomeStory, UserSearchRecord } from "./types";
import { sanitizeHomePost } from "../utils/mediaUrls";

export type HomeComment = {
  id: string;
  user: string;
  text: string;
  likes: number;
  avatarUrl?: string | null;
  createdAt?: string;
  parentCommentId?: string;
  userId?: number;
};

export const HOME_FEED_PAGE_SIZE = 10;

export type HomeFeedPage = {
  posts: HomePost[];
  nextCursor: number | null;
  hasMore: boolean;
};

function homeFeedQuery(limit: number, cursor?: number | null) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor != null && cursor > 0) params.set("cursor", String(cursor));
  return params.toString();
}

export async function fetchHomeStories(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/stories`, { headers });
  return (await parseJsonOrThrow(response)) as { stories: HomeStory[] };
}

export async function markHomeStoryViewed(token: string, storyId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/stories/${encodeURIComponent(String(storyId))}/view`,
    token,
    { method: "POST" }
  )) as { ok: boolean; viewed?: boolean; own?: boolean };
}

export async function fetchHomePostsPage(
  token?: string | null,
  options?: { limit?: number; cursor?: number | null }
): Promise<HomeFeedPage> {
  const limit = options?.limit ?? HOME_FEED_PAGE_SIZE;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const qs = homeFeedQuery(limit, options?.cursor);
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts?${qs}`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load home posts");
  }
  const data = (await response.json()) as {
    posts?: HomePost[];
    nextCursor?: number | null;
    hasMore?: boolean;
  };
  const posts = Array.isArray(data.posts) ? data.posts.map(sanitizeHomePost) : [];
  return {
    posts,
    nextCursor: data.nextCursor ?? (posts.length ? posts[posts.length - 1]?.id ?? null : null),
    hasMore: Boolean(data.hasMore)
  };
}

export async function fetchHomeReelsExplore(
  token?: string | null,
  options?: { limit?: number; cursor?: number | null }
): Promise<HomeFeedPage> {
  const limit = options?.limit ?? 24;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const params = new URLSearchParams({ limit: String(limit) });
  if (options?.cursor != null && options.cursor > 0) params.set("cursor", String(options.cursor));
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/reels?${params}`, { headers });
  if (!response.ok) {
    throw new Error("Failed to load reels");
  }
  const data = (await response.json()) as {
    posts?: HomePost[];
    nextCursor?: number | null;
    hasMore?: boolean;
  };
  const posts = Array.isArray(data.posts) ? data.posts.map(sanitizeHomePost) : [];
  return {
    posts,
    nextCursor: data.nextCursor ?? (posts.length ? posts[posts.length - 1]?.id ?? null : null),
    hasMore: Boolean(data.hasMore)
  };
}

/** First page only — used where a small snapshot is enough. */
export async function fetchHomePosts(token?: string | null) {
  const page = await fetchHomePostsPage(token, { limit: 50 });
  return { posts: page.posts };
}

export async function fetchMyHomePosts(token: string) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/mine`, token)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

/** Any user's profile posts (public profile view). */
export async function fetchUserHomePosts(
  token: string | null | undefined,
  userId: number,
  userName?: string
) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const qs = userName?.trim() ? `?userName=${encodeURIComponent(userName.trim())}` : "";
  const response = await fetchWithRetry(
    `${API_BASE_URL}/v1/home/posts/user/${encodeURIComponent(String(userId))}${qs}`,
    { headers }
  );
  if (!response.ok) {
    throw new Error("Failed to load user posts");
  }
  const data = (await response.json()) as {
    posts: HomePost[];
    restricted?: boolean;
    postsCount?: number;
    reelsCount?: number;
  };
  return {
    posts: (data.posts || []).map(sanitizeHomePost),
    restricted: Boolean(data.restricted),
    postsCount: Number.isFinite(Number(data.postsCount)) ? Number(data.postsCount) : undefined,
    reelsCount: Number.isFinite(Number(data.reelsCount)) ? Number(data.reelsCount) : undefined
  };
}

export async function fetchHomePost(token: string | null | undefined, postId: number) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}`,
    { headers }
  );
  const data = (await parseJsonOrThrow(response)) as { post: HomePost };
  return { post: sanitizeHomePost(data.post) };
}

export async function fetchHomePostComments(postId: number, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/comments`,
    { headers }
  );
  return (await parseJsonOrThrow(response)) as { comments: HomeComment[] };
}

export async function createHomePostComment(
  token: string,
  postId: number,
  text: string,
  options?: { parentCommentId?: number | null }
) {
  const body: { text: string; parentCommentId?: number } = { text };
  if (options?.parentCommentId != null && Number.isFinite(options.parentCommentId) && options.parentCommentId > 0) {
    body.parentCommentId = Number(options.parentCommentId);
  }
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/comments`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  )) as {
    comment: HomeComment;
    commentsCount: number;
  };
}

export async function likeHomePost(token: string, postId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/posts/${postId}/like`,
    token,
    { method: "POST" }
  )) as { liked: boolean; likesCount: number };
}

export async function unlikeHomePost(token: string, postId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/posts/${postId}/unlike`,
    token,
    { method: "POST" }
  )) as { liked: boolean; likesCount: number };
}

export async function saveHomePost(token: string, postId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/save`,
    token,
    { method: "POST" }
  )) as { saved: boolean };
}

export async function unsaveHomePost(token: string, postId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/unsave`,
    token,
    { method: "POST" }
  )) as { saved: boolean };
}

export type HomePostLiker = {
  userId: number;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  createdAt?: string;
};

export async function fetchHomePostLikes(postId: number, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetchWithRetry(
      `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/likes`,
      { headers }
    );
    if (!response.ok) return { likers: [] as HomePostLiker[] };
    const data = (await response.json()) as { likers?: HomePostLiker[] };
    return { likers: Array.isArray(data.likers) ? data.likers : [] };
  } catch {
    return { likers: [] as HomePostLiker[] };
  }
}

export async function deleteHomePostComment(token: string, postId: number, commentId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}/comments/${encodeURIComponent(String(commentId))}`,
    token,
    { method: "DELETE" }
  )) as { ok: boolean; commentsCount: number };
}

export async function fetchUsers(
  token: string,
  params: { search?: string; limit?: number } = {}
) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return (await fetchWithAuth(`${API_BASE_URL}/v1/users${suffix}`, token)) as {
    users: UserSearchRecord[];
    total: number;
  };
}

export async function fetchSocialNetwork(token: string, userId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/social/network/${userId}`,
    token
  )) as {
    followers: NetworkPerson[];
    following: NetworkPerson[];
  };
}

export async function sendFollowRequest(token: string, targetUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/request`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId })
  })) as {
    follow: { status: "none" | "pending" | "accepted" };
  };
}
