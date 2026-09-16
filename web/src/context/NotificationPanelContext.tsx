import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  onDirectRead,
  onDirectThreadUpdate,
  onNotificationSync
} from "../services/socketChat";
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

function isLivePostEnded(entry: SocialPostActivityNotification) {
  const status = String(entry.postLiveStatus || "").toLowerCase();
  return status === "ended" || Boolean(entry.postLiveEndedAt);
}

function activityLabel(entry: SocialPostActivityNotification) {
  const name = entry.actorName || "Someone";
  const kind = entry.postIsReel ? "reel" : "post";
  const excerpt = entry.commentExcerpt?.trim() ? `: "${entry.commentExcerpt.trim()}"` : "";
  if (entry.type === "comment_reply") return `${name} replied to your comment${excerpt}`;
  if (entry.type === "post_comment") return `${name} commented on your ${kind}${excerpt}`;
  if (entry.type === "post_tag") return `${name} tagged you in a ${kind}`;
  if (entry.type === "live_host_reminder") return "It's time to start your scheduled live";
  if (entry.type === "live_scheduled") return `${name} scheduled a live`;
  if (entry.type === "live_reminder") return `${name} is going live in 10 minutes`;
  if (entry.type === "live_start" && isLivePostEnded(entry)) return `${name} — Live ended`;
  if (entry.type === "live_start" || entry.type === "live_scheduled" || entry.type === "live_reminder") {
    return `${name} started live`;
  }
  return `${name} liked your ${kind}`;
}

function latestCreatedAtMs(entries: Array<{ createdAt?: string }>): number {
  let max = 0;
  for (const entry of entries) {
    const ts = Date.parse(entry.createdAt || "");
    if (Number.isFinite(ts) && ts > max) max = ts;
  }
  return max;
}

export function NotificationPanelProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const { pathname } = useLocation();
  const onNotificationsPage = pathname === "/notifications";
  const onNotificationsPageRef = useRef(onNotificationsPage);
  onNotificationsPageRef.current = onNotificationsPage;

  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [followRequests, setFollowRequests] = useState<SocialNotificationItem[]>([]);
  const [followAccepted, setFollowAccepted] = useState<SocialNotificationItem[]>([]);
  const [newFollows, setNewFollows] = useState<SocialNotificationItem[]>([]);
  const [postLikes, setPostLikes] = useState<SocialPostActivityNotification[]>([]);
  const [postComments, setPostComments] = useState<SocialPostActivityNotification[]>([]);
  const [liveStarts, setLiveStarts] = useState<SocialPostActivityNotification[]>([]);
  const [followBackIds, setFollowBackIds] = useState<Record<number, "none" | "pending" | "accepted">>({});
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  const [lastSeenMs, setLastSeenMs] = useState(0);
  const lastSeenMsRef = useRef(0);
  lastSeenMsRef.current = lastSeenMs;
  const wasOnNotificationsPageRef = useRef(false);

  const viewerUserId = useMemo(() => {
    const id = Number(user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [user?.id]);

  const lastSeenStorageKey = useMemo(() => {
    if (!viewerUserId) return "";
    return `cropvibe.notifications.lastSeen.${viewerUserId}`;
  }, [viewerUserId]);

  const persistLastSeenMs = useCallback(
    (ms: number) => {
      if (!Number.isFinite(ms) || ms <= lastSeenMsRef.current) return;
      lastSeenMsRef.current = ms;
      setLastSeenMs(ms);
      if (!lastSeenStorageKey) return;
      try {
        localStorage.setItem(lastSeenStorageKey, String(ms));
      } catch {
        // ignore quota / private mode
      }
    },
    [lastSeenStorageKey]
  );

  useEffect(() => {
    if (!lastSeenStorageKey) {
      lastSeenMsRef.current = 0;
      setLastSeenMs(0);
      return;
    }
    try {
      const parsed = Number(localStorage.getItem(lastSeenStorageKey) || 0);
      const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      lastSeenMsRef.current = next;
      setLastSeenMs(next);
    } catch {
      lastSeenMsRef.current = 0;
      setLastSeenMs(0);
    }
  }, [lastSeenStorageKey]);

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
      setNewFollows([]);
      setPostLikes([]);
      setPostComments([]);
      setLiveStarts([]);
      setServerUnreadCount(0);
      return;
    }
    await loadCounts();
    try {
      const data = await fetchSocialNotifications(token);
      const nextFollowRequests = data.followRequests || [];
      const nextFollowAccepted = data.followAccepted || [];
      const nextNewFollows = data.newFollows || [];
      const nextPostLikes = data.postLikes || [];
      const nextPostComments = data.postComments || [];
      const nextLiveStarts = data.liveStarts || [];
      setFollowRequests(nextFollowRequests);
      setFollowAccepted(nextFollowAccepted);
      setNewFollows(nextNewFollows);
      setPostLikes(nextPostLikes);
      setPostComments(nextPostComments);
      setLiveStarts(nextLiveStarts);
      const remoteUnread = Math.max(0, Number(data.unreadCount || 0));
      if (onNotificationsPageRef.current) {
        setServerUnreadCount(0);
        persistLastSeenMs(
          Math.max(
            Date.now(),
            lastSeenMsRef.current,
            latestCreatedAtMs([
              ...nextFollowRequests,
              ...nextFollowAccepted,
              ...nextNewFollows,
              ...nextPostLikes,
              ...nextPostComments,
              ...nextLiveStarts
            ])
          )
        );
        if (remoteUnread > 0) {
          try {
            await markAllSocialNotificationsRead(token);
          } catch {
            // ignore
          }
        }
      } else {
        setServerUnreadCount(remoteUnread);
      }
    } catch {
      // ignore
    }
  }, [loadCounts, persistLastSeenMs, token]);

  useEffect(() => {
    void loadNotifications();
    if (!token) return;
    const timer = window.setInterval(() => void loadNotifications(), 5000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, token]);

  const allEntries = useMemo(
    () => [...followRequests, ...followAccepted, ...newFollows, ...postLikes, ...postComments, ...liveStarts],
    [followAccepted, followRequests, liveStarts, newFollows, postComments, postLikes]
  );
  const allEntriesRef = useRef(allEntries);
  allEntriesRef.current = allEntries;

  const notificationUnreadCount = useMemo(() => {
    if (onNotificationsPage) return 0;
    return Math.max(0, serverUnreadCount);
  }, [onNotificationsPage, serverUnreadCount]);

  const items = useMemo<NotificationFeedItem[]>(() => {
    const rows: NotificationFeedItem[] = [];
    for (const n of followRequests) {
      rows.push({ key: `req-${n.id}`, kind: "pending", createdAt: n.createdAt, entry: n });
    }
    for (const n of followAccepted) {
      rows.push({ key: `acc-${n.id}`, kind: "accepted", createdAt: n.createdAt, entry: n });
    }
    for (const n of newFollows) {
      rows.push({ key: `nf-${n.id}`, kind: "new_follow", createdAt: n.createdAt, entry: n });
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
  }, [followAccepted, followRequests, liveStarts, newFollows, postComments, postLikes]);

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
      setNewFollows((p) => p.filter((n) => n.id !== id));
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
        const res = await sendFollowRequest(token, actorId);
        const status = res.follow?.status === "accepted" ? "accepted" : res.follow?.status === "pending" ? "pending" : "pending";
        setFollowBackIds((p) => ({ ...p, [actorId]: status }));
      } catch {
        setFollowBackIds((p) => ({ ...p, [actorId]: "none" }));
      }
    },
    [token]
  );

  const markNotificationsSeen = useCallback(async () => {
    setServerUnreadCount(0);
    persistLastSeenMs(Math.max(Date.now(), lastSeenMsRef.current, latestCreatedAtMs(allEntriesRef.current)));
    if (!token) return;
    try {
      await markAllSocialNotificationsRead(token);
    } catch {
      // ignore
    }
  }, [persistLastSeenMs, token]);

  useEffect(() => {
    if (onNotificationsPage && !wasOnNotificationsPageRef.current) {
      void markNotificationsSeen();
    }
    if (!onNotificationsPage && wasOnNotificationsPageRef.current) {
      persistLastSeenMs(Math.max(Date.now(), lastSeenMsRef.current, latestCreatedAtMs(allEntriesRef.current)));
    }
    wasOnNotificationsPageRef.current = onNotificationsPage;
  }, [markNotificationsSeen, onNotificationsPage, persistLastSeenMs]);

  useEffect(() => {
    const unsubRead = onDirectRead(() => {
      void loadCounts();
    });
    const unsubThread = onDirectThreadUpdate(() => {
      void loadCounts();
    });
    const unsubNotif = onNotificationSync((payload) => {
      if (typeof payload.unreadCount === "number" && Number.isFinite(payload.unreadCount)) {
        setServerUnreadCount(onNotificationsPageRef.current ? 0 : Math.max(0, payload.unreadCount));
        void loadNotifications();
        return;
      }
      if (payload.unreadDelta) {
        const delta = Number(payload.unreadDelta);
        if (Number.isFinite(delta)) {
          if (onNotificationsPageRef.current) {
            setServerUnreadCount(0);
            void markNotificationsSeen();
          } else {
            setServerUnreadCount((count) => Math.max(0, count + delta));
          }
        }
      }
      void loadNotifications();
    });
    return () => {
      unsubRead();
      unsubThread();
      unsubNotif();
    };
  }, [loadCounts, loadNotifications, markNotificationsSeen]);

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
