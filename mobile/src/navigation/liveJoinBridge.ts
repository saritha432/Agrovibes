type PendingJoinLive = {
  postId: number;
};

let pending: PendingJoinLive | null = null;

export function queueJoinLive(postId: number) {
  if (!Number.isFinite(postId) || postId <= 0) return;
  pending = { postId };
}

export function takePendingJoinLive(): PendingJoinLive | null {
  const next = pending;
  pending = null;
  return next;
}
