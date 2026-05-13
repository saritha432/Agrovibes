import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "agrovibes.local-dm.v1";

export type DmMessage = {
  id: string;
  threadId: string;
  fromSelf: boolean;
  text: string;
  createdAt: number;
};

type StoreShape = {
  messages: DmMessage[];
};

function normalizeKey(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoreShape) : null;
    if (parsed && Array.isArray(parsed.messages)) return parsed;
  } catch {
    /* ignore */
  }
  return { messages: [] };
}

async function writeStore(store: StoreShape) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Stable id for a 1:1 thread between the current user and a peer. */
export function makeDmThreadId(currentUserKey: string, peerName: string, peerKey?: string) {
  const me = normalizeKey(currentUserKey) || "me";
  const peer = normalizeKey(peerKey || "") || `name:${normalizeKey(peerName)}`;
  const [a, b] = me < peer ? [me, peer] : [peer, me];
  return `${a}∙${b}`;
}

export type DmThreadSummary = {
  threadId: string;
  peerName: string;
  peerKey?: string;
  lastMessage: string;
  lastAt: number;
};

export async function listDmThreads(): Promise<DmThreadSummary[]> {
  const peerLookup = await loadDmPeerMap();
  const { messages } = await readStore();
  const byThread = new Map<string, DmMessage[]>();
  for (const m of messages) {
    const list = byThread.get(m.threadId) || [];
    list.push(m);
    byThread.set(m.threadId, list);
  }
  const out: DmThreadSummary[] = [];
  for (const [threadId, msgs] of byThread) {
    if (!msgs.length) continue;
    const sorted = [...msgs].sort((a, b) => a.createdAt - b.createdAt);
    const last = sorted[sorted.length - 1];
    const meta = peerLookup[threadId];
    const peerName = meta?.name || "Chat";
    out.push({
      threadId,
      peerName,
      peerKey: meta?.key,
      lastMessage: last.text,
      lastAt: last.createdAt
    });
  }
  out.sort((a, b) => b.lastAt - a.lastAt);
  return out;
}

export async function getDmMessages(threadId: string): Promise<DmMessage[]> {
  const { messages } = await readStore();
  return messages.filter((m) => m.threadId === threadId).sort((a, b) => a.createdAt - b.createdAt);
}

export async function appendDmMessage(threadId: string, fromSelf: boolean, text: string) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  const store = await readStore();
  const msg: DmMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    threadId,
    fromSelf,
    text: trimmed,
    createdAt: Date.now()
  };
  store.messages.push(msg);
  await writeStore(store);
  return msg;
}

/** Remember display name for a thread (e.g. after opening chat). */
export async function rememberDmPeer(threadId: string, peerName: string, peerKey?: string) {
  const key = `${STORAGE_KEY}.peers`;
  try {
    const raw = await AsyncStorage.getItem(key);
    const map = raw ? (JSON.parse(raw) as Record<string, { name: string; key?: string }>) : {};
    map[threadId] = { name: peerName, key: peerKey };
    await AsyncStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function loadDmPeerMap(): Promise<Record<string, { name: string; key?: string }>> {
  const key = `${STORAGE_KEY}.peers`;
  try {
    const raw = await AsyncStorage.getItem(key);
    const map = raw ? (JSON.parse(raw) as Record<string, { name: string; key?: string }>) : {};
    return map && typeof map === "object" ? map : {};
  } catch {
    return {};
  }
}
