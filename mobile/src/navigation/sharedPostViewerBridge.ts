import type { HomePost } from "../services/api";

type Pending = { post: HomePost; isolated: boolean };

let pending: Pending | null = null;

/**
 * Queues a post to open in Home's fullscreen reel/post viewer (same UI as feed).
 * HomeScreen consumes this on tab focus so we don't need duplicate viewer UI in chat.
 */
export function queueOpenSharedPostViewer(post: HomePost, isolated = true) {
  pending = { post, isolated };
}

export function takePendingSharedPostViewer(): Pending | null {
  const next = pending;
  pending = null;
  return next;
}
