import { Linking, Share } from "react-native";
import { getWebAppOrigin, type HomePost } from "../services/api";

export function postShareKind(post: HomePost): "reel" | "post" {
  const cap = String(post.caption || "").trim();
  if (/^\[REEL\]/i.test(cap)) return "reel";
  if (/^\[POST\]/i.test(cap)) return "post";
  return String(post.videoUrl || "").trim() ? "reel" : "post";
}

export function buildPostSharePrefix(post: HomePost) {
  return postShareKind(post) === "reel" ? "[Cropvibe Reel]" : "[Cropvibe Post]";
}

export function buildPostShareLink(post: HomePost) {
  const segment = postShareKind(post) === "reel" ? "reel" : "watch";
  return `${getWebAppOrigin()}/${segment}/${encodeURIComponent(String(post.id))}`;
}

/** Public link used for WhatsApp / system share previews (always /reel/ for one OG page). */
export function buildExternalShareLink(post: HomePost) {
  return `${getWebAppOrigin()}/reel/${encodeURIComponent(String(post.id))}`;
}

export function stripShareCaption(caption?: string | null) {
  return String(caption || "")
    .replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "")
    .trim();
}

/** Instagram-style text: `user on Cropvibe: "caption..."` + link */
export function buildInstagramStyleShareText(post: HomePost, authorName?: string) {
  const author = String(authorName || post.userName || "Someone").trim() || "Someone";
  const cap = stripShareCaption(post.caption);
  const snippet = cap.length > 80 ? `${cap.slice(0, 77).trim()}...` : cap;
  const quote = snippet ? `: "${snippet}"` : "";
  return `${author} on Cropvibe${quote}\n${buildExternalShareLink(post)}`;
}

export function buildPostShareMessage(
  post: HomePost,
  opts?: { intro?: string; caption?: string; authorName?: string }
) {
  if (opts?.intro || opts?.caption) {
    const link = buildExternalShareLink(post);
    const caption = opts.caption ? `\n${opts.caption}` : "";
    return `${opts.intro}${caption}\n${link}`;
  }
  return buildInstagramStyleShareText(post, opts?.authorName);
}

export function buildPostChatMessage(post: HomePost) {
  return `${buildPostSharePrefix(post)}\n${JSON.stringify({
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
    imageUrls: Array.isArray(post.imageUrls) && post.imageUrls.length > 0 ? post.imageUrls : undefined,
    thumbnailUrl: post.thumbnailUrl || post.imageUrl || null,
    musicLabel: post.musicLabel ?? null,
    musicAudioUrl: post.musicAudioUrl ?? null,
    creativeMeta: post.creativeMeta,
    authorAvatarUrl: post.authorAvatarUrl ?? null,
    createdAt: post.createdAt || new Date().toISOString(),
    viewerHasLiked: post.viewerHasLiked,
    viewerHasSaved: post.viewerHasSaved,
    link: buildExternalShareLink(post),
    kind: postShareKind(post)
  })}`;
}

/** @deprecated Use buildPostChatMessage */
export const buildReelChatMessage = buildPostChatMessage;

export async function openExternalWithFallback(primaryUrl: string, fallbackUrl: string) {
  try {
    const supported = await Linking.canOpenURL(primaryUrl);
    if (supported) {
      await Linking.openURL(primaryUrl);
      return;
    }
  } catch {
    // fallback below
  }
  await Linking.openURL(fallbackUrl);
}

export async function sharePostToSystem(message: string) {
  await Share.share({ message });
}

export async function sharePostToWhatsApp(message: string) {
  const encoded = encodeURIComponent(message);
  await openExternalWithFallback(`whatsapp://send?text=${encoded}`, `https://wa.me/?text=${encoded}`);
}

export async function sharePostToMessenger(link: string) {
  const encoded = encodeURIComponent(link);
  await openExternalWithFallback(
    `fb-messenger://share?link=${encoded}`,
    `https://www.messenger.com/share?link=${encoded}`
  );
}

export async function sharePostToSnapchat(link: string) {
  const encoded = encodeURIComponent(link);
  await openExternalWithFallback(`snapchat://share?link=${encoded}`, "https://www.snapchat.com/");
}

export async function sharePostToTelegram(message: string, link: string) {
  const encodedUrl = encodeURIComponent(link);
  const encodedText = encodeURIComponent(message);
  await openExternalWithFallback(
    `tg://msg_url?url=${encodedUrl}&text=${encodedText}`,
    `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
  );
}

export async function sharePostToX(message: string) {
  const encoded = encodeURIComponent(message);
  await openExternalWithFallback(
    `twitter://post?message=${encoded}`,
    `https://twitter.com/intent/tweet?text=${encoded}`
  );
}
