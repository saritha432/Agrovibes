import { Platform } from "react-native";
import type { HomePost } from "../services/api";
import { reelGridStillUri } from "./reelGrid";
import { isHlsPlaybackUri, videoPlaybackUrl } from "./videoPlaybackUrl";
import { hasExpoImageNative } from "./hasExpoImageNative";
import { recordNextReelPrepMs } from "./reelPlaybackTelemetry";

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

/** Warm a small prefix of progressive MP4 fallback files. */
const VIDEO_WARM_BYTES = 524_288;
/** First HLS media segment prefix — enough for the opening GOP, not the whole clip. */
const HLS_SEGMENT_WARM_BYTES = 262_144;

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
    el.preload = "metadata";
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

function lowestBandwidthPlaylistRef(body: string) {
  const lines = body.split(/\r?\n/);
  let bestBw = Infinity;
  let bestRef = "";
  let pendingBw: number | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXT-X-STREAM-INF:")) {
      const match = trimmed.match(/BANDWIDTH=(\d+)/i);
      pendingBw = match ? Number(match[1]) : null;
      continue;
    }
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (pendingBw != null && pendingBw < bestBw) {
      bestBw = pendingBw;
      bestRef = trimmed;
    }
    pendingBw = null;
  }
  return bestRef || firstPlaylistRef(body);
}

async function warmHlsStart(url: string, signal?: AbortSignal, depth = 0) {
  if (depth > 3) return;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*" },
    signal
  });
  const text = await res.text().catch(() => "");
  const ref = depth === 0 ? lowestBandwidthPlaylistRef(text) : firstPlaylistRef(text);
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
 * Prefers HLS master + lowest-rung playlist + a small first-segment prefix.
 */
export function warmVideoUri(
  uri: string | null | undefined,
  hlsUrl?: string | null,
  playbackUrl?: string | null
): Promise<void> {
  const raw = typeof uri === "string" ? uri.trim() : "";
  if (!raw && !hlsUrl && !playbackUrl) return Promise.resolve();
  const clean = videoPlaybackUrl(raw || playbackUrl || hlsUrl, hlsUrl, playbackUrl);
  if (!clean || warmedVideos.has(clean)) return Promise.resolve();
  if (clean.startsWith("file:") || clean.startsWith("content:") || clean.startsWith("ph:")) {
    return Promise.resolve();
  }

  if (Platform.OS === "web") {
    warmWebVideo(clean);
    warmedVideos.add(clean);
    return Promise.resolve();
  }

  warmedVideos.add(clean);
  const started = Date.now();
  const { controller, timer } = abortIn(8_000);
  const isHls = isHlsPlaybackUri(clean);

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

  return task
    .then(() => {
      recordNextReelPrepMs(Date.now() - started);
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
    void warmVideoUri(post.videoUrl, post.hlsUrl, post.playbackUrl);
  }
}

/**
 * Poster for the current + next item; warm HLS for only the immediate next reel.
 */
export function prefetchUpcomingPosts(posts: HomePost[], anchorIndex: number, count = 1) {
  if (!posts.length || anchorIndex < 0) return;
  prefetchPostMedia(posts[anchorIndex], { warmVideo: false });
  const ahead = Math.max(1, count);
  for (let i = 1; i <= ahead; i++) {
    const post = posts[anchorIndex + i];
    if (!post) break;
    prefetchPostMedia(post, { warmVideo: i === 1 });
  }
}
