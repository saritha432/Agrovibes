import { API_BASE_URL } from "../api/client";

export type ReelPlaybackTelemetryEvent = {
  postId?: number;
  sourceKind: "hls" | "mp4" | "original";
  startupMs: number;
  rebufferCount: number;
  rebufferMs: number;
  qualitySwitches: number;
  lastHeight?: number;
  nextPrepMs?: number;
};

let lastNextReelPrepMs: number | undefined;

export function recordNextReelPrepMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return;
  lastNextReelPrepMs = Math.round(ms);
}

export function takeLastNextReelPrepMs(): number | undefined {
  const value = lastNextReelPrepMs;
  lastNextReelPrepMs = undefined;
  return value;
}

const recentKeys = new Map<string, number>();

function shouldSample(postId?: number): boolean {
  const key = String(postId || "na");
  const now = Date.now();
  const prev = recentKeys.get(key) || 0;
  if (now - prev < 4_000) return false;
  recentKeys.set(key, now);
  return true;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function reportReelPlaybackTelemetry(event: ReelPlaybackTelemetryEvent) {
  if (!shouldSample(event.postId)) return;
  const payload = {
    post_id: event.postId ?? 0,
    source: event.sourceKind,
    startup_ms: clampInt(event.startupMs, 0, 120_000),
    rebuf_n: clampInt(event.rebufferCount, 0, 200),
    rebuf_ms: clampInt(event.rebufferMs, 0, 120_000),
    q_switch: clampInt(event.qualitySwitches, 0, 200),
    height: clampInt(event.lastHeight || 0, 0, 4320),
    next_prep_ms: clampInt(event.nextPrepMs || 0, 0, 30_000),
    platform: "web"
  };
  if (/railway\.app/i.test(API_BASE_URL)) return;
  void fetch(`${API_BASE_URL}/v1/metrics/reel-playback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}
