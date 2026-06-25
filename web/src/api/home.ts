import { API_BASE_URL, fetchWithAuth, fetchWithRetry, parseJsonOrThrow } from "./client";
import type { NetworkPerson } from "./profile";
import type { HomePost, HomeStory, UserSearchRecord } from "./types";

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

export async function fetchHomeStories(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/stories`, { headers });
  return (await parseJsonOrThrow(response)) as { stories: HomeStory[] };
}

export async function fetchHomePosts(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts`, { headers });
  return (await parseJsonOrThrow(response)) as { posts: HomePost[] };
}

export async function fetchMyHomePosts(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/mine`, token)) as { posts: HomePost[] };
}

export async function fetchHomePost(token: string | null | undefined, postId: number) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(
    `${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}`,
    { headers }
  );
  return (await parseJsonOrThrow(response)) as { post: HomePost };
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
