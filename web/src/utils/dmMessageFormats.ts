export const DM_MEDIA_PREFIX = "[Cropvibe Media]";
export const DM_VOICE_PREFIX = "[Cropvibe Voice]";
export const DM_CALL_PREFIX = "[Cropvibe Call]";
export const DM_REPLY_PREFIX = "[Cropvibe Reply]";
export const DM_REACT_PREFIX = "[Cropvibe React]";
export const DM_STORY_PREFIX = "[Cropvibe Story]";

function asJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function messageBodyText(body: unknown): string {
  if (typeof body === "string") return body.replace(/^\uFEFF/, "").trim();
  const record = asJsonRecord(body);
  if (record) {
    try {
      return JSON.stringify(record);
    } catch {
      return "";
    }
  }
  return String(body ?? "").trim();
}

function parseJsonObjectFromText(raw: string): Record<string, unknown> | null {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return asJsonRecord(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return null;
  }
}

function extractPrefixedJson(body: unknown, prefix: string): Record<string, unknown> | null {
  const fromObject = asJsonRecord(body);
  if (fromObject) return fromObject;
  const raw = messageBodyText(body);
  if (!raw) return null;
  const prefixRe = new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i");
  const found = raw.match(prefixRe);
  if (!found || found.index == null) return null;
  const after = raw.slice(found.index + found[0].length).trim();
  return parseJsonObjectFromText(after);
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
  ownerId?: number;
  text: string;
  kind: "reply" | "like";
  previewUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  userName?: string;
  forwarded?: boolean;
};

function looksLikeStoryPayload(row: Record<string, unknown>): boolean {
  const kind = String(row.kind || "").toLowerCase();
  if (kind === "like" || kind === "reply" || kind === "forward") return true;
  if (row.forwarded === true || row.forwarded === "true") return true;
  if (Number(row.storyId) > 0) return true;
  if ((row.imageUrl || row.previewUrl || row.videoUrl) && (row.text != null || row.userName)) {
    return !String(row.url || "").trim() || (kind !== "image" && kind !== "video");
  }
  return false;
}

function optionalHttpUrl(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function storyPayloadFromRow(parsed: Record<string, unknown>): StoryDmPayload | null {
  if (!looksLikeStoryPayload(parsed)) return null;
  const kind = String(parsed.kind || "").toLowerCase() === "like" ? "like" : "reply";
  const text = String(parsed.text || "").trim() || (kind === "like" ? "❤️" : "");
  if (!text && kind !== "like") return null;
  const imageUrl = optionalHttpUrl(parsed.imageUrl);
  const previewUrl = optionalHttpUrl(parsed.previewUrl) || imageUrl;
  const videoUrl = optionalHttpUrl(parsed.videoUrl);
  const storyId = Number(parsed.storyId);
  const ownerId = Number(parsed.ownerId);
  return {
    storyId: Number.isFinite(storyId) && storyId > 0 ? storyId : undefined,
    ownerId: Number.isFinite(ownerId) && ownerId > 0 ? ownerId : undefined,
    text: text || "❤️",
    kind,
    previewUrl,
    imageUrl,
    videoUrl,
    userName: String(parsed.userName || "").trim() || "Story",
    forwarded:
      parsed.forwarded === true ||
      parsed.forwarded === "true" ||
      String(parsed.kind || "").toLowerCase() === "forward"
  };
}

export function parseStoryDmMessage(body: unknown): StoryDmPayload | null {
  const fromObject = asJsonRecord(body);
  if (fromObject) {
    const direct = storyPayloadFromRow(fromObject);
    if (direct) return direct;
  }

  const prefixed = extractPrefixedJson(body, DM_STORY_PREFIX);
  if (prefixed) {
    const fromPrefix = storyPayloadFromRow(prefixed);
    if (fromPrefix) return fromPrefix;
  }

  const raw = messageBodyText(body);
  if (!raw) return null;
  const loose = parseJsonObjectFromText(raw);
  if (loose) {
    const fromLoose = storyPayloadFromRow(loose);
    if (fromLoose) return fromLoose;
  }

  if (!/\[(?:Cropvibe|AgroVibe)\s+Story\]/i.test(raw) && !/"storyId"\s*:/.test(raw) && !/"kind"\s*:\s*"(like|reply)"/i.test(raw)) {
    return null;
  }
  const kindMatch = raw.match(/"kind"\s*:\s*"(like|reply)"/i);
  const fallbackKind = kindMatch?.[1] === "like" ? "like" : "reply";
  const textMatch = raw.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const imgMatch = raw.match(/"(?:imageUrl|previewUrl)"\s*:\s*"((?:https?:[^"]+|[^"]+))"/);
  const nameMatch = raw.match(/"userName"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const fallbackText = String(textMatch?.[1] || "").replace(/\\"/g, '"').trim() || (fallbackKind === "like" ? "❤️" : "");
  if (!fallbackText && fallbackKind !== "like") return null;
  return {
    text: fallbackText || "❤️",
    kind: fallbackKind,
    imageUrl: imgMatch?.[1] || null,
    previewUrl: imgMatch?.[1] || null,
    userName: String(nameMatch?.[1] || "").replace(/\\"/g, '"').trim() || "Story",
    forwarded: /"forwarded"\s*:\s*true/i.test(raw)
  };
}

export function isStoryDmForwarded(
  story: StoryDmPayload,
  message?: { senderId?: number; receiverId?: number }
): boolean {
  if (story.forwarded) return true;
  const ownerId = Number(story.ownerId);
  const receiverId = Number(message?.receiverId);
  if (!Number.isFinite(ownerId) || ownerId <= 0 || !Number.isFinite(receiverId) || receiverId <= 0) {
    return false;
  }
  // Original story replies/likes are sent to the story owner.
  return receiverId !== ownerId;
}

export function markStoryDmForwarded(body: string): string {
  const story = parseStoryDmMessage(body);
  if (!story) return body;
  return `${DM_STORY_PREFIX} ${JSON.stringify({
    storyId: story.storyId || null,
    ownerId: story.ownerId || null,
    text: story.text,
    previewUrl: story.previewUrl || null,
    imageUrl: story.imageUrl || null,
    videoUrl: story.videoUrl || null,
    userName: story.userName || "Story",
    kind: story.kind,
    forwarded: true
  })}`;
}

export function storyDmChatLabel(story: StoryDmPayload, forwarded: boolean): string {
  const who = story.userName ? ` · ${story.userName}` : "";
  if (forwarded) return `Forwarded story${who}`;
  if (story.kind === "like") return `Liked story${who}`;
  return `Replied to story${who}`;
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
  const text = messageBodyText(body);
  if (!text) return "";
  const story = parseStoryDmMessage(text);
  if (story) {
    if (story.forwarded) return "Forwarded story";
    if (story.kind === "like") return "Liked a story";
    return story.text && story.text !== "❤️" ? story.text : "Replied to story";
  }
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
  const react = parseDmReactMessage(text);
  if (react) return react.emoji ? `Reacted ${react.emoji}` : "Reacted to your message";
  if (text.startsWith("[Cropvibe Reel]") || text.startsWith("[AgroVibe Reel]")) return "Shared a drop";
  if (/\[(?:Cropvibe|AgroVibe)\s+Story\]/i.test(text) || (/^\s*\{/.test(text) && /"storyId"\s*:/.test(text))) {
    return "Replied to story";
  }
  return text;
}

export function dmMessageCopyText(body: string): string {
  const reply = parseDmReplyMessage(body);
  if (reply) return reply.text;
  if (parseDmReactMessage(body)) return "";
  return formatDmInboxPreview(body);
}
