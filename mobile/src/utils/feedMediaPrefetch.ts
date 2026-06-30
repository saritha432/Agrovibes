import { Image } from "react-native";
import type { HomePost } from "../services/api";
import { reelGridStillUri } from "./reelGrid";

const prefetched = new Set<string>();

function prefetchUri(uri: string | null | undefined) {
  const clean = typeof uri === "string" ? uri.trim() : "";
  if (!clean || prefetched.has(clean)) return;
  prefetched.add(clean);
  void Image.prefetch(clean).catch(() => {
    prefetched.delete(clean);
  });
}

export function prefetchPostMedia(post: HomePost | null | undefined) {
  if (!post) return;
  prefetchUri(reelGridStillUri(post));
  prefetchUri(post.imageUrl);
  if (Array.isArray(post.imageUrls)) {
    for (const url of post.imageUrls.slice(0, 2)) prefetchUri(url);
  }
  prefetchUri(post.authorAvatarUrl);
}

export function prefetchUpcomingPosts(posts: HomePost[], anchorIndex: number, count = 2) {
  if (!posts.length || anchorIndex < 0) return;
  for (let i = 1; i <= count; i += 1) {
    prefetchPostMedia(posts[anchorIndex + i]);
  }
}
