export const DM_MEDIA_PREFIX = "[Cropvibe Media]";
export const DM_VOICE_PREFIX = "[Cropvibe Voice]";
export const DM_CALL_PREFIX = "[Cropvibe Call]";
export const DM_REPLY_PREFIX = "[Cropvibe Reply]";
export const DM_REACT_PREFIX = "[Cropvibe React]";
export const DM_STORY_PREFIX = "[Cropvibe Story]";

function extractPrefixedJson(body: unknown, prefix: string): Record<string, unknown> | null {
  const raw = String(body ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!raw) return null;
  const prefixRe = new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i");
  const found = raw.match(prefixRe);
  if (!found || found.index == null) return null;
  const after = raw.slice(found.index + found[0].length).trim();
  const start = after.indexOf("{");
  const end = after.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(after.slice(start, end + 1));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

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

export function buildDmMediaMessage(payload: DmMediaPayload) {
  return `${DM_MEDIA_PREFIX}\n${JSON.stringify(payload)}`;
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

function readMediaItem(row: Record<string, unknown>): DmMediaItem | null {
  const url = String(row.url || "").trim();
  const kind = row.kind === "video" ? "video" : row.kind === "image" ? "image" : null;
  if (!url || !kind) return null;
  return {
    kind,
    url,
    width: Number(row.width) || undefined,
    height: Number(row.height) || undefined
  };
}

export function parseDmMediaMessage(body: string): DmMediaPayload | null {
  const parsed = extractPrefixedJson(body, DM_MEDIA_PREFIX);
  if (!parsed) return null;
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    const items: DmMediaItem[] = [];
    for (const entry of parsed.items) {
      if (!entry || typeof entry !== "object") continue;
      const item = readMediaItem(entry as Record<string, unknown>);
      if (item) items.push(item);
    }
    if (!items.length) return null;
    return items.length === 1 ? items[0] : { items };
  }
  return readMediaItem(parsed);
}

export function parseDmVoiceMessage(body: string): DmVoicePayload | null {
  const parsed = extractPrefixedJson(body, DM_VOICE_PREFIX);
  if (!parsed) return null;
  const url = String(parsed.url || "").trim();
  if (!url) return null;
  const durationMs = Number(parsed.durationMs);
  return { url, durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : undefined };
}

export function parseDmReplyMessage(body: string): DmReplyPayload | null {
  const parsed = extractPrefixedJson(body, DM_REPLY_PREFIX);
  if (!parsed) return null;
  const text = String(parsed.text || "").trim();
  const replyPreview = String(parsed.replyPreview || "").trim();
  const replyAuthor = String(parsed.replyAuthor || "").trim() || "Message";
  const replyToId = Number(parsed.replyToId);
  if (!text || !Number.isFinite(replyToId) || replyToId <= 0) return null;
  return { replyToId, replyPreview, replyAuthor, text };
}

export function parseDmReactMessage(body: string): DmReactPayload | null {
  const parsed = extractPrefixedJson(body, DM_REACT_PREFIX);
  if (!parsed) return null;
  const emoji = String(parsed.emoji || "").trim();
  const targetId = Number(parsed.targetId);
  if (!emoji || !Number.isFinite(targetId) || targetId <= 0) return null;
  return { targetId, emoji };
}

export function parseDmCallMessage(body: string): DmCallPayload | null {
  const parsed = extractPrefixedJson(body, DM_CALL_PREFIX);
  if (!parsed) return null;
  try {
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

export type StoryDmPayload = {
  storyId?: number;
  text: string;
  kind: "reply" | "like";
  previewUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  userName?: string;
};

export function parseStoryDmMessage(body: string): StoryDmPayload | null {
  const parsed = extractPrefixedJson(body, DM_STORY_PREFIX);
  const kind = parsed?.kind === "like" ? "like" : "reply";
  const textFromJson = String(parsed?.text || "").trim();
  const text = textFromJson || (kind === "like" ? "❤️" : "");
  if (parsed) {
    if (!text && kind !== "like") return null;
    const imageUrl = typeof parsed.imageUrl === "string" && parsed.imageUrl.trim() ? parsed.imageUrl.trim() : null;
    const previewUrl =
      typeof parsed.previewUrl === "string" && parsed.previewUrl.trim() ? parsed.previewUrl.trim() : null;
    const videoUrl = typeof parsed.videoUrl === "string" && parsed.videoUrl.trim() ? parsed.videoUrl.trim() : null;
    return {
      storyId: Number(parsed.storyId) > 0 ? Number(parsed.storyId) : undefined,
      text,
      kind,
      previewUrl,
      imageUrl,
      videoUrl,
      userName: String(parsed.userName || "").trim() || "Story"
    };
  }

  const raw = String(body ?? "").trim();
  if (!/\[Cropvibe\s+Story\]/i.test(raw)) return null;
  const kindMatch = raw.match(/"kind"\s*:\s*"(like|reply)"/i);
  const fallbackKind = kindMatch?.[1] === "like" ? "like" : "reply";
  const textMatch = raw.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const imgMatch = raw.match(/"(?:imageUrl|previewUrl)"\s*:\s*"(https?:[^"]+)"/);
  const nameMatch = raw.match(/"userName"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const fallbackText = String(textMatch?.[1] || "").replace(/\\"/g, '"').trim() || (fallbackKind === "like" ? "❤️" : "");
  if (!fallbackText && fallbackKind !== "like") return null;
  return {
    text: fallbackText,
    kind: fallbackKind,
    imageUrl: imgMatch?.[1] || null,
    previewUrl: imgMatch?.[1] || null,
    userName: String(nameMatch?.[1] || "").replace(/\\"/g, '"').trim() || "Story"
  };
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

export function formatDmCallLabel(call: DmCallPayload) {
  const kind = call.mode === "video" ? "Video call" : "Voice call";
  if (call.status === "completed") {
    const dur = formatCallDuration(call.durationSec);
    return dur !== "0:00" ? `${kind} · ${dur}` : kind;
  }
  if (call.status === "missed") return `Missed ${kind.toLowerCase()}`;
  if (call.status === "declined") return `Declined ${kind.toLowerCase()}`;
  return `Cancelled ${kind.toLowerCase()}`;
}

export function formatDmInboxPreview(body: string): string {
  const text = String(body || "").trim();
  if (!text) return "";
  const media = parseDmMediaMessage(text);
  if (media) {
    if (dmMediaIsAlbum(media)) return `${media.items.length} photos`;
    return media.kind === "video" ? "Video" : "Photo";
  }
  const voice = parseDmVoiceMessage(text);
  if (voice) return "Voice message";
  const call = parseDmCallMessage(text);
  if (call) return formatDmCallLabel(call);
  const reply = parseDmReplyMessage(text);
  if (reply) return reply.text;
  if (text.startsWith("[Cropvibe Reel]") || text.startsWith("[AgroVibe Reel]")) return "Shared a drop";
  const story = parseStoryDmMessage(text);
  if (story) {
    if (story.kind === "like") return "Liked a story";
    return story.text && story.text !== "❤️" ? story.text : "Replied to story";
  }
  return text;
}

export function dmMessageCopyText(body: string): string {
  const reply = parseDmReplyMessage(body);
  if (reply) return reply.text;
  if (parseDmReactMessage(body)) return "";
  return formatDmInboxPreview(body);
}
