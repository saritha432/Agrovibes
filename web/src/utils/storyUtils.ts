import type { HomeStory } from "../api/types";

export type StoryGroup = {
  key: string;
  userName: string;
  avatarUrl?: string | null;
  stories: HomeStory[];
};

function storyAuthorKey(s: HomeStory) {
  const sid = Number(s.userId);
  if (Number.isFinite(sid) && sid > 0) return `uid:${sid}`;
  const name = String(s.userName || "")
    .trim()
    .toLowerCase();
  if (name && name !== "you") return `name:${name}`;
  return `row:${s.id}`;
}

function hasMedia(s: HomeStory) {
  return !!(s.videoUrl || s.imageUrl);
}

function storyTimeMs(s: HomeStory) {
  const t = Date.parse(String(s.createdAt || ""));
  return Number.isFinite(t) ? t : 0;
}

function sortStories(rows: HomeStory[]) {
  return [...rows].sort((a, b) => storyTimeMs(a) - storyTimeMs(b) || a.id - b.id);
}

function normalizeIdentity(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function viewerIdentityKeys(viewerName?: string | null, viewerUsername?: string | null) {
  const keys = new Set<string>();
  const name = normalizeIdentity(viewerName);
  const username = normalizeIdentity(viewerUsername);
  if (name) {
    keys.add(name);
    const first = name.split(/\s+/)[0];
    if (first) keys.add(first);
  }
  if (username) keys.add(username);
  return keys;
}

export function isOwnHomeStory(
  story: HomeStory | null | undefined,
  viewerId?: number | null,
  viewerName?: string | null,
  viewerUsername?: string | null
) {
  if (!story) return false;
  const ownerId = Number(story.userId);
  const viewer = Number(viewerId);
  if (Number.isFinite(ownerId) && ownerId > 0 && Number.isFinite(viewer) && viewer > 0) {
    return ownerId === viewer;
  }
  const storyName = normalizeIdentity(story.userName);
  if (storyName === "you" || storyName === "your story") return true;
  if (!storyName) return false;
  return viewerIdentityKeys(viewerName, viewerUsername).has(storyName);
}

export function groupHomeStories(
  stories: HomeStory[],
  viewerId: number | null,
  viewerName?: string | null,
  viewerUsername?: string | null
) {
  const playable = stories.filter(hasMedia);
  const own: HomeStory[] = [];
  const other: HomeStory[] = [];

  for (const s of playable) {
    if (isOwnHomeStory(s, viewerId, viewerName, viewerUsername)) {
      own.push(s);
      continue;
    }
    other.push(s);
  }

  const byKey = new Map<string, HomeStory[]>();
  for (const s of other) {
    const k = storyAuthorKey(s);
    const arr = byKey.get(k) ?? [];
    arr.push(s);
    byKey.set(k, arr);
  }

  const groups: StoryGroup[] = [];
  for (const [key, list] of byKey) {
    const sorted = sortStories(list);
    const head = sorted[0];
    groups.push({
      key,
      userName: head.userName,
      avatarUrl: sorted.map((s) => s.avatarUrl).find((u) => u?.trim()) ?? head.avatarUrl,
      stories: sorted
    });
  }

  groups.sort(
    (a, b) =>
      storyTimeMs(b.stories[b.stories.length - 1]) - storyTimeMs(a.stories[a.stories.length - 1])
  );

  return { ownStories: sortStories(own), otherGroups: groups };
}
