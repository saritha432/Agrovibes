import { API_BASE_URL, fetchWithAuth, fetchWithRetry, parseJsonOrThrow } from "./client";
import type { HomePost, HomeStory } from "./types";

export async function createHomePost(
  payload: {
    userId?: number;
    userName: string;
    location: string;
    caption: string;
    videoUrl?: string;
    imageUrl?: string;
    imageUrls?: string[];
    thumbnailUrl?: string;
    taggedUserIds?: number[];
    musicLabel?: string;
  },
  token?: string | null
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/posts`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as { post: HomePost };
}

export async function createHomeStory(
  payload: {
    userName: string;
    district: string;
    videoUrl?: string;
    imageUrl?: string;
    musicLabel?: string;
  },
  token?: string | null
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`${API_BASE_URL}/v1/home/stories`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  return (await parseJsonOrThrow(response)) as { story: HomeStory };
}

export async function deleteHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}`, token, {
    method: "DELETE"
  })) as { ok: boolean };
}
