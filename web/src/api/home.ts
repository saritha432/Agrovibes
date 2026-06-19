import { API_BASE_URL, fetchWithAuth, parseJsonOrThrow } from "./client";
import type { NetworkPerson } from "./profile";
import type { HomePost, HomeStory, UserSearchRecord } from "./types";

export async function fetchHomeStories() {
  const response = await fetch(`${API_BASE_URL}/v1/home/stories`);
  return (await parseJsonOrThrow(response)) as { stories: HomeStory[] };
}

export async function fetchHomePosts(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/v1/home/posts`, { headers });
  return (await parseJsonOrThrow(response)) as { posts: HomePost[] };
}

export async function fetchHomePost(token: string | null | undefined, postId: number) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}`, {
    headers
  });
  return (await parseJsonOrThrow(response)) as { post: HomePost };
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
