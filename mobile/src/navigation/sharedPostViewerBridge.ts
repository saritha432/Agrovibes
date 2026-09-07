import type { HomePost } from "../services/api";

type Pending = {
  posts: HomePost[];
  initialIndex: number;
  returnToNotifications?: boolean;
};

type QueueOptions = {
  /** After closing the fullscreen viewer, reopen the notifications sheet. */
  returnToNotifications?: boolean;
};

let pending: Pending | null = null;
let returnToNotifications = false;
const listeners = new Set<(pending: Pending) => void>();

/**
 * Queues post(s) to open in Home's fullscreen reel/post viewer (same UI as feed).
 * HomeScreen consumes this on tab focus or via subscribeOpenSharedPostsViewer.
 */
export function queueOpenSharedPostViewer(post: HomePost, isolated = true, opts?: QueueOptions) {
  queueOpenSharedPostsViewer(isolated ? [post] : [post], 0, opts);
}

export function queueOpenSharedPostsViewer(posts: HomePost[], initialIndex = 0, opts?: QueueOptions) {
  if (!posts.length) return;
  if (opts?.returnToNotifications) {
    returnToNotifications = true;
  }
  const next: Pending = {
    posts,
    initialIndex: Math.max(0, Math.min(initialIndex, posts.length - 1)),
    returnToNotifications: !!opts?.returnToNotifications
  };
  pending = next;
  listeners.forEach((fn) => fn(next));
}

export function takePendingSharedPostViewer(): Pending | null {
  const next = pending;
  pending = null;
  return next;
}

export function subscribeOpenSharedPostsViewer(handler: (pending: Pending) => void) {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

/** True when Home (or another screen) is ready to open the shared viewer without navigating. */
export function hasSharedPostViewerListener() {
  return listeners.size > 0;
}

export function consumeReturnToNotifications(): boolean {
  const next = returnToNotifications;
  returnToNotifications = false;
  return next;
}

export function clearReturnToNotifications() {
  returnToNotifications = false;
}
