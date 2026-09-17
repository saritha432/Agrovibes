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
    farmingTopic?: string;
    farmingConfirmed?: boolean;
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

export async function addPostToStory(
  post: HomePost,
  token: string,
  user?: { fullName?: string | null; locationLabel?: string | null } | null
) {
  const videoUrl = String(post.videoUrl || post.playbackUrl || "").trim();
  const imageUrl = String(post.imageUrl || post.thumbnailUrl || "").trim();
  if (!videoUrl && !imageUrl) {
    throw new Error("This drop has no media to add to your story.");
  }
  return createHomeStory(
    {
      userName: user?.fullName || post.userName || "You",
      district: user?.locationLabel || post.location || "My Farm",
      ...(videoUrl ? { videoUrl } : { imageUrl })
    },
    token
  );
}

export async function deleteHomePost(token: string, postId: number) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/home/posts/${encodeURIComponent(String(postId))}`, token, {
    method: "DELETE"
  })) as { ok: boolean };
}
