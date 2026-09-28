import type { HomePost } from "../api/types";
import { recordNextReelPrepMs } from "./reelPlaybackTelemetry";
import { isHlsPlaybackUri, resolveWebPostVideoUrl } from "./videoUrl";

const warmedVideos = new Set<string>();
const HLS_SEGMENT_WARM_BYTES = 262_144;
const VIDEO_WARM_BYTES = 524_288;

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
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
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

export async function warmVideoUri(post: Pick<HomePost, "playbackUrl" | "hlsUrl" | "videoUrl">) {
  const clean = resolveWebPostVideoUrl(post);
  if (!clean || warmedVideos.has(clean)) return;
  if (clean.startsWith("blob:") || clean.startsWith("data:")) return;
  warmedVideos.add(clean);
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { controller, timer } = abortIn(8_000);
  try {
    if (isHlsPlaybackUri(clean)) {
      await warmHlsStart(clean, controller?.signal);
    } else {
      await fetch(clean, {
        method: "GET",
        headers: { Range: `bytes=0-${VIDEO_WARM_BYTES - 1}`, Accept: "video/*,*/*" },
        signal: controller?.signal
      }).then((res) => res.arrayBuffer().catch(() => null));
    }
    recordNextReelPrepMs((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
  } catch {
    warmedVideos.delete(clean);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Warm only the immediate next reel (HLS master + first segment, or MP4 prefix). */
export function prefetchUpcomingPosts(posts: HomePost[], anchorIndex: number) {
  const next = posts[anchorIndex + 1];
  if (!next?.videoUrl && !next?.hlsUrl && !next?.playbackUrl) return;
  void warmVideoUri(next);
}
