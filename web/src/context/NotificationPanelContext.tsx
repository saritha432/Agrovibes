import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { fetchMessageThreads } from "../api/messages";
import {
  fetchSocialNotifications,
  markAllSocialNotificationsRead,
  markSocialNotificationRead,
  respondToFollowRequestById,
  type SocialNotificationItem,
  type SocialPostActivityNotification
} from "../api/social";
import { sendFollowRequest } from "../api/home";
import { useAuth } from "../auth/AuthContext";
import { countMessageUnread } from "../utils/messageUnread";
import type { NotificationFeedItem } from "../components/notifications/NotificationList";

type NotificationPanelValue = {
  notificationUnreadCount: number;
  messageUnreadCount: number;
  items: NotificationFeedItem[];
  followBackIds: Record<number, "none" | "pending" | "accepted">;
  loadNotifications: () => Promise<void>;
  markNotificationsSeen: () => Promise<void>;
  respond: (entry: SocialNotificationItem, action: "accept" | "decline") => Promise<void>;
  followBack: (actorId: number) => Promise<void>;
  dismiss: (entry: SocialNotificationItem | SocialPostActivityNotification) => void;
  activityLabel: (entry: SocialPostActivityNotification) => string;
};

const NotificationPanelContext = createContext<NotificationPanelValue | null>(null);

export function useNotificationPanel() {
  const ctx = useContext(NotificationPanelContext);
  if (!ctx) throw new Error("useNotificationPanel must be used within NotificationPanelProvider");
  return ctx;
}

function activityLabel(entry: SocialPostActivityNotification) {
  const name = entry.actorName || "Someone";
  const kind = entry.postIsReel ? "reel" : "post";
  const excerpt = entry.commentExcerpt?.trim() ? `: "${entry.commentExcerpt.trim()}"` : "";
  if (entry.type === "comment_reply") return `${name} replied to your comment${excerpt}`;
  if (entry.type === "post_comment") return `${name} commented on your ${kind}${excerpt}`;
  return `${name} liked your ${kind}`;
}

export function NotificationPanelProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const { pathname } = useLocation();
  const onNotificationsPage = pathname === "/notifications";

  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [followRequests, setFollowRequests] = useState<SocialNotificationItem[]>([]);
  const [followAccepted, setFollowAccepted] = useState<SocialNotificationItem[]>([]);
  const [postLikes, setPostLikes] = useState<SocialPostActivityNotification[]>([]);
  const [postComments, setPostComments] = useState<SocialPostActivityNotification[]>([]);
  const [liveStarts, setLiveStarts] = useState<SocialPostActivityNotification[]>([]);
  const [followBackIds, setFollowBackIds] = useState<Record<number, "none" | "pending" | "accepted">>({});

  const viewerUserId = useMemo(() => {
    const id = Number(user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [user?.id]);

  const loadCounts = useCallback(async () => {
    if (!token) {
      setMessageUnreadCount(0);
      return;
    }
    try {
      const { threads } = await fetchMessageThreads(token);
      setMessageUnreadCount(countMessageUnread(threads || [], viewerUserId));
    } catch {
      setMessageUnreadCount(0);
    }
  }, [token, viewerUserId]);

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setFollowRequests([]);
      setFollowAccepted([]);
      setPostLikes([]);
      setPostComments([]);
      setLiveStarts([]);
      return;
    }
    await loadCounts();
    try {
      const data = await fetchSocialNotifications(token);
      setFollowRequests(data.followRequests || []);
      setFollowAccepted(data.followAccepted || []);
      setPostLikes(data.postLikes || []);
      setPostComments(data.postComments || []);
      setLiveStarts(data.liveStarts || []);
    } catch {
      // ignore
    }
  }, [loadCounts, token]);

  useEffect(() => {
    void loadNotifications();
    if (!token) return;
    const timer = window.setInterval(() => void loadNotifications(), 5000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, token]);

  const notificationUnreadCount = useMemo(() => {
    if (onNotificationsPage) return 0;
    return (
      followRequests.length +
      followAccepted.length +
      postLikes.length +
      postComments.length +
      liveStarts.length
    );
  }, [
    followAccepted.length,
    followRequests.length,
    liveStarts.length,
    onNotificationsPage,
    postComments.length,
    postLikes.length
  ]);

  const items = useMemo<NotificationFeedItem[]>(() => {
    const rows: NotificationFeedItem[] = [];
    for (const n of followRequests) {
      rows.push({ key: `req-${n.id}`, kind: "pending", createdAt: n.createdAt, entry: n });
    }
    for (const n of followAccepted) {
      rows.push({ key: `acc-${n.id}`, kind: "accepted", createdAt: n.createdAt, entry: n });
    }
    for (const n of liveStarts) {
      rows.push({ key: `live-${n.id}`, kind: "live", createdAt: n.createdAt, entry: n });
    }
    for (const n of postLikes) {
      rows.push({ key: `like-${n.id}`, kind: "post_like", createdAt: n.createdAt, entry: n });
    }
    for (const n of postComments) {
      rows.push({ key: `cmt-${n.id}`, kind: "post_comment", createdAt: n.createdAt, entry: n });
    }
    rows.sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
    return rows;
  }, [followAccepted, followRequests, liveStarts, postComments, postLikes]);

  const dismissOne = useCallback(
    async (id: number) => {
      if (!token) return;
      try {
        await markSocialNotificationRead(token, id);
      } catch {
        // ignore
      }
      setFollowRequests((p) => p.filter((n) => n.id !== id));
      setFollowAccepted((p) => p.filter((n) => n.id !== id));
      setPostLikes((p) => p.filter((n) => n.id !== id));
      setPostComments((p) => p.filter((n) => n.id !== id));
      setLiveStarts((p) => p.filter((n) => n.id !== id));
    },
    [token]
  );

  const dismiss = useCallback(
    (entry: SocialNotificationItem | SocialPostActivityNotification) => {
      void dismissOne(entry.id);
    },
    [dismissOne]
  );

  const respond = useCallback(
    async (entry: SocialNotificationItem, action: "accept" | "decline") => {
      if (!token || !entry.followId) return;
      await respondToFollowRequestById(token, entry.followId, action);
      await dismissOne(entry.id);
      if (action === "accept") {
        setFollowBackIds((p) => ({ ...p, [entry.actorId]: "none" }));
      }
      await loadNotifications();
    },
    [dismissOne, loadNotifications, token]
  );

  const followBack = useCallback(
    async (actorId: number) => {
      if (!token || !actorId) return;
      setFollowBackIds((p) => ({ ...p, [actorId]: "pending" }));
      try {
        await sendFollowRequest(token, actorId);
      } catch {
        setFollowBackIds((p) => ({ ...p, [actorId]: "none" }));
      }
    },
    [token]
  );

  const markNotificationsSeen = useCallback(async () => {
    if (!token) return;
    try {
      await markAllSocialNotificationsRead(token);
    } catch {
      // ignore
    }
    await loadNotifications();
  }, [loadNotifications, token]);

  const value = useMemo<NotificationPanelValue>(
    () => ({
      notificationUnreadCount,
      messageUnreadCount,
      items,
      followBackIds,
      loadNotifications,
      markNotificationsSeen,
      respond,
      followBack,
      dismiss,
      activityLabel
    }),
    [
      dismiss,
      followBack,
      followBackIds,
      items,
      loadNotifications,
      markNotificationsSeen,
      messageUnreadCount,
      notificationUnreadCount,
      respond
    ]
  );

  return <NotificationPanelContext.Provider value={value}>{children}</NotificationPanelContext.Provider>;
}
