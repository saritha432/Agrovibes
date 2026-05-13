import AsyncStorage from "@react-native-async-storage/async-storage";

const ENGAGEMENT_KEY = "agrovibes.local-engagement.v1";
const LIKED_POSTS_KEY = "agrovibes.local-liked-posts.v2";
const LIKED_POSTS_KEY_V1 = "agrovibes.local-liked-posts.v1";
const LOCAL_COMMENTS_KEY = "agrovibes.local-comments.v1";

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type LocalEngagementRecord = {
  id: string;
  type: "post_like" | "post_comment" | "comment_reply";
  actorName: string;
  recipientNameNorm: string;
  postId: number;
  isReel: boolean;
  commentExcerpt?: string;
  read: boolean;
  createdAt: string;
};

async function readEngagement(): Promise<LocalEngagementRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(ENGAGEMENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalEngagementRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeEngagement(records: LocalEngagementRecord[]) {
  await AsyncStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(records));
}

type LocalPostLikeMap = Record<string, string[]>;
type LocalCommentRecord = {
  id: string;
  postId: number;
  user: string;
  userKey?: string;
  text: string;
  likes: number;
  createdAt: string;
  parentCommentId?: string;
};

function identityKey(identity: { name: string; key?: string }) {
  const key = String(identity.key || "").trim().toLowerCase();
  if (key) return `key:${key}`;
  return `name:${normalizeName(identity.name)}`;
}

async function readLikeMap(): Promise<LocalPostLikeMap> {
  try {
    const raw = await AsyncStorage.getItem(LIKED_POSTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalPostLikeMap) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLikeMap(map: LocalPostLikeMap) {
  await AsyncStorage.setItem(LIKED_POSTS_KEY, JSON.stringify(map));
}

async function readLegacyLikedPostIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(LIKED_POSTS_KEY_V1);
    const parsed = raw ? (JSON.parse(raw) as number[]) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isFinite(n) && n > 0) : [];
  } catch {
    return [];
  }
}

async function readLocalComments(): Promise<LocalCommentRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_COMMENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalCommentRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalComments(rows: LocalCommentRecord[]) {
  await AsyncStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(rows.slice(0, 500)));
}

/** For same-device testing or when the hosted API has no engagement routes yet. */
export async function appendLocalEngagementNotification(payload: {
  type: "post_like" | "post_comment" | "comment_reply";
  actorName: string;
  recipientDisplayName: string;
  postId: number;
  isReel: boolean;
  commentExcerpt?: string;
}) {
  const recipientNameNorm = normalizeName(payload.recipientDisplayName);
  const actorNorm = normalizeName(payload.actorName);
  if (!recipientNameNorm || !actorNorm || recipientNameNorm === actorNorm) return;

  const records = await readEngagement();
  const now = new Date().toISOString();
  const row: LocalEngagementRecord = {
    id: `le-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    type: payload.type,
    actorName: payload.actorName.trim(),
    recipientNameNorm,
    postId: payload.postId,
    isReel: payload.isReel,
    commentExcerpt: payload.commentExcerpt,
    read: false,
    createdAt: now
  };
  records.unshift(row);
  await writeEngagement(records.slice(0, 200));
}

export async function getLocalEngagementNotificationsForViewer(viewerName: string) {
  const norm = normalizeName(viewerName);
  if (!norm) return { postLikes: [] as LocalEngagementRecord[], postComments: [] as LocalEngagementRecord[] };
  const records = await readEngagement();
  const mine = records.filter((r) => r.recipientNameNorm === norm && !r.read);
  return {
    postLikes: mine.filter((r) => r.type === "post_like"),
    postComments: mine.filter((r) => r.type === "post_comment" || r.type === "comment_reply")
  };
}

export async function markLocalEngagementRead(id: string) {
  const records = await readEngagement();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) return;
  records[idx] = { ...records[idx], read: true };
  await writeEngagement(records);
}

export async function getLocalLikeStateForPosts(
  viewer: { name: string; key?: string },
  postIds: number[]
): Promise<{ likedPostIds: Set<number>; likesCountByPost: Record<number, number> }> {
  const map = await readLikeMap();
  // One-time migration from old global like list.
  if (Object.keys(map).length === 0) {
    const legacy = await readLegacyLikedPostIds();
    if (legacy.length) {
      for (const id of legacy) {
        map[String(id)] = ["legacy:migrated"];
      }
      await writeLikeMap(map);
    }
  }
  const viewerKey = identityKey(viewer);
  const ids = [...new Set(postIds.filter((id) => Number.isFinite(id) && id > 0))];
  const likedPostIds = new Set<number>();
  const likesCountByPost: Record<number, number> = {};
  for (const id of ids) {
    const actors = Array.isArray(map[String(id)]) ? map[String(id)] : [];
    likesCountByPost[id] = actors.length;
    if (actors.includes(viewerKey)) likedPostIds.add(id);
  }
  return { likedPostIds, likesCountByPost };
}

export async function setLocalPostLikedByIdentity(
  postId: number,
  viewer: { name: string; key?: string },
  liked: boolean
): Promise<{ liked: boolean; likesCount: number }> {
  if (!Number.isFinite(postId) || postId <= 0) return { liked: false, likesCount: 0 };
  const map = await readLikeMap();
  const key = String(postId);
  const actor = identityKey(viewer);
  const before = Array.isArray(map[key]) ? map[key] : [];
  const unique = [...new Set(before)];
  const has = unique.includes(actor);
  let next = unique;
  if (liked && !has) next = [...unique, actor];
  if (!liked && has) next = unique.filter((v) => v !== actor);
  map[key] = next;
  await writeLikeMap(map);
  return { liked: next.includes(actor), likesCount: next.length };
}

export async function getLocalCommentsForPost(postId: number) {
  if (!Number.isFinite(postId) || postId <= 0)
    return [] as Array<{ id: string; user: string; text: string; likes: number; createdAt?: string; parentCommentId?: string }>;
  const rows = await readLocalComments();
  return rows
    .filter((r) => Number(r.postId) === Number(postId))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((r) => ({
      id: r.id,
      user: r.user,
      text: r.text,
      likes: r.likes,
      createdAt: r.createdAt,
      parentCommentId: r.parentCommentId
    }));
}

export async function addLocalCommentForPost(payload: {
  postId: number;
  user: string;
  userKey?: string;
  text: string;
  likes?: number;
  parentCommentId?: string;
}) {
  if (!Number.isFinite(payload.postId) || payload.postId <= 0) return null;
  const text = String(payload.text || "").trim();
  if (!text) return null;
  const rows = await readLocalComments();
  const parentId = payload.parentCommentId != null ? String(payload.parentCommentId).trim() : "";
  const record: LocalCommentRecord = {
    id: `lc-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    postId: payload.postId,
    user: String(payload.user || "You"),
    userKey: payload.userKey ? String(payload.userKey).toLowerCase() : undefined,
    text,
    likes: Number.isFinite(payload.likes) ? Number(payload.likes) : 0,
    createdAt: new Date().toISOString(),
    parentCommentId: parentId || undefined
  };
  rows.push(record);
  await writeLocalComments(rows);
  return {
    id: record.id,
    user: record.user,
    text: record.text,
    likes: record.likes,
    createdAt: record.createdAt,
    parentCommentId: record.parentCommentId
  };
}
