import type { HomePost, MutualConnectionInfo, UserSearchRecord } from "../services/api";

export type ReelViewerFeedItem =
  | { type: "post"; key: string; post: HomePost }
  | { type: "suggestions"; key: string; pageIndex: number };

const DEFAULT_INTERVAL = 10;
const SUGGESTION_SLIDE_COUNT = 4;
const SUGGESTION_PER_SLIDE = 4;

function jitterForPage(page: number) {
  return ((page * 5 + 1) % 5) - 2;
}

function shuffleUsers<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function mutualScore(userId: number, mutualByUserId: Record<number, MutualConnectionInfo>) {
  const info = mutualByUserId[userId];
  if (!info) return 0;
  return (info.mutualCount ?? 0) * 10 + (info.followsYou ? 8 : 0);
}

function hasMutualConnection(userId: number, mutualByUserId: Record<number, MutualConnectionInfo>) {
  const info = mutualByUserId[userId];
  return !!info && ((info.mutualCount ?? 0) > 0 || info.followsYou);
}

/** Build 3–4 horizontal slides; slide 1 prioritizes mutual friends when the viewer has a friend network. */
export function buildSuggestionSlides(
  users: UserSearchRecord[],
  mutualByUserId: Record<number, MutualConnectionInfo>,
  options?: {
    slideCount?: number;
    perSlide?: number;
    slideOffset?: number;
    hasFriendNetwork?: boolean;
  }
): UserSearchRecord[][] {
  if (!users.length) return [];

  const slideCount = options?.slideCount ?? SUGGESTION_SLIDE_COUNT;
  const perSlide = options?.perSlide ?? SUGGESTION_PER_SLIDE;
  const slideOffset = Math.max(0, options?.slideOffset ?? 0);
  const hasFriendNetwork = options?.hasFriendNetwork ?? false;

  const mutualUsers = users
    .filter((u) => hasMutualConnection(u.id, mutualByUserId))
    .sort((a, b) => mutualScore(b.id, mutualByUserId) - mutualScore(a.id, mutualByUserId));

  const mutualIds = new Set(mutualUsers.map((u) => u.id));
  const otherUsers = users.filter((u) => !mutualIds.has(u.id));

  let ordered: UserSearchRecord[];
  if (hasFriendNetwork && mutualUsers.length > 0) {
    ordered = [...mutualUsers, ...otherUsers];
  } else {
    ordered = shuffleUsers(users);
  }

  if (slideOffset > 0 && ordered.length > perSlide) {
    const rotateBy = (slideOffset * perSlide) % ordered.length;
    ordered = [...ordered.slice(rotateBy), ...ordered.slice(0, rotateBy)];
  }

  const slides: UserSearchRecord[][] = [];
  const maxSlides = Math.min(slideCount, Math.max(1, Math.ceil(ordered.length / perSlide)));

  for (let s = 0; s < maxSlides; s++) {
    const chunk = ordered.slice(s * perSlide, s * perSlide + perSlide);
    if (chunk.length) slides.push(chunk);
  }

  return slides;
}

export function buildReelViewerFeed(
  posts: HomePost[],
  options?: { insertSuggestions?: boolean; interval?: number }
): ReelViewerFeedItem[] {
  if (!posts.length) return [];
  const insertSuggestions = options?.insertSuggestions ?? false;
  const baseInterval = Math.max(6, options?.interval ?? DEFAULT_INTERVAL);
  const items: ReelViewerFeedItem[] = [];
  let postsSinceSuggest = 0;
  let suggestPageIndex = 0;
  let nextAt = baseInterval + jitterForPage(0);

  for (const post of posts) {
    items.push({ type: "post", key: `post-${post.id}`, post });
    postsSinceSuggest += 1;
    if (insertSuggestions && postsSinceSuggest >= nextAt) {
      items.push({
        type: "suggestions",
        key: `suggest-${suggestPageIndex}`,
        pageIndex: suggestPageIndex
      });
      suggestPageIndex += 1;
      postsSinceSuggest = 0;
      nextAt = baseInterval + jitterForPage(suggestPageIndex);
    }
  }
  return items;
}

export function mapPostIndexToFeedIndex(feed: ReelViewerFeedItem[], postIndex: number): number {
  if (!feed.length || postIndex <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < feed.length; i++) {
    const item = feed[i];
    if (item.type !== "post") continue;
    if (seen === postIndex) return i;
    seen += 1;
  }
  return 0;
}

export { SUGGESTION_PER_SLIDE, SUGGESTION_SLIDE_COUNT };
