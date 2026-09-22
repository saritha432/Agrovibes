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

/** Warm ~1MB of each upcoming progressive MP4 — moov + first GOP for fast-start files. */
const VIDEO_WARM_BYTES = 1_048_576;
const HLS_SEGMENT_WARM_BYTES = 524_288;

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

function abortIn(ms: number) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    controller && typeof setTimeout === "function"
      ? setTimeout(() => {
          try {
            controller.abort();
          } catch {
            // ignore
          }
        }, ms)
      : null;
  return { controller, timer };
}

function resolvePlaylistUrl(ref: string, playlistUrl: string) {
  if (/^https?:\/\//i.test(ref)) return ref;
  try {
    return new URL(ref, playlistUrl).toString();
  } catch {
    return "";
  }
}

function firstPlaylistRef(body: string) {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    return trimmed;
  }
  return "";
}

async function warmHlsStart(url: string, signal?: AbortSignal, depth = 0) {
  if (depth > 3) return;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*" },
    signal
  });
  const text = await res.text().catch(() => "");
  const ref = firstPlaylistRef(text);
  if (!ref) return;
  const next = resolvePlaylistUrl(ref, url);
  if (!next) return;
  if (/\.m3u8(\?|#|$)/i.test(next)) {
    await warmHlsStart(next, signal, depth + 1);
    return;
  }
  await fetch(next, {
    method: "GET",
    headers: { Range: `bytes=0-${HLS_SEGMENT_WARM_BYTES - 1}`, Accept: "video/*,*/*" },
    signal
  })
    .then((r) => r.arrayBuffer())
    .catch(() => null);
}

/**
 * Warm the start of the next reel so swipe-in does not wait on a cold HTTP start.
 * Prefers the 480p fast-start MP4 (same URL the player uses). For HLS, fetch the
 * master playlist and the first media segment — not only the .m3u8 text.
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
  const { controller, timer } = abortIn(8_000);
  const isHls = /\.m3u8(\?|#|$)/i.test(clean);

  const task = isHls
    ? warmHlsStart(clean, controller?.signal)
    : fetch(clean, {
        method: "GET",
        headers: {
          Range: `bytes=0-${VIDEO_WARM_BYTES - 1}`,
          Accept: "video/*,*/*"
        },
        signal: controller?.signal
      }).then(async (res) => {
        if (!res.body || typeof res.arrayBuffer !== "function") {
          await res.text().catch(() => "");
          return;
        }
        await res.arrayBuffer().catch(() => null);
      });

  void task
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
 * Poster for the next two items; warm only the immediate next video so the
 * current reel keeps bandwidth.
 */
export function prefetchUpcomingPosts(posts: HomePost[], anchorIndex: number, count = 2) {
  if (!posts.length || anchorIndex < 0) return;
  prefetchPostMedia(posts[anchorIndex], { warmVideo: false });
  const ahead = Math.max(1, count);
  for (let i = 1; i <= ahead; i++) {
    const post = posts[anchorIndex + i];
    if (!post) break;
    prefetchPostMedia(post, { warmVideo: i === 1 });
  }
}
