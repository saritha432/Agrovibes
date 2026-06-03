import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import {
  fetchMessageThreads,
  fetchRelationships,
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
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);

  const notificationSeenKey = useMemo(() => {
    const identity = String(user?.email || user?.id || user?.fullName || "guest").toLowerCase();
    return `agrovibes.notifications.lastSeen.${identity}`;
  }, [user?.email, user?.fullName, user?.id]);

  const viewerUserId = useMemo(() => {
    const parsed = Number(user?.id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [user?.id]);

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
    const mergedPending = snap.pending;
    setPending(mergedPending);
    setAccepted(snap.accepted);
    setDeclined(snap.declined);
    setPostLikes(snap.postLikes);
    setPostComments(snap.postComments);
    setLiveStarts(snap.liveStarts);

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
  }, [token, user?.email, user?.fullName, user?.id, viewerUserId]);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 4000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(notificationSeenKey);
        if (!mounted) return;
        const parsed = Number(raw || 0);
        setLastSeenMs(Number.isFinite(parsed) ? parsed : 0);
      } catch {
        if (!mounted) return;
        setLastSeenMs(0);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notificationSeenKey]);

  const notificationUnreadCount = useMemo(() => {
    if (sheetOpen) return 0;
    const entries = flattenNotificationFeedSnapshot({
      pending,
      accepted,
      declined,
      postLikes,
      postComments,
      liveStarts
    });
    return countUnreadSocialNotifications(entries, lastSeenMs);
  }, [accepted, declined, lastSeenMs, liveStarts, sheetOpen, pending, postComments, postLikes]);

  useEffect(() => {
    if (!sheetOpen) return;
    const now = Date.now();
    setLastSeenMs(now);
    AsyncStorage.setItem(notificationSeenKey, String(now)).catch(() => {});
  }, [notificationSeenKey, sheetOpen]);

  const openNotificationSheet = useCallback(() => {
    setSheetOpen(true);
    void loadNotifications();
  }, [loadNotifications]);

  const closeNotificationSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

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

  const onMarkAcceptedRead = async (entry: any) => {
    if (entry?.isLocal) {
      await markLocalAcceptedSeen(String(entry.id));
      await loadNotifications();
      return;
    }
    if (token && entry?.id) {
      await markSocialNotificationRead(token, Number(entry.id));
      await loadNotifications();
    }
  };

  const onMarkDeclinedRead = async (entry: any) => {
    if (entry?.isLocal) {
      await markLocalDeclinedSeen(String(entry.id));
      await loadNotifications();
    }
  };

  const onMarkPostActivityRead = async (entry: any) => {
    if (entry?.isLocal) {
      await markLocalEngagementRead(String(entry.id));
      await loadNotifications();
      return;
    }
    if (token && entry?.id && typeof entry.id === "number") {
      await markSocialNotificationRead(token, Number(entry.id));
      await loadNotifications();
    }
  };

  const onJoinLive = async (entry: any) => {
    const postId = Number(entry?.postId);
    if (!Number.isFinite(postId) || postId <= 0) return;
    queueJoinLive(postId);
    setSheetOpen(false);
    navigateToJoinLive();
  };

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
    let meta: { topic?: string; scheduledAt?: string } = {};
    try {
      const parsed = JSON.parse(String(n.commentExcerpt || ""));
      if (parsed && typeof parsed === "object") meta = parsed;
    } catch {
      meta = {};
    }
    const name = String(n.actorName || "Someone");
    const topic = meta.topic ? `: ${meta.topic}` : "";
    if (n.type === "live_scheduled") {
      const when = meta.scheduledAt ? new Date(meta.scheduledAt).toLocaleString() : "soon";
      return `${name} scheduled a live${topic} at ${when}`;
    }
    if (n.type === "live_reminder") {
      return `${name} is going live in 10 minutes${topic}`;
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
    for (const n of liveStarts) items.push({ kind: "live_start", createdAt: n.createdAt || "", entry: n, key: `live-${String(n.id)}` });
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
                if (item.kind === "live_start") {
                  const postId = Number(n.postId);
                  const canJoin = Number.isFinite(postId) && postId > 0;
                  return (
                    <View key={item.key} style={styles.liveStartRow}>
                      <Pressable style={styles.liveStartMain} onPress={() => (canJoin ? void onJoinLive(n) : void onMarkPostActivityRead(n))}>
                        <Ionicons name="radio" size={16} color="#ef4444" />
                        <Text style={styles.rowText}>{liveStartLabel(n)}</Text>
                      </Pressable>
                      {canJoin ? (
                        <Pressable style={styles.joinLiveBtn} onPress={() => void onJoinLive(n)}>
                          <Text style={styles.joinLiveText}>Join live</Text>
                        </Pressable>
                      ) : null}
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
  joinLiveText: { color: "#1b1f23", fontWeight: "900", fontSize: 12 }
});
