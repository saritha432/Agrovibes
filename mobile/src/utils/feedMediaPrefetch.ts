import { Platform } from "react-native";
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

/** Warm ~1MB of each upcoming video — moov + first GOP for fast-start MP4s. */
const VIDEO_WARM_BYTES = 1_048_576;

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

let webPreloadEl: HTMLVideoElement | null = null;

function warmWebVideo(url: string) {
  if (typeof document === "undefined") return;
  if (!webPreloadEl) {
    const el = document.createElement("video");
    el.muted = true;
    el.defaultMuted = true;
    el.preload = "auto";
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    el.setAttribute("muted", "");
    Object.assign(el.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
      left: "-9999px"
    });
    document.body.appendChild(el);
    webPreloadEl = el;
  }
  if (webPreloadEl.getAttribute("data-src") === url) return;
  webPreloadEl.setAttribute("data-src", url);
  webPreloadEl.src = url;
  webPreloadEl.load();
}

/**
 * Warm the start of the next reel so swipe-in does not wait on a cold HTTP start.
 * Web: HTML5 preload=auto on the same URL the player will use (HTTP cache shared).
 * Native: Range GET of the first megabyte (TLS + first GOP).
 */
export function warmVideoUri(
  uri: string | null | undefined,
  hlsUrl?: string | null,
  playbackUrl?: string | null
) {
  const raw = typeof uri === "string" ? uri.trim() : "";
  if (!raw && !hlsUrl && !playbackUrl) return;
  const clean = videoPlaybackUrl(raw || playbackUrl || hlsUrl, hlsUrl, playbackUrl);
  if (!clean || warmedVideos.has(clean)) return;
  if (clean.startsWith("file:") || clean.startsWith("content:") || clean.startsWith("ph:")) return;

  if (Platform.OS === "web") {
    warmWebVideo(clean);
    warmedVideos.add(clean);
    return;
  }

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
    .then(() => {
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
    warmVideoUri(post.videoUrl, post.hlsUrl, post.playbackUrl);
  }
}

/**
 * Warm the next reel (and its poster). One video ahead keeps the current clip's bandwidth.
 */
export function prefetchUpcomingPosts(posts: HomePost[], anchorIndex: number, _count = 1) {
  if (!posts.length || anchorIndex < 0) return;
  prefetchPostMedia(posts[anchorIndex], { warmVideo: false });
  const next = posts[anchorIndex + 1];
  if (next) prefetchPostMedia(next, { warmVideo: true });
}
