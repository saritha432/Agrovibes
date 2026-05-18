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

export function groupHomeStories(stories: HomeStory[], viewerId: number | null) {
  const playable = stories.filter(hasMedia);
  const own: HomeStory[] = [];
  const other: HomeStory[] = [];

  for (const s of playable) {
    const sid = Number(s.userId);
    if (viewerId && Number.isFinite(sid) && sid === viewerId) {
      own.push(s);
      continue;
    }
    const name = String(s.userName || "")
      .trim()
      .toLowerCase();
    if (name === "you") {
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
