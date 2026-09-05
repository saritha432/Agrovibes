import type { HomePost } from "../../services/api";

/** Client safety net — matches backend MAX_LIVE_DURATION_MS so stale lives never stick in the story bar. */
const MAX_LIVE_DURATION_MS = 12 * 60 * 60 * 1000;

export function isLivePost(post: HomePost) {
  return /^\[LIVE\]/i.test(String(post.caption || "").trim());
}

function liveStartedAtMs(post: HomePost) {
  const raw = post.liveStartedAt || post.createdAt || "";
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : 0;
}

function isLivePastMaxAge(post: HomePost) {
  const started = liveStartedAtMs(post);
  return started > 0 && Date.now() - started > MAX_LIVE_DURATION_MS;
}

export function isActiveLiveStream(post: HomePost) {
  if (!isLivePost(post)) return false;
  if (post.liveStatus === "ended" || post.liveEndedAt) return false;
  if (isLivePastMaxAge(post)) return false;
  if (post.liveStatus === "active") return true;
  return !String(post.videoUrl || "").trim();
}

export function isCompletedLiveStream(post: HomePost) {
  if (!isLivePost(post)) return false;
  if (isActiveLiveStream(post)) return false;
  return post.liveStatus === "ended" || !!String(post.videoUrl || "").trim();
}

export function findJoinableLivePost(posts: HomePost[], postId: number): HomePost | null {
  const target = posts.find((p) => p.id === postId);
  if (!target || !isLivePost(target)) return null;
  if (target.liveStatus === "ended" || target.liveEndedAt) return null;
  if (isLivePastMaxAge(target)) return null;
  if (isActiveLiveStream(target)) return { ...target, liveStatus: "active" };
  return null;
}

export function viewerCanSeeLivePost(
  post: HomePost,
  viewerUserId: number | undefined,
  followingUserIds: ReadonlySet<number>
): boolean {
  const uid = Number(post.userId);
  if (!Number.isFinite(uid) || uid <= 0) return false;
  if (viewerUserId && uid === viewerUserId) return true;
  return followingUserIds.has(uid);
}

export function buildLiveFeed(
  posts: HomePost[],
  viewerUserId?: number,
  followingUserIds?: ReadonlySet<number>
): HomePost[] {
  const active = posts.filter((p) => isActiveLiveStream(p));
  if (!followingUserIds) return active;
  return active.filter((p) => viewerCanSeeLivePost(p, viewerUserId, followingUserIds));
}

export function buildCompletedLiveFeed(posts: HomePost[]): HomePost[] {
  return posts.filter((p) => isCompletedLiveStream(p));
}

export function liveRoomName(post: HomePost) {
  return post.liveRoomName || `agrovibes-live-${post.id}`;
}
