import { API_BASE_URL, fetchWithAuth } from "./client";

export type AdminReportedPost = {
  id: number;
  userId?: number | null;
  userName: string;
  caption: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  reportCount?: number;
  feedHiddenAt?: string | null;
  latestReason?: string | null;
  latestReportAt?: string | null;
  createdAt?: string;
};

export type AdminPostReportRow = {
  id: number;
  reason: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  reporterUserId: number;
  reporterName: string;
};

export async function fetchAdminReportedPosts(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/admin/reports/posts`, token)) as {
    posts: AdminReportedPost[];
  };
}

export async function fetchAdminPostReportDetail(token: string, postId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/admin/reports/posts/${encodeURIComponent(String(postId))}`,
    token
  )) as {
    post: AdminReportedPost;
    reports: AdminPostReportRow[];
  };
}

export async function dismissAdminPostReports(token: string, postId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/admin/reports/posts/${encodeURIComponent(String(postId))}/dismiss`,
    token,
    { method: "POST" }
  )) as { ok: boolean };
}

export async function removeAdminReportedPost(token: string, postId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/admin/reports/posts/${encodeURIComponent(String(postId))}/remove`,
    token,
    { method: "POST" }
  )) as { ok: boolean; reason?: string };
}
