import type { HomePost } from "../api/types";
import { getWebAppOrigin } from "../api/client";

export function postShareKind(post: HomePost): "reel" | "post" {
  const cap = String(post.caption || "").trim();
  if (/^\[REEL\]/i.test(cap)) return "reel";
  if (/^\[POST\]/i.test(cap)) return "post";
  return String(post.videoUrl || "").trim() ? "reel" : "post";
}

export function buildExternalShareLink(post: HomePost) {
  return `${getWebAppOrigin()}/reel/${encodeURIComponent(String(post.id))}`;
}

export function buildPostChatMessage(post: HomePost) {
  const kind = postShareKind(post);
  const prefix = kind === "reel" ? "[Cropvibe Reel]" : "[Cropvibe Post]";
  return `${prefix}\n${JSON.stringify({
    id: post.id,
    userId: post.userId ?? null,
    userName: post.userName,
    author: post.userName,
    location: post.location || "",
    caption: post.caption || "",
    likesCount: post.likesCount ?? 0,
    commentsCount: post.commentsCount ?? 0,
    videoUrl: post.videoUrl || null,
    imageUrl: post.imageUrl || null,
    thumbnailUrl: post.thumbnailUrl || post.imageUrl || null,
    musicLabel: post.musicLabel ?? null,
    authorAvatarUrl: post.authorAvatarUrl ?? null,
    createdAt: post.createdAt,
    link: buildExternalShareLink(post),
    kind
  })}`;
}
