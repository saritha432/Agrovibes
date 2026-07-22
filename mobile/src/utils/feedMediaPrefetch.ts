import { Image, Platform } from "react-native";
import type { HomePost } from "../services/api";
import { reelGridStillUri } from "./reelGrid";
import { videoPlaybackUrl } from "./videoPlaybackUrl";

const prefetchedImages = new Set<string>();
const warmedVideos = new Set<string>();

/** First ~1.25MB of each upcoming video — warms CDN/device cache without full download. */
const VIDEO_WARM_BYTES = 1_250_000;

function prefetchUri(uri: string | null | undefined) {
  const clean = typeof uri === "string" ? uri.trim() : "";
  if (!clean || prefetchedImages.has(clean)) return;
  prefetchedImages.add(clean);
  void Image.prefetch(clean).catch(() => {
    prefetchedImages.delete(clean);
  });
}

/**
 * Warm the start of a remote video so swipe-to-next starts faster (Instagram-style).
 * Uses HTTP Range so we only pull the moov/header + early segments.
 */
export function warmVideoUri(uri: string | null | undefined) {
  const raw = typeof uri === "string" ? uri.trim() : "";
  if (!raw) return;
  const clean = videoPlaybackUrl(raw);
  if (!clean || warmedVideos.has(clean)) return;
  if (clean.startsWith("file:") || clean.startsWith("content:") || clean.startsWith("ph:")) return;
  warmedVideos.add(clean);

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    controller && typeof setTimeout === "function"
      ? setTimeout(() => {
          try {
            controller.abort();
          } catch {
            // ignore
          }
        }, 12_000)
      : null;

  void fetch(clean, {
    method: "GET",
    headers: {
      Range: `bytes=0-${VIDEO_WARM_BYTES - 1}`,
      Accept: "video/*,*/*"
    },
    signal: controller?.signal
  })
    .then(async (res) => {
      // Drain a limited body so the connection actually transfers bytes (CDN warm).
      if (!res.body || typeof res.arrayBuffer !== "function") {
        await res.text().catch(() => "");
        return;
      }
      await res.arrayBuffer().catch(() => null);
    })
    .catch(() => {
      warmedVideos.delete(clean);
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

export function prefetchPostMedia(post: HomePost | null | undefined, options?: { warmVideo?: boolean }) {
  if (!post) return;
  prefetchUri(reelGridStillUri(post));
  prefetchUri(post.thumbnailUrl);
  prefetchUri(post.imageUrl);
  if (Array.isArray(post.imageUrls)) {
    for (const url of post.imageUrls.slice(0, 3)) prefetchUri(url);
  }
  prefetchUri(post.authorAvatarUrl);
  if (options?.warmVideo !== false) {
    warmVideoUri(post.videoUrl);
  }
}

/** Prefetch stills + warm video bytes for the next N posts after the visible anchor. */
export function prefetchUpcomingPosts(posts: HomePost[], anchorIndex: number, count = 3) {
  if (!posts.length || anchorIndex < 0) return;
  const ahead = Platform.OS === "web" ? Math.min(count, 2) : count;
  for (let i = 1; i <= ahead; i += 1) {
    prefetchPostMedia(posts[anchorIndex + i], { warmVideo: true });
  }
  // Also warm the current item's video if somehow missed.
  prefetchPostMedia(posts[anchorIndex], { warmVideo: true });
}
