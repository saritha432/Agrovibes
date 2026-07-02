export const DM_MEDIA_PREFIX = "[Cropvibe Media]";
export const DM_VOICE_PREFIX = "[Cropvibe Voice]";
export const DM_CALL_PREFIX = "[Cropvibe Call]";
export const DM_REPLY_PREFIX = "[Cropvibe Reply]";
export const DM_REACT_PREFIX = "[Cropvibe React]";

export type DmCallStatus = "completed" | "missed" | "declined" | "cancelled";
export type DmCallMode = "voice" | "video";

export type DmCallPayload = {
  mode: DmCallMode;
  status: DmCallStatus;
  durationSec?: number;
  direction: "outgoing" | "incoming";
};

export type DmMediaItem = {
  kind: "image" | "video";
  url: string;
  width?: number;
  height?: number;
};

export type DmMediaPayload = DmMediaItem | { items: DmMediaItem[] };

export function dmMediaIsAlbum(payload: DmMediaPayload): payload is { items: DmMediaItem[] } {
  return "items" in payload && Array.isArray(payload.items) && payload.items.length > 1;
}

export function dmMediaItems(payload: DmMediaPayload): DmMediaItem[] {
  return dmMediaIsAlbum(payload) ? payload.items : [payload];
}

export function dmMediaPrimaryItem(payload: DmMediaPayload): DmMediaItem {
  return dmMediaItems(payload)[0];
}

export type DmVoicePayload = {
  url: string;
  durationMs?: number;
};

export type DmReplyPayload = {
  replyToId: number;
  replyPreview: string;
  replyAuthor: string;
  text: string;
};

export type DmReactPayload = {
  targetId: number;
  emoji: string;
};

export function buildDmMediaMessage(payload: DmMediaItem) {
  return `${DM_MEDIA_PREFIX}\n${JSON.stringify(payload)}`;
}

export function buildDmMediaAlbumMessage(items: DmMediaItem[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return buildDmMediaMessage(items[0]);
  return `${DM_MEDIA_PREFIX}\n${JSON.stringify({ items })}`;
}

export function buildDmVoiceMessage(payload: DmVoicePayload) {
  return `${DM_VOICE_PREFIX}\n${JSON.stringify(payload)}`;
}

export function buildDmReplyMessage(payload: DmReplyPayload) {
  return `${DM_REPLY_PREFIX}\n${JSON.stringify(payload)}`;
}

export function buildDmReactMessage(payload: DmReactPayload) {
  return `${DM_REACT_PREFIX}\n${JSON.stringify(payload)}`;
}

export function parseDmMediaMessage(body: string): DmMediaPayload | null {
  if (!String(body || "").startsWith(DM_MEDIA_PREFIX)) return null;
  const jsonText = String(body).slice(DM_MEDIA_PREFIX.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const itemsRaw = parsed.items;
    if (Array.isArray(itemsRaw) && itemsRaw.length > 0) {
      const items: DmMediaItem[] = [];
      for (const entry of itemsRaw) {
        if (!entry || typeof entry !== "object") continue;
        const row = entry as Record<string, unknown>;
        const url = String(row.url || "").trim();
        const kind = row.kind === "video" ? "video" : row.kind === "image" ? "image" : null;
        if (!url || !kind) continue;
        items.push({
          kind,
          url,
          width: Number(row.width) || undefined,
          height: Number(row.height) || undefined
        });
      }
      if (!items.length) return null;
      if (items.length === 1) return items[0];
      return { items };
    }
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

export function parseDmReplyMessage(body: string): DmReplyPayload | null {
  if (!String(body || "").startsWith(DM_REPLY_PREFIX)) return null;
  const jsonText = String(body).slice(DM_REPLY_PREFIX.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const text = String(parsed.text || "").trim();
    const replyPreview = String(parsed.replyPreview || "").trim();
    const replyAuthor = String(parsed.replyAuthor || "").trim() || "Message";
    const replyToId = Number(parsed.replyToId);
    if (!text || !Number.isFinite(replyToId) || replyToId <= 0) return null;
    return { replyToId, replyPreview, replyAuthor, text };
  } catch {
    return null;
  }
}

export function parseDmReactMessage(body: string): DmReactPayload | null {
  if (!String(body || "").startsWith(DM_REACT_PREFIX)) return null;
  const jsonText = String(body).slice(DM_REACT_PREFIX.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const emoji = String(parsed.emoji || "").trim();
    const targetId = Number(parsed.targetId);
    if (!emoji || !Number.isFinite(targetId) || targetId <= 0) return null;
    return { targetId, emoji };
  } catch {
    return null;
  }
}

export function dmMessageCopyText(body: string, t: (key: string) => string): string {
  const reply = parseDmReplyMessage(body);
  if (reply) return reply.text;
  return formatDmInboxPreview(body, t);
}

/** Short preview for reply composer + quote chips (includes media labels). */
export function dmReplyPreviewForMessage(body: string, t: (key: string) => string): string {
  const media = parseDmMediaMessage(body);
  if (media) {
    if (dmMediaIsAlbum(media)) {
      const count = media.items.length;
      return count > 1 ? `${count} ${t("sharedMedia")}` : t("sharedMedia");
    }
    return media.kind === "video" ? t("sharedVideo") : t("sharedMedia");
  }
  const voice = parseDmVoiceMessage(body);
  if (voice) return t("voiceMessage");
  const call = parseDmCallMessage(body);
  if (call) return formatDmCallLabel(call, t);
  if (String(body || "").startsWith("[Cropvibe Reel]") || String(body || "").startsWith("[AgroVibe Reel]")) {
    return t("sharedReel");
  }
  if (String(body || "").startsWith("[Cropvibe Profile]")) return t("sharedProfile");
  if (String(body || "").startsWith("[Cropvibe Live]")) return t("sharedLive");
  const plain = formatDmInboxPreview(body, t);
  return plain.length > 120 ? `${plain.slice(0, 117)}…` : plain;
}

export function formatVoiceDuration(ms?: number) {
  const totalSec = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatCallDuration(sec?: number) {
  const totalSec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildDmCallMessage(payload: DmCallPayload) {
  return `${DM_CALL_PREFIX}\n${JSON.stringify(payload)}`;
}

export function parseDmCallMessage(body: string): DmCallPayload | null {
  if (!String(body || "").startsWith(DM_CALL_PREFIX)) return null;
  const jsonText = String(body).slice(DM_CALL_PREFIX.length).trim();
  if (!jsonText.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const mode = parsed.mode === "video" ? "video" : parsed.mode === "voice" ? "voice" : null;
    const status =
      parsed.status === "completed" ||
      parsed.status === "missed" ||
      parsed.status === "declined" ||
      parsed.status === "cancelled"
        ? parsed.status
        : null;
    const direction = parsed.direction === "incoming" ? "incoming" : parsed.direction === "outgoing" ? "outgoing" : null;
    if (!mode || !status || !direction) return null;
    const durationSec = Number(parsed.durationSec);
    return {
      mode,
      status,
      direction,
      durationSec: Number.isFinite(durationSec) && durationSec >= 0 ? durationSec : undefined
    };
  } catch {
    return null;
  }
}

export function formatDmCallLabel(call: DmCallPayload, t: (key: string) => string) {
  const kind = call.mode === "video" ? t("videoCall") : t("audioCall");
  if (call.status === "completed") {
    const dur = formatCallDuration(call.durationSec);
    return dur !== "0:00" ? `${kind} · ${dur}` : kind;
  }
  if (call.status === "missed") return t("missedCall").replace("{{kind}}", kind);
  if (call.status === "declined") return t("declinedCall").replace("{{kind}}", kind);
  return t("cancelledCall").replace("{{kind}}", kind);
}

/** Inbox + notification-style preview for structured chat payloads (WhatsApp / Instagram). */
export function formatDmInboxPreview(body: string, t: (key: string) => string): string {
  const text = String(body || "").trim();
  if (!text) return "";

  const media = parseDmMediaMessage(text);
  if (media) {
    if (dmMediaIsAlbum(media)) {
      const count = media.items.length;
      return count > 1 ? `${count} ${t("sharedMedia")}` : t("sharedMedia");
    }
    return media.kind === "video" ? t("sharedVideo") : t("sharedMedia");
  }

  const voice = parseDmVoiceMessage(text);
  if (voice) {
    if (voice.durationMs) {
      return `${t("voiceMessage")} (${formatVoiceDuration(voice.durationMs)})`;
    }
    return t("voiceMessage");
  }

  const call = parseDmCallMessage(text);
  if (call) return formatDmCallLabel(call, t);

  const reply = parseDmReplyMessage(text);
  if (reply) return reply.text;

  if (parseDmReactMessage(text)) return "";

  if (text.startsWith("[Cropvibe Live]")) return t("sharedLive");
  if (text.startsWith("[Cropvibe Reel]") || text.startsWith("[AgroVibe Reel]")) return t("sharedReel");
  if (text.startsWith("[Cropvibe Post]")) return t("sharedPost");
  if (text.startsWith("[Cropvibe Profile]")) return t("sharedProfile");

  return text;
}
