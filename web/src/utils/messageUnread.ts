import type { MessageThread } from "../api/messages";

export function countMessageUnread(threads: MessageThread[], viewerUserId: number | null) {
  return (threads || []).reduce((sum, t) => {
    const hasUnreadCount = t.unreadCount != null;
    const unreadCount = Number(t.unreadCount || 0);
    if (Number.isFinite(unreadCount) && unreadCount > 0) {
      return sum + unreadCount;
    }
    if (!hasUnreadCount && viewerUserId && Number(t.lastSenderId) > 0 && Number(t.lastSenderId) !== viewerUserId) {
      return sum + 1;
    }
    return sum;
  }, 0);
}
