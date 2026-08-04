/** Max reel length (seconds) — matches recordAsync maxDuration. */
export const REEL_MAX_RECORD_SECONDS = 180;

export function formatReelCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.min(totalSeconds, REEL_MAX_RECORD_SECONDS));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** UI zoom steps shown as 1x / 2x in Create camera. */
export type StoryCameraZoomLevel = 1 | 2;

/** Maps 1x/2x UI to Expo `CameraView` zoom (0–1 fraction of device max zoom). */
export function storyZoomToExpoRatio(level: StoryCameraZoomLevel): number {
  // 1x = no digital zoom; 2x ≈ half of device max so the step is clearly visible.
  return level === 2 ? 0.5 : 0;
}

export type StoryCameraPreviewHandle = {
  takePictureAsync: (options?: { quality?: number }) => Promise<{
    uri: string;
    width?: number;
    height?: number;
  } | null>;
  startRecording: (options?: { maxDurationSec?: number }) => Promise<void>;
  stopRecording: () => Promise<{ uri: string } | null>;
  isRecording: () => boolean;
};
