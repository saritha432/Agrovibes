import { Platform } from "react-native";
import { logAnalyticsEvent } from "../firebase/analytics";
import { playbackSourceKind, type VideoPlaybackSourceKind } from "./videoPlaybackUrl";

const PRODUCTION_API_BASE_URL = "https://cropvibe-api-production.up.railway.app/api";
const API_BASE_URL = (
  (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_BASE_URL || PRODUCTION_API_BASE_URL
).replace(/\/$/, "");

export type ReelPlaybackTelemetryEvent = {
  postId?: number;
  sourceKind: VideoPlaybackSourceKind;
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
  if (recentKeys.size > 80) {
    for (const [k, at] of recentKeys) {
      if (now - at > 30_000) recentKeys.delete(k);
    }
  }
  return true;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function sourceKindFromUri(uri: string | null | undefined): VideoPlaybackSourceKind {
  return playbackSourceKind(uri);
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
    platform: Platform.OS
  };
  void logAnalyticsEvent("reel_playback", payload);
  // Production Railway does not serve this route yet (404). Only post to a local API.
  if (/railway\.app/i.test(API_BASE_URL)) return;
  void fetch(`${API_BASE_URL}/v1/metrics/reel-playback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}
