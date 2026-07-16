import type { HomeStory } from "../services/api";

export type OpenUserStoriesRequest = {
  userId?: number | null;
  userName?: string | null;
  stories?: HomeStory[];
  preferredStoryId?: number | null;
};

type QueueOpenUserStoriesOptions = {
  /** Wait for Home focus before opening (use when launching from chat / other stacks). */
  deferUntilFocus?: boolean;
};

type OpenStoriesListener = (req: OpenUserStoriesRequest) => void;

let pendingOpen: OpenUserStoriesRequest | null = null;
const openListeners = new Set<OpenStoriesListener>();

const storiesByUserId = new Map<number, HomeStory[]>();
const storiesByName = new Map<string, HomeStory[]>();
let viewedIds = new Set<number>();
const activityListeners = new Set<() => void>();

function normalizeName(name: string | null | undefined) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function notifyActivity() {
  activityListeners.forEach((listener) => listener());
}

function putStory(story: HomeStory) {
  const uid = Number(story.userId);
  if (Number.isFinite(uid) && uid > 0) {
    const prev = storiesByUserId.get(uid) || [];
    if (!prev.some((s) => s.id === story.id)) {
      storiesByUserId.set(uid, [...prev, story]);
    } else {
      storiesByUserId.set(
        uid,
        prev.map((s) => (s.id === story.id ? { ...s, ...story } : s))
      );
    }
  }
  const name = normalizeName(story.userName);
  if (name) {
    const prev = storiesByName.get(name) || [];
    if (!prev.some((s) => s.id === story.id)) {
      storiesByName.set(name, [...prev, story]);
    } else {
      storiesByName.set(
        name,
        prev.map((s) => (s.id === story.id ? { ...s, ...story } : s))
      );
    }
  }
}

export function publishActiveStories(stories: HomeStory[]) {
  for (const story of stories || []) putStory(story);
  notifyActivity();
}

export function setStoryViewedIds(ids: Iterable<number>) {
  viewedIds = new Set(
    [...ids].map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  );
  notifyActivity();
}

export function markStoryIdsViewed(ids: Iterable<number>) {
  let changed = false;
  for (const raw of ids) {
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0 || viewedIds.has(id)) continue;
    viewedIds.add(id);
    changed = true;
  }
  if (changed) notifyActivity();
}

export function getStoriesForUser(userId?: number | null, userName?: string | null): HomeStory[] {
  const uid = Number(userId);
  if (Number.isFinite(uid) && uid > 0) {
    const list = storiesByUserId.get(uid);
    if (list?.length) return list;
  }
  const name = normalizeName(userName);
  if (name) {
    const list = storiesByName.get(name);
    if (list?.length) return list;
  }
  return [];
}

export function userHasActiveStory(userId?: number | null, userName?: string | null): boolean {
  return getStoriesForUser(userId, userName).some((s) => !!(s.videoUrl || s.imageUrl));
}

export function userHasUnviewedStory(userId?: number | null, userName?: string | null): boolean {
  return getStoriesForUser(userId, userName).some(
    (s) => !!(s.videoUrl || s.imageUrl) && !viewedIds.has(Number(s.id))
  );
}

export function subscribeStoryActivity(listener: () => void) {
  activityListeners.add(listener);
  return () => {
    activityListeners.delete(listener);
  };
}

export function queueOpenUserStories(req: OpenUserStoriesRequest, options?: QueueOpenUserStoriesOptions) {
  const uid = Number(req.userId);
  const preferredStoryId = Number(req.preferredStoryId);
  const payload: OpenUserStoriesRequest = {
    userId: Number.isFinite(uid) && uid > 0 ? uid : null,
    userName: req.userName || null,
    stories: req.stories,
    preferredStoryId: Number.isFinite(preferredStoryId) && preferredStoryId > 0 ? preferredStoryId : null
  };
  if (!payload.userId && !payload.userName && !(payload.stories && payload.stories.length) && !payload.preferredStoryId) {
    return;
  }
  pendingOpen = payload;
  if (!options?.deferUntilFocus && openListeners.size > 0) {
    openListeners.forEach((listener) => listener(payload));
  }
}

export function takePendingOpenUserStories(): OpenUserStoriesRequest | null {
  const next = pendingOpen;
  pendingOpen = null;
  return next;
}

export function subscribeOpenUserStories(listener: OpenStoriesListener) {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}
