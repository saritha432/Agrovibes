import type { HomePost } from "../services/api";
import { reelGridStillUri } from "./reelGrid";
import { videoPlaybackUrl } from "./videoPlaybackUrl";
import { hasExpoImageNative } from "./hasExpoImageNative";

let ExpoImageModule: typeof import("expo-image").Image | null = null;
try {
  if (hasExpoImageNative()) {
    ExpoImageModule = require("expo-image").Image;
  }
} catch {
  ExpoImageModule = null;
}

const prefetchedImages = new Set<string>();
const warmedVideos = new Set<string>();

/** Warm ~512KB of each upcoming video — enough for moov + early frames, less bandwidth fight. */
const VIDEO_WARM_BYTES = 512_000;

function prefetchUri(uri: string | null | undefined) {
  const clean = typeof uri === "string" ? uri.trim() : "";
  if (!clean || prefetchedImages.has(clean)) return;
  prefetchedImages.add(clean);
  if (ExpoImageModule) {
    void ExpoImageModule.prefetch(clean).catch(() => {
      prefetchedImages.delete(clean);
    });
  }
}

/**
 * Warm the start of a remote video so swipe-to-next starts faster (Instagram-style).
 * Uses HTTP Range so we only pull the moov/header + early segments.
 */
export function warmVideoUri(uri: string | null | undefined, hlsUrl?: string | null) {
  const raw = typeof uri === "string" ? uri.trim() : "";
  if (!raw && !hlsUrl) return;
  const clean = videoPlaybackUrl(raw || hlsUrl, hlsUrl);
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
        }, 8_000)
      : null;

  const isHls = /\.m3u8(\?|#|$)/i.test(clean);
  void fetch(clean, {
    method: "GET",
    headers: isHls
      ? { Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*" }
      : {
          Range: `bytes=0-${VIDEO_WARM_BYTES - 1}`,
          Accept: "video/*,*/*"
        },
    signal: controller?.signal
  })
    .then(async (res) => {
      if (isHls) {
        await res.text().catch(() => "");
        return;
      }
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
    for (const url of post.imageUrls.slice(0, 2)) prefetchUri(url);
  }
  prefetchUri(post.authorAvatarUrl);
  if (options?.warmVideo !== false) {
    warmVideoUri(post.videoUrl, post.hlsUrl);
  }
}

/**
 * Warm only the single next post's video — no more, no less.
 * The current post is already playing so its bytes are flowing; loading more
 * ahead wastes bandwidth and makes the current video buffer slower.
 */
export function prefetchUpcomingPosts(posts: HomePost[], anchorIndex: number, _count = 1) {
  if (!posts.length || anchorIndex < 0) return;
  // Still-image prefetch for the current post (cheap).
  prefetchPostMedia(posts[anchorIndex], { warmVideo: false });
  // Video warm only for the immediate next post.
  const next = posts[anchorIndex + 1];
  if (next) prefetchPostMedia(next, { warmVideo: true });
}
