type ReelProgress = { position: number; duration: number };
type Listener = (postId: number) => void;

const byPostId = new Map<number, ReelProgress>();
const listeners = new Set<Listener>();

export function getReelProgress(postId: number): ReelProgress | undefined {
  return byPostId.get(postId);
}

export function setReelProgress(postId: number, position: number, duration: number): void {
  const nextDuration = Math.max(1, duration);
  const cur = byPostId.get(postId);
  if (cur && Math.abs(cur.position - position) < 200 && cur.duration === nextDuration) return;
  byPostId.set(postId, { position, duration: nextDuration });
  listeners.forEach((fn) => fn(postId));
}

export function subscribeReelProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pruneReelProgress(keepIds: Iterable<number>): void {
  const keep = new Set(keepIds);
  for (const id of byPostId.keys()) {
    if (!keep.has(id)) byPostId.delete(id);
  }
}
