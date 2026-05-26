import type { HomePost } from "../services/api";

type Pending = { posts: HomePost[]; initialIndex: number };

let pending: Pending | null = null;
const listeners = new Set<(pending: Pending) => void>();

/**
 * Queues post(s) to open in Home's fullscreen reel/post viewer (same UI as feed).
 * HomeScreen consumes this on tab focus or via subscribeOpenSharedPostsViewer.
 */
export function queueOpenSharedPostViewer(post: HomePost, isolated = true) {
  queueOpenSharedPostsViewer(isolated ? [post] : [post], 0);
}

export function queueOpenSharedPostsViewer(posts: HomePost[], initialIndex = 0) {
  if (!posts.length) return;
  const next: Pending = {
    posts,
    initialIndex: Math.max(0, Math.min(initialIndex, posts.length - 1))
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
