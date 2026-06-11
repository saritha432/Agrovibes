import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import {
  fetchMessageThreads,
  fetchRelationships,
  markAllSocialNotificationsRead,
  markSocialNotificationRead,
  respondToFollowRequest,
  sendFollowRequest
} from "../services/api";
import {
  getLocalRelationshipMapByNames,
  markLocalAcceptedSeen,
  markLocalDeclinedSeen,
  respondLocalFollowRequest,
  sendLocalFollowRequestByIdentity
} from "../social/localFollowStore";
import { markLocalEngagementRead } from "../social/localEngagementStore";
import {
  countUnreadSocialNotifications,
  fetchNotificationFeedSnapshot,
  flattenNotificationFeedSnapshot
} from "../social/notificationFeedSnapshot";
import { APP_LIME } from "../theme/appColors";
import { useLanguage } from "../localization/LanguageContext";
import { navigateToJoinLive } from "../navigation/navigationRef";
import { queueJoinLive } from "../navigation/liveJoinBridge";
import { queueOpenLiveCreate } from "../navigation/liveCreateBridge";

type NotificationPanelContextValue = {
  sheetOpen: boolean;
  openNotificationSheet: () => void;
  closeNotificationSheet: () => void;
  notificationUnreadCount: number;
  messageUnreadCount: number;
};

const NotificationPanelContext = createContext<NotificationPanelContextValue | null>(null);

export function useNotificationPanel(): NotificationPanelContextValue {
  const ctx = useContext(NotificationPanelContext);
  if (!ctx) {
    throw new Error("useNotificationPanel must be used within NotificationPanelProvider");
  }
  return ctx;
}

export function NotificationPanelProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [accepted, setAccepted] = useState<any[]>([]);
  const [declined, setDeclined] = useState<any[]>([]);
  const [followBackStatusByKey, setFollowBackStatusByKey] = useState<Record<string, "none" | "pending" | "accepted">>({});
  const [followBackQueue, setFollowBackQueue] = useState<any[]>([]);
  const followBackQueueRef = useRef<any[]>([]);
  useEffect(() => {
    followBackQueueRef.current = followBackQueue;
  }, [followBackQueue]);
  const [followBackPromptByKey, setFollowBackPromptByKey] = useState<Record<string, boolean>>({});
  const [postLikes, setPostLikes] = useState<any[]>([]);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [liveStarts, setLiveStarts] = useState<any[]>([]);
  const [lastSeenMs, setLastSeenMs] = useState(0);
  const [lastSeenReady, setLastSeenReady] = useState(false);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);

  const viewerUserId = useMemo(() => {
    const parsed = Number(user?.id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [user?.id]);

  const notificationSeenKey = useMemo(() => {
    if (viewerUserId) return `agrovibes.notifications.lastSeen.v2.uid.${viewerUserId}`;
    const identity = String(user?.email || user?.fullName || "guest").toLowerCase();
    return `agrovibes.notifications.lastSeen.v2.${identity}`;
  }, [user?.email, user?.fullName, viewerUserId]);

  const lastSeenMsRef = useRef(0);
  lastSeenMsRef.current = lastSeenMs;
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const persistLastSeenMs = useCallback(
    async (ms: number) => {
      setLastSeenMs(ms);
      lastSeenMsRef.current = ms;
      try {
        await AsyncStorage.setItem(notificationSeenKey, String(ms));
      } catch {
        // no-op
      }
    },
    [notificationSeenKey]
  );

  const bumpLastSeenFromEntry = useCallback(
    (entry: any) => {
      const ts = Date.parse(String(entry?.createdAt || ""));
      const next =
        Number.isFinite(ts) && ts > 0 ? Math.max(lastSeenMsRef.current, ts) : Date.now();
      setLastSeenMs(next);
      lastSeenMsRef.current = next;
      void AsyncStorage.setItem(notificationSeenKey, String(next)).catch(() => {});
    },
    [notificationSeenKey]
  );

  const notificationEntryId = useCallback((entry: any) => {
    if (entry?.id == null) return "";
    return String(entry.id);
  }, []);

  const filterOutNotificationEntry = useCallback(
    (list: any[], entry: any) => {
      const entryId = notificationEntryId(entry);
      if (!entryId) return list;
      return list.filter((n) => String(n?.id) !== entryId);
    },
    [notificationEntryId]
  );

  const filterDismissedNotifications = useCallback((list: any[]) => {
    const dismissed = dismissedIdsRef.current;
    if (!dismissed.size) return list;
    return list.filter((n) => !dismissed.has(String(n?.id)));
  }, []);

  const optimisticDismissNotification = useCallback(
    (entry: any) => {
      bumpLastSeenFromEntry(entry);
      setLiveStarts((prev) => filterOutNotificationEntry(prev, entry));
      setPostLikes((prev) => filterOutNotificationEntry(prev, entry));
      setPostComments((prev) => filterOutNotificationEntry(prev, entry));
      setAccepted((prev) => filterOutNotificationEntry(prev, entry));
      setDeclined((prev) => filterOutNotificationEntry(prev, entry));
      setPending((prev) => filterOutNotificationEntry(prev, entry));

      if (entry?.isLocal) {
        const id = String(entry.id);
        void (async () => {
          if (entry.type === "post_like" || entry.type === "post_comment" || entry.type === "comment_reply") {
            await markLocalEngagementRead(id);
            return;
          }
          await markLocalAcceptedSeen(id).catch(() => undefined);
          await markLocalDeclinedSeen(id).catch(() => undefined);
        })();
        return;
      }

      const entryId = notificationEntryId(entry);
      if (entryId) dismissedIdsRef.current.add(entryId);

      if (token && typeof entry.id === "number") {
        void markSocialNotificationRead(token, Number(entry.id)).catch(() => {});
      }
    },
    [bumpLastSeenFromEntry, filterOutNotificationEntry, notificationEntryId, token]
  );

  const loadNotifications = useCallback(async () => {
    if (!user?.fullName) return;
    let remoteMessageUnread = 0;
    if (token) {
      try {
        const threads = await fetchMessageThreads(token);
        remoteMessageUnread = (threads.threads || []).reduce((sum, t) => {
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
      } catch {
        remoteMessageUnread = 0;
      }
    }
    setMessageUnreadCount(remoteMessageUnread);

    const snap = await fetchNotificationFeedSnapshot({
      token,
      userFullName: user.fullName,
      userEmail: user.email,
      userId: user.id
    });
    const mergedPending = filterDismissedNotifications(snap.pending);
    setPending(mergedPending);
    setAccepted(filterDismissedNotifications(snap.accepted));
    setDeclined(filterDismissedNotifications(snap.declined));
    setPostLikes(filterDismissedNotifications(snap.postLikes));
    setPostComments(filterDismissedNotifications(snap.postComments));
    setLiveStarts(filterDismissedNotifications(snap.liveStarts));

    const fbQueue = followBackQueueRef.current;
    const nameSet = new Set<string>();
    for (const n of mergedPending) {
      const nm = String(n.actorName || "").trim();
      if (nm) nameSet.add(nm);
    }
    for (const n of fbQueue) {
      const nm = String(n.actorName || "").trim();
      if (nm) nameSet.add(nm);
    }
    const names = [...nameSet];
    if (names.length && user?.fullName) {
      const localMap = await getLocalRelationshipMapByNames(
        { name: user.fullName, key: user.email || String(user.id || "") },
        names
      );
      const next: Record<string, "none" | "pending" | "accepted"> = {};
      const actorIds = [...new Set([...mergedPending, ...fbQueue].map((n) => Number(n.actorId)).filter((id) => Number.isFinite(id) && id > 0))];
      let remoteRel: Record<number, { viewerStatus: string }> = {};
      if (token && actorIds.length) {
        try {
          const data = await fetchRelationships(token, actorIds);
          remoteRel = data.relationships || {};
        } catch {
          /* ignore */
        }
      }
      for (const n of mergedPending) {
        const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
        const nm = String(n.actorName || "").toLowerCase();
        let st: "none" | "pending" | "accepted" = (localMap[nm]?.viewerStatus as "none" | "pending" | "accepted") || "none";
        if (n.actorId && remoteRel[Number(n.actorId)]?.viewerStatus) {
          const rs = String(remoteRel[Number(n.actorId)].viewerStatus) as "none" | "pending" | "accepted";
          if (rs === "accepted" || rs === "pending") st = rs;
        }
        next[key] = st;
      }
      for (const n of fbQueue) {
        const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
        const nm = String(n.actorName || "").toLowerCase();
        let st: "none" | "pending" | "accepted" = (localMap[nm]?.viewerStatus as "none" | "pending" | "accepted") || "none";
        if (n.actorId && remoteRel[Number(n.actorId)]?.viewerStatus) {
          const rs = String(remoteRel[Number(n.actorId)].viewerStatus) as "none" | "pending" | "accepted";
          if (rs === "accepted" || rs === "pending") st = rs;
        }
        next[key] = st;
      }
      setFollowBackStatusByKey(next);
      setFollowBackQueue((prev) =>
        prev.filter((n) => {
          const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
          const st = next[key] || "none";
          return st === "none";
        })
      );
    }
  }, [filterDismissedNotifications, token, user?.email, user?.fullName, user?.id, viewerUserId]);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 4000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    let mounted = true;
    setLastSeenReady(false);
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(notificationSeenKey);
        if (!mounted) return;
        const parsed = Number(raw || 0);
        if (Number.isFinite(parsed) && parsed > 0) {
          setLastSeenMs(parsed);
        } else {
          const now = Date.now();
          setLastSeenMs(now);
          await AsyncStorage.setItem(notificationSeenKey, String(now));
        }
      } catch {
        if (!mounted) return;
        const now = Date.now();
        setLastSeenMs(now);
      } finally {
        if (mounted) setLastSeenReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notificationSeenKey]);

  const notificationUnreadCount = useMemo(() => {
    if (sheetOpen || !lastSeenReady) return 0;
    const entries = flattenNotificationFeedSnapshot({
      pending,
      accepted,
      declined,
      postLikes,
      postComments,
      liveStarts
    });
    return countUnreadSocialNotifications(entries, lastSeenMs);
  }, [accepted, declined, lastSeenMs, lastSeenReady, liveStarts, sheetOpen, pending, postComments, postLikes]);

  const openNotificationSheet = useCallback(() => {
    setSheetOpen(true);
    void loadNotifications();
  }, [loadNotifications]);

  const closeNotificationSheet = useCallback(() => {
    const now = Date.now();
    void persistLastSeenMs(now);
    setSheetOpen(false);
    if (token) {
      void (async () => {
        try {
          await markAllSocialNotificationsRead(token);
        } catch {
          // Badge already cleared via lastSeenMs; server sync may retry on next poll.
        }
        await loadNotifications();
      })();
    }
  }, [loadNotifications, persistLastSeenMs, token]);

  const onRespond = async (entry: any, action: "accept" | "decline") => {
    if (entry?.isLocal) {
      await respondLocalFollowRequest(String(entry.id), action);
      await loadNotifications();
      return;
    }
    if (token && entry?.followId) {
      await respondToFollowRequest(token, Number(entry.followId), action);
      await loadNotifications();
    }
  };

  const onFollowBack = async (entry: any) => {
    const key = entry.actorId ? `id:${entry.actorId}` : `name:${String(entry.actorName || "").toLowerCase()}`;
    if (followBackStatusByKey[key] === "accepted" || followBackStatusByKey[key] === "pending") return;
    if (entry?.isLocal) {
      await sendLocalFollowRequestByIdentity(
        { name: user?.fullName || "Farmer", key: user?.email || String(user?.id || "") },
        { name: entry.actorName || "Farmer" }
      );
      setFollowBackStatusByKey((prev) => ({ ...prev, [key]: "pending" }));
      setFollowBackPromptByKey((prev) => ({ ...prev, [key]: false }));
      return;
    }
    if (token && entry?.actorId) {
      await sendFollowRequest(token, Number(entry.actorId));
      setFollowBackStatusByKey((prev) => ({ ...prev, [key]: "pending" }));
      setFollowBackPromptByKey((prev) => ({ ...prev, [key]: false }));
    }
  };

  const onMarkAcceptedRead = (entry: any) => {
    optimisticDismissNotification(entry);
  };

  const onMarkDeclinedRead = (entry: any) => {
    optimisticDismissNotification(entry);
  };

  const onMarkPostActivityRead = (entry: any) => {
    optimisticDismissNotification(entry);
  };

  const onDismissNotification = (entry: any) => {
    optimisticDismissNotification(entry);
  };

  const onJoinLive = async (entry: any) => {
    const postId = Number(entry?.postId);
    if (!Number.isFinite(postId) || postId <= 0) return;
    if (String(entry?.postLiveStatus || "").toLowerCase() === "ended" || entry?.postLiveEndedAt) return;
    queueJoinLive(postId);
    setSheetOpen(false);
    navigateToJoinLive();
  };

  const onStartScheduledLiveFromNotif = (entry: any) => {
    let meta: { topic?: string; scheduleId?: number } = {};
    try {
      const parsed = JSON.parse(String(entry.commentExcerpt || ""));
      if (parsed && typeof parsed === "object") meta = parsed;
    } catch {
      meta = {};
    }
    const topic = String(meta.topic || "").trim();
    const scheduleId = Number(meta.scheduleId);
    queueOpenLiveCreate({
      liveTopic: topic || undefined,
      scheduledLiveId: Number.isFinite(scheduleId) && scheduleId > 0 ? scheduleId : undefined,
      autoStartLive: true
    });
    setSheetOpen(false);
    navigateToJoinLive();
  };

  const parseLiveNotifMeta = (n: any) => {
    let meta: { topic?: string; scheduledAt?: string; scheduleId?: number } = {};
    try {
      const parsed = JSON.parse(String(n.commentExcerpt || ""));
      if (parsed && typeof parsed === "object") meta = parsed;
    } catch {
      meta = {};
    }
    return meta;
  };

  const isLivePostEnded = (n: any) =>
    String(n?.postLiveStatus || "").toLowerCase() === "ended" || !!String(n?.postLiveEndedAt || "").trim();

  const postActivityLabel = (n: any) => {
    const kind = n.postIsReel ? t("postKindReel") : t("postKindPost");
    const ex = String(n.commentExcerpt || "").trim();
    const excerpt = ex ? `: "${ex}"` : "";
    if (n.type === "comment_reply") {
      return t("notifRepliedComment", { name: String(n.actorName || ""), excerpt });
    }
    if (n.type === "post_comment" || (n.isLocal && n.commentExcerpt)) {
      return t("notifCommentedOn", { name: String(n.actorName || ""), kind, excerpt });
    }
    return t("notifLikedYour", { name: String(n.actorName || ""), kind });
  };

  const liveStartLabel = (n: any) => {
    const meta = parseLiveNotifMeta(n);
    const name = String(n.actorName || "Someone");
    const topic = meta.topic ? `: ${meta.topic}` : "";
    if (n.type === "live_host_reminder") {
      return meta.topic
        ? `It's time to start your live${topic}`
        : "It's time to start your scheduled live";
    }
    if (n.type === "live_scheduled") {
      const when = meta.scheduledAt ? new Date(meta.scheduledAt).toLocaleString() : "soon";
      return `${name} scheduled a live${topic} at ${when}`;
    }
    if (n.type === "live_reminder") {
      return `${name} is going live in 10 minutes${topic}`;
    }
    if (n.type === "live_start" && isLivePostEnded(n)) {
      return `${name} — ${t("liveEndedBadge")}`;
    }
    return `${name} started live`;
  };

  const toMillis = (value: any) => {
    const ts = Date.parse(String(value || ""));
    return Number.isFinite(ts) ? ts : 0;
  };

  const notificationItems = useMemo(() => {
    const items: Array<{ kind: string; createdAt: string; entry: any; key: string }> = [];
    for (const n of pending) items.push({ kind: "pending", createdAt: n.createdAt || "", entry: n, key: `pending-${String(n.id)}` });
    for (const n of followBackQueue) {
      const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
      items.push({ kind: "follow_back", createdAt: n.createdAt || "", entry: n, key: `fb-${key}` });
    }
    for (const n of accepted) items.push({ kind: "accepted", createdAt: n.createdAt || "", entry: n, key: `accepted-${String(n.id)}` });
    for (const n of declined) items.push({ kind: "declined", createdAt: n.createdAt || "", entry: n, key: `declined-${String(n.id)}` });
    for (const n of liveStarts) {
      const kind = String(n.type || "live_start");
      items.push({ kind, createdAt: n.createdAt || "", entry: n, key: `live-${kind}-${String(n.id)}` });
    }
    for (const n of postLikes) items.push({ kind: "post_like", createdAt: n.createdAt || "", entry: n, key: `like-${n.isLocal ? n.id : `r-${n.id}`}` });
    for (const n of postComments) items.push({ kind: "post_comment", createdAt: n.createdAt || "", entry: n, key: `cmt-${n.isLocal ? n.id : `r-${n.id}`}` });
    items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return items;
  }, [accepted, declined, followBackQueue, liveStarts, pending, postComments, postLikes]);

  const value = useMemo<NotificationPanelContextValue>(
    () => ({
      sheetOpen,
      openNotificationSheet,
      closeNotificationSheet,
      notificationUnreadCount,
      messageUnreadCount
    }),
    [closeNotificationSheet, messageUnreadCount, notificationUnreadCount, openNotificationSheet, sheetOpen]
  );

  return (
    <NotificationPanelContext.Provider value={value}>
      {children}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={closeNotificationSheet}>
        <Pressable style={styles.overlay} onPress={closeNotificationSheet}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t("notifications")}</Text>
              <Pressable onPress={closeNotificationSheet}>
                <Ionicons name="close" size={20} color={APP_LIME} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {notificationItems.length === 0 ? (
                <Text style={styles.emptyText}>{t("noNotifications")}</Text>
              ) : null}
              {notificationItems.map((item) => {
                const n = item.entry;
                if (item.kind === "pending") {
                  return (
                    <View key={item.key} style={styles.row}>
                      <Text style={styles.rowText}>{t("notifFollowRequest", { name: String(n.actorName || "") })}</Text>
                      <View style={styles.rowActions}>
                        <Pressable
                          style={styles.acceptBtn}
                          onPress={async () => {
                            await onRespond(n, "accept");
                            const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
                            let viewerSt: "none" | "pending" | "accepted" = "none";
                            if (token && n.actorId && user?.fullName) {
                              try {
                                const data = await fetchRelationships(token, [Number(n.actorId)]);
                                const rs = data.relationships?.[Number(n.actorId)]?.viewerStatus;
                                if (rs === "accepted" || rs === "pending" || rs === "declined" || rs === "none") {
                                  viewerSt = rs === "declined" ? "none" : rs;
                                }
                              } catch {
                                /* use local */
                              }
                            }
                            if (viewerSt !== "accepted" && viewerSt !== "pending" && user?.fullName) {
                              const lm = await getLocalRelationshipMapByNames(
                                { name: user.fullName, key: user.email || String(user.id || "") },
                                [String(n.actorName || "")]
                              );
                              const ls = lm[String(n.actorName || "").toLowerCase()]?.viewerStatus;
                              if (ls === "accepted" || ls === "pending") viewerSt = ls;
                            }
                            setFollowBackStatusByKey((prev) => ({ ...prev, [key]: viewerSt }));
                            if (viewerSt === "accepted" || viewerSt === "pending") {
                              await loadNotifications();
                              return;
                            }
                            setFollowBackPromptByKey((prev) => ({ ...prev, [key]: true }));
                            setFollowBackQueue((prev) => {
                              if (prev.some((x) => (x.actorId ? `id:${x.actorId}` : `name:${String(x.actorName || "").toLowerCase()}`) === key)) return prev;
                              return [...prev, n];
                            });
                          }}
                        >
                          <Text style={styles.acceptText}>{t("accept")}</Text>
                        </Pressable>
                        <Pressable style={styles.declineBtn} onPress={() => onRespond(n, "decline")}>
                          <Text style={styles.declineText}>{t("decline")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }
                if (item.kind === "follow_back") {
                  const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
                  const status = followBackStatusByKey[key] || "none";
                  const showPrompt = followBackPromptByKey[key] === true;
                  return (
                    <View key={item.key} style={styles.row}>
                      <Text style={styles.rowText}>{t("notifNowFollowing", { name: String(n.actorName || "") })}</Text>
                      <View style={styles.rowActions}>
                        {status === "accepted" ? (
                          <View style={styles.followingPill}>
                            <Text style={styles.followingText}>{t("following")}</Text>
                          </View>
                        ) : status === "pending" ? (
                          <View style={styles.requestedPill}>
                            <Text style={styles.requestedText}>{t("requested")}</Text>
                          </View>
                        ) : showPrompt ? (
                          <Pressable style={styles.followBackBtn} onPress={() => onFollowBack(n)}>
                            <Text style={styles.followBackText}>{t("followBackCapital")}</Text>
                          </Pressable>
                        ) : (
                          <Pressable style={styles.followBackBtn} onPress={() => onFollowBack(n)}>
                            <Text style={styles.followBackText}>{t("followBackCapital")}</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                }
                if (item.kind === "accepted") {
                  return (
                    <Pressable key={item.key} style={styles.acceptedRow} onPress={() => onMarkAcceptedRead(n)}>
                      <Ionicons name="checkmark-circle" size={16} color={APP_LIME} />
                      <Text style={styles.rowText}>{t("notifAcceptedRequest", { name: String(n.actorName || "") })}</Text>
                    </Pressable>
                  );
                }
                if (item.kind === "declined") {
                  return (
                    <Pressable key={item.key} style={styles.declinedRow} onPress={() => onMarkDeclinedRead(n)}>
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                      <Text style={styles.rowText}>{t("notifDeclinedRequest", { name: String(n.actorName || "") })}</Text>
                    </Pressable>
                  );
                }
                if (item.kind === "live_host_reminder") {
                  return (
                    <View key={item.key} style={styles.liveStartRow}>
                      <Pressable style={styles.liveStartMain} onPress={() => onStartScheduledLiveFromNotif(n)}>
                        <Ionicons name="calendar" size={16} color={APP_LIME} />
                        <Text style={styles.rowText}>{liveStartLabel(n)}</Text>
                      </Pressable>
                      <Pressable style={styles.joinLiveBtn} onPress={() => onStartScheduledLiveFromNotif(n)}>
                        <Text style={styles.joinLiveText}>{t("goLive")}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.dismissBtn}
                        onPress={() => onDismissNotification(n)}
                        hitSlop={8}
                        accessibilityLabel="Dismiss notification"
                      >
                        <Ionicons name="close" size={18} color="rgba(255,255,255,0.55)" />
                      </Pressable>
                    </View>
                  );
                }
                if (
                  item.kind === "live_start" ||
                  item.kind === "live_scheduled" ||
                  item.kind === "live_reminder"
                ) {
                  const postId = Number(n.postId);
                  const liveEnded = item.kind === "live_start" && isLivePostEnded(n);
                  const canJoin = item.kind === "live_start" && Number.isFinite(postId) && postId > 0 && !liveEnded;
                  return (
                    <View key={item.key} style={styles.liveStartRow}>
                      <Pressable
                        style={styles.liveStartMain}
                        onPress={() => (canJoin ? void onJoinLive(n) : void onDismissNotification(n))}
                      >
                        <Ionicons
                          name="radio"
                          size={16}
                          color={liveEnded ? "rgba(255,255,255,0.4)" : "#ef4444"}
                        />
                        <Text style={[styles.rowText, liveEnded ? styles.rowTextMuted : null]}>
                          {liveStartLabel(n)}
                        </Text>
                      </Pressable>
                      {canJoin ? (
                        <Pressable style={styles.joinLiveBtn} onPress={() => void onJoinLive(n)}>
                          <Text style={styles.joinLiveText}>Join live</Text>
                        </Pressable>
                      ) : liveEnded ? (
                        <View style={styles.liveEndedBadge}>
                          <Text style={styles.liveEndedBadgeText}>{t("liveEndedBadge")}</Text>
                        </View>
                      ) : null}
                      <Pressable
                        style={styles.dismissBtn}
                        onPress={() => onDismissNotification(n)}
                        hitSlop={8}
                        accessibilityLabel="Dismiss notification"
                      >
                        <Ionicons name="close" size={18} color="rgba(255,255,255,0.55)" />
                      </Pressable>
                    </View>
                  );
                }
                if (item.kind === "post_like") {
                  return (
                    <Pressable key={item.key} style={styles.activityRow} onPress={() => onMarkPostActivityRead(n)}>
                      <Ionicons name="heart" size={16} color={APP_LIME} />
                      <Text style={styles.rowText}>{postActivityLabel(n)}</Text>
                    </Pressable>
                  );
                }
                return (
                  <Pressable key={item.key} style={styles.activityRow} onPress={() => onMarkPostActivityRead(n)}>
                    <Ionicons name="chatbubble-ellipses" size={16} color="#0ea5e9" />
                    <Text style={styles.rowText}>{postActivityLabel(n)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </NotificationPanelContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#262626",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#3a424c"
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: APP_LIME, fontWeight: "900", fontSize: 16 },
  sheetBody: { paddingTop: 10, gap: 10 },
  emptyText: { color: "#9ca8b1", fontWeight: "700" },
  row: { borderWidth: 1, borderColor: "#3a424c", borderRadius: 10, backgroundColor: "#252a30", padding: 10, gap: 8 },
  rowText: { color: "#eef4f8", fontWeight: "700", flex: 1 },
  rowActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { backgroundColor: APP_LIME, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: "#1b1f23", fontWeight: "900", fontSize: 12 },
  declineBtn: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  declineText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  followBackBtn: { backgroundColor: APP_LIME, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followBackText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  requestedPill: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  requestedText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  followingPill: { backgroundColor: "#1f6f43", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followingText: { color: "#e8fff2", fontWeight: "800", fontSize: 12 },
  acceptedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#3a424c",
    borderRadius: 10,
    backgroundColor: "#252a30",
    padding: 10
  },
  declinedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#3a424c",
    borderRadius: 10,
    backgroundColor: "#252a30",
    padding: 10
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#3a424c",
    borderRadius: 10,
    backgroundColor: "#252a30",
    padding: 10
  },
  liveStartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#3a424c",
    borderRadius: 10,
    backgroundColor: "#252a30",
    padding: 10
  },
  liveStartMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  joinLiveBtn: { backgroundColor: APP_LIME, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  joinLiveText: { color: "#1b1f23", fontWeight: "900", fontSize: 12 },
  liveEndedBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  liveEndedBadgeText: { color: "rgba(255,255,255,0.5)", fontWeight: "800", fontSize: 12 },
  rowTextMuted: { color: "rgba(255,255,255,0.45)" },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)"
  }
});
