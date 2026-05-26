type PendingJoinLive = {
  postId: number;
};

type JoinLiveListener = (postId: number) => void;

let pending: PendingJoinLive | null = null;
const listeners = new Set<JoinLiveListener>();

export function queueJoinLive(postId: number) {
  if (!Number.isFinite(postId) || postId <= 0) return;
  pending = { postId };
  listeners.forEach((listener) => listener(postId));
}

export function takePendingJoinLive(): PendingJoinLive | null {
  const next = pending;
  pending = null;
  return next;
}

export function subscribeJoinLive(listener: JoinLiveListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
