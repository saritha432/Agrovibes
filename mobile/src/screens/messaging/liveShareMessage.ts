import type { HomePost } from "../../services/api";
import { getWebAppOrigin } from "../../services/api";
import { liveRoomName } from "../live/livePostUtils";

export const LIVE_SHARE_PREFIX = "[Cropvibe Live]";

export type LiveSharePayload = {
  postId: number;
  roomName: string;
  userName: string;
  userId?: number | null;
  title?: string;
  authorAvatarUrl?: string | null;
  thumbnailUrl?: string | null;
  liveStatus?: "active" | "ended";
  link?: string;
};

export function buildLiveShareChatMessage(input: {
  post: HomePost;
  title?: string;
}): string {
  const post = input.post;
  const postId = Number(post.id);
  const payload: LiveSharePayload = {
    postId,
    roomName: liveRoomName(post),
    userName: String(post.userName || "User").trim() || "User",
    userId: post.userId ?? null,
    title:
      String(input.title || "")
        .trim() ||
      String(post.caption || "")
        .replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "")
        .trim()
        .slice(0, 120),
    authorAvatarUrl: post.authorAvatarUrl ?? null,
    thumbnailUrl: post.thumbnailUrl || post.imageUrl || null,
    liveStatus: post.liveStatus === "ended" ? "ended" : "active",
    link: `${getWebAppOrigin()}/reel/${encodeURIComponent(String(postId))}`
  };
  return `${LIVE_SHARE_PREFIX}\n${JSON.stringify(payload)}`;
}

export function parseLiveShareContent(body: string): LiveSharePayload | null {
  const text = String(body || "");
  if (!text.startsWith(LIVE_SHARE_PREFIX)) return null;
  const jsonText = text.slice(LIVE_SHARE_PREFIX.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const postId = Number(parsed.postId);
    if (!Number.isFinite(postId) || postId <= 0) return null;
    const roomName = String(parsed.roomName || "").trim();
    if (!roomName) return null;
    return {
      postId,
      roomName,
      userName: String(parsed.userName || "User").trim() || "User",
      userId: parsed.userId != null && Number.isFinite(Number(parsed.userId)) ? Number(parsed.userId) : null,
      title: String(parsed.title || "").trim() || undefined,
      authorAvatarUrl: (parsed.authorAvatarUrl as string) ?? null,
      thumbnailUrl: (parsed.thumbnailUrl as string) ?? null,
      liveStatus: parsed.liveStatus === "ended" ? "ended" : "active",
      link: String(parsed.link || "").trim() || undefined
    };
  } catch {
    return null;
  }
}

export function isJoinableLiveShare(payload: LiveSharePayload | null) {
  return !!payload && payload.liveStatus !== "ended";
}

export async function hydrateLiveShareFromFeed(
  payload: LiveSharePayload,
  posts: HomePost[]
): Promise<LiveSharePayload> {
  const post = posts.find((p) => p.id === payload.postId);
  if (!post) return payload;
  const ended = post.liveStatus === "ended" || !!post.liveEndedAt;
  return {
    ...payload,
    userName: post.userName || payload.userName,
    userId: post.userId ?? payload.userId ?? null,
    title:
      payload.title ||
      String(post.caption || "")
        .replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "")
        .trim()
        .slice(0, 120),
    authorAvatarUrl: post.authorAvatarUrl ?? payload.authorAvatarUrl ?? null,
    thumbnailUrl: post.thumbnailUrl || post.imageUrl || payload.thumbnailUrl || null,
    liveStatus: ended ? "ended" : "active",
    roomName: liveRoomName(post)
  };
}
