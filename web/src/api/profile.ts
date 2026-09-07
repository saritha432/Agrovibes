import { API_BASE_URL, fetchWithAuth, fetchWithRetry, parseJsonOrThrow } from "./client";
import type { AuthResponse, HomePost } from "./types";
import { sanitizeHomePost } from "../utils/mediaUrls";

export type FollowStatus = "none" | "pending" | "accepted";

export interface ProfileStats {
  id: number;
  fullName: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  website?: string | null;
  locationLabel?: string | null;
  postsCount: number;
  reelsCount: number;
  followersCount: number;
  followingCount: number;
  viewerStatus?: FollowStatus;
  reverseStatus?: FollowStatus;
  canFollowBack?: boolean;
  incomingFollowId?: number | null;
}

export interface NetworkPerson {
  name: string;
  key?: string;
  avatarUrl?: string | null;
  viewerStatus: "none" | "pending" | "accepted";
  canFollowBack: boolean;
}

export async function fetchSavedHomePosts(token: string) {
  const data = (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/saved`, token)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function fetchTaggedHomePosts(token: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/tagged`, { headers });
  if (response.status === 404) return { posts: [] as HomePost[] };
  const data = (await parseJsonOrThrow(response)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function fetchResharedHomePosts(token: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts/reshared`, { headers });
  if (response.status === 404) return { posts: [] as HomePost[] };
  const data = (await parseJsonOrThrow(response)) as { posts: HomePost[] };
  return { posts: data.posts.map(sanitizeHomePost) };
}

export async function fetchProfileStats(token: string, userId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/social/profile-stats/${encodeURIComponent(String(userId))}`,
    token
  )) as ProfileStats;
}

export async function unfollowUser(token: string, targetUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/unfollow`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId })
  })) as { ok: boolean };
}

export async function removeFollower(token: string, targetUserId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/remove-follower`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId })
  })) as { ok: boolean };
}

export async function updateMyProfile(
  token: string,
  payload: {
    fullName: string;
    username?: string;
    bio?: string;
    website?: string;
    locationLabel?: string;
    avatarUrl?: string;
  }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/auth/me`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as AuthResponse;
}
