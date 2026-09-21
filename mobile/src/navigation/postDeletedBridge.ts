/**
 * Broadcast when a home post/reel is deleted so Home, Search, and other screens
 * can drop it immediately (profile delete otherwise only updates local profile state).
 */

const listeners = new Set<(postId: number) => void>();

export function emitPostDeleted(postId: number) {
  const id = Number(postId);
  if (!Number.isFinite(id) || id <= 0) return;
  listeners.forEach((fn) => {
    try {
      fn(id);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function subscribePostDeleted(handler: (postId: number) => void) {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}
