import { API_BASE_URL, fetchWithAuth } from "./client";

export interface SocialNotificationItem {
  id: number;
  type: "follow_request" | "follow_accept";
  isRead: boolean;
  createdAt: string;
  followId: number;
  actorId: number;
  actorName: string;
  followStatus: string;
}

export interface SocialPostActivityNotification {
  id: number;
  type: "post_like" | "post_comment" | "comment_reply" | string;
  isRead: boolean;
  createdAt: string;
  actorId: number;
  actorName: string;
  postId: number | null;
  postIsReel?: boolean;
  commentExcerpt?: string | null;
  postLiveStatus?: string | null;
  postLiveEndedAt?: string | null;
}

export async function fetchSocialNotifications(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/notifications`, token)) as {
    followRequests: SocialNotificationItem[];
    followAccepted: SocialNotificationItem[];
    postLikes?: SocialPostActivityNotification[];
    postComments?: SocialPostActivityNotification[];
    liveStarts?: SocialPostActivityNotification[];
    unreadCount: number;
  };
}

export async function markSocialNotificationRead(token: string, notificationId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/social/notifications/${encodeURIComponent(String(notificationId))}/read`,
    token,
    { method: "POST" }
  )) as { ok: boolean };
}

export async function markAllSocialNotificationsRead(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/notifications/read-all`, token, {
    method: "POST"
  })) as { ok: boolean; marked?: number };
}

export async function respondToFollowRequestById(token: string, followId: number, action: "accept" | "decline") {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/social/follow/${encodeURIComponent(String(followId))}/respond`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  })) as { ok: boolean };
}
