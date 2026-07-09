import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchBlockedUsers, type BlockedUser, type HomePost } from "../services/api";

const STORAGE_KEY_PREFIX = "agrovibes.blockedUserIds";

type BlockedUsersListener = () => void;
const listeners = new Set<BlockedUsersListener>();

function storageKey(viewerId?: string | number | null) {
  const key = viewerId != null && String(viewerId).trim() ? String(viewerId).trim() : "anon";
  return `${STORAGE_KEY_PREFIX}.${key}`;
}

async function readCachedBlockedUsers(viewerId?: string | number | null): Promise<BlockedUser[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(viewerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const userId = Number((row as BlockedUser)?.userId);
        if (!Number.isFinite(userId) || userId <= 0) return null;
        return {
          userId,
          fullName: String((row as BlockedUser)?.fullName || "").trim() || "User",
          username: (row as BlockedUser)?.username ?? null,
          avatarUrl: (row as BlockedUser)?.avatarUrl ?? null,
          blockedAt: (row as BlockedUser)?.blockedAt
        } satisfies BlockedUser;
      })
      .filter((row): row is BlockedUser => row != null);
  } catch {
    return [];
  }
}

async function writeCachedBlockedUsers(users: BlockedUser[], viewerId?: string | number | null) {
  try {
    await AsyncStorage.setItem(storageKey(viewerId), JSON.stringify(users));
  } catch {
    // ignore disk errors
  }
}

export function subscribeBlockedUsersChanged(listener: BlockedUsersListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyBlockedUsersChanged() {
  listeners.forEach((listener) => listener());
}

export async function loadBlockedUsers(
  token: string | null | undefined,
  viewerId?: string | number | null
): Promise<BlockedUser[]> {
  if (!token) return [];
  try {
    const data = await fetchBlockedUsers(token);
    const users = Array.isArray(data.users) ? data.users : [];
    await writeCachedBlockedUsers(users, viewerId);
    return users;
  } catch {
    return readCachedBlockedUsers(viewerId);
  }
}

export async function rememberBlockedUser(
  user: Pick<BlockedUser, "userId" | "fullName" | "username" | "avatarUrl">,
  viewerId?: string | number | null
) {
  const cached = await readCachedBlockedUsers(viewerId);
  const next = [
    {
      userId: user.userId,
      fullName: user.fullName,
      username: user.username ?? null,
      avatarUrl: user.avatarUrl ?? null,
      blockedAt: new Date().toISOString()
    },
    ...cached.filter((row) => row.userId !== user.userId)
  ];
  await writeCachedBlockedUsers(next, viewerId);
  notifyBlockedUsersChanged();
}

export async function forgetBlockedUser(userId: number, viewerId?: string | number | null) {
  const cached = await readCachedBlockedUsers(viewerId);
  const next = cached.filter((row) => row.userId !== userId);
  await writeCachedBlockedUsers(next, viewerId);
  notifyBlockedUsersChanged();
}

function normalizeName(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function isPostFromBlockedUser(
  post: Pick<HomePost, "userId" | "userName"> & { repost?: { byUserId?: number | null } | null },
  blockedUsers: BlockedUser[]
): boolean {
  if (!blockedUsers.length) return false;
  const blockedIds = new Set(blockedUsers.map((row) => row.userId));
  const authorId = Number(post.userId);
  if (Number.isFinite(authorId) && authorId > 0 && blockedIds.has(authorId)) return true;
  const repostById = Number(post.repost?.byUserId);
  if (Number.isFinite(repostById) && repostById > 0 && blockedIds.has(repostById)) return true;

  const authorName = normalizeName(post.userName);
  if (!authorName) return false;
  return blockedUsers.some((row) => {
    const fullName = normalizeName(row.fullName);
    const username = normalizeName(row.username);
    return authorName === fullName || (username && authorName === username);
  });
}

export function filterPostsByBlockedUsers<T extends Pick<HomePost, "userId" | "userName"> & { repost?: { byUserId?: number | null } | null }>(
  posts: T[],
  blockedUsers: BlockedUser[]
): T[] {
  if (!blockedUsers.length) return posts;
  return posts.filter((post) => !isPostFromBlockedUser(post, blockedUsers));
}
