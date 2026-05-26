export type LiveComment = {
  id: string;
  name: string;
  text: string;
};

export type LiveViewer = {
  id: string;
  name: string;
  role: "Host" | "Viewer";
};

export type LiveDataMessage =
  | { type: "comment"; name?: string; text: string }
  | { type: "live_ended" };

export function encodeLiveDataMessage(message: LiveDataMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message));
}

export function parseLiveDataMessage(payload: Uint8Array): LiveDataMessage | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload));
    if (parsed?.type === "comment" && parsed.text) {
      return { type: "comment", name: parsed.name, text: String(parsed.text).slice(0, 240) };
    }
    if (parsed?.type === "live_ended") {
      return { type: "live_ended" };
    }
    return null;
  } catch {
    return null;
  }
}

export function liveViewerCount(viewers: LiveViewer[] | string[], isHost: boolean): number {
  if (Array.isArray(viewers) && viewers.length && typeof viewers[0] === "object") {
    const rows = viewers as LiveViewer[];
    if (!rows.length) return 0;
    return isHost ? Math.max(rows.length - 1, 0) : rows.length;
  }
  const unique = [...new Set((viewers as string[]).filter(Boolean))];
  if (!unique.length) return 0;
  return isHost ? Math.max(unique.length - 1, 0) : unique.length;
}
