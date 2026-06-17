export const DM_MEDIA_PREFIX = "[Cropvibe Media]";
export const DM_VOICE_PREFIX = "[Cropvibe Voice]";

export type DmMediaPayload = {
  kind: "image" | "video";
  url: string;
  width?: number;
  height?: number;
};

export type DmVoicePayload = {
  url: string;
  durationMs?: number;
};

export function buildDmMediaMessage(payload: DmMediaPayload) {
  return `${DM_MEDIA_PREFIX}\n${JSON.stringify(payload)}`;
}

export function buildDmVoiceMessage(payload: DmVoicePayload) {
  return `${DM_VOICE_PREFIX}\n${JSON.stringify(payload)}`;
}

export function parseDmMediaMessage(body: string): DmMediaPayload | null {
  if (!String(body || "").startsWith(DM_MEDIA_PREFIX)) return null;
  const jsonText = String(body).slice(DM_MEDIA_PREFIX.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const url = String(parsed.url || "").trim();
    const kind = parsed.kind === "video" ? "video" : parsed.kind === "image" ? "image" : null;
    if (!url || !kind) return null;
    return {
      kind,
      url,
      width: Number(parsed.width) || undefined,
      height: Number(parsed.height) || undefined
    };
  } catch {
    return null;
  }
}

export function parseDmVoiceMessage(body: string): DmVoicePayload | null {
  if (!String(body || "").startsWith(DM_VOICE_PREFIX)) return null;
  const jsonText = String(body).slice(DM_VOICE_PREFIX.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const url = String(parsed.url || "").trim();
    if (!url) return null;
    const durationMs = Number(parsed.durationMs);
    return { url, durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : undefined };
  } catch {
    return null;
  }
}

export function formatVoiceDuration(ms?: number) {
  const totalSec = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
