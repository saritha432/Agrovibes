/** Max reel length (seconds) — matches recordAsync maxDuration. */
export const REEL_MAX_RECORD_SECONDS = 180;

export function formatReelCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.min(totalSeconds, REEL_MAX_RECORD_SECONDS));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
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
