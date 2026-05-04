import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import {
  fetchRelationships,
  fetchSocialNotifications,
  markSocialNotificationRead,
  respondToFollowRequest,
  sendFollowRequest
} from "../services/api";
import {
  getLocalFollowNotificationsByIdentity,
  getLocalRelationshipMapByNames,
  markLocalAcceptedSeen,
  markLocalDeclinedSeen,
  respondLocalFollowRequest,
  sendLocalFollowRequestByIdentity
} from "../social/localFollowStore";
import { getLocalEngagementNotificationsForViewer, markLocalEngagementRead } from "../social/localEngagementStore";

export function AppTopBar() {
  const { token, user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<any[]>([]);
  const [accepted, setAccepted] = React.useState<any[]>([]);
  const [declined, setDeclined] = React.useState<any[]>([]);
  const [followBackStatusByKey, setFollowBackStatusByKey] = React.useState<Record<string, "none" | "pending" | "accepted">>({});
  const [followBackQueue, setFollowBackQueue] = React.useState<any[]>([]);
  const followBackQueueRef = React.useRef<any[]>([]);
  React.useEffect(() => {
    followBackQueueRef.current = followBackQueue;
  }, [followBackQueue]);
  const [followBackPromptByKey, setFollowBackPromptByKey] = React.useState<Record<string, boolean>>({});
  const [postLikes, setPostLikes] = React.useState<any[]>([]);
  const [postComments, setPostComments] = React.useState<any[]>([]);
  const [lastSeenMs, setLastSeenMs] = React.useState(0);

  const notificationSeenKey = React.useMemo(() => {
    const identity = String(user?.email || user?.id || user?.fullName || "guest").toLowerCase();
    return `agrovibes.notifications.lastSeen.${identity}`;
  }, [user?.email, user?.fullName, user?.id]);

  const loadNotifications = React.useCallback(async () => {
    if (!user?.fullName) return;
    const local = await getLocalFollowNotificationsByIdentity({ name: user.fullName, key: user.email || String(user.id || "") });
    const localEng = await getLocalEngagementNotificationsForViewer(user.fullName);
    let remoteReq: any[] = [];
    let remoteAccepted: any[] = [];
    let remotePostLikes: any[] = [];
    let remotePostComments: any[] = [];
    if (token) {
      try {
        const remote = await fetchSocialNotifications(token);
        remoteReq = remote.followRequests || [];
        remoteAccepted = remote.followAccepted || [];
        remotePostLikes = remote.postLikes || [];
        remotePostComments = remote.postComments || [];
      } catch {
        // remote social endpoints may be unavailable; keep local notifications
      }
    }
    const mergedPending = [...(remoteReq || []), ...(local.pendingRequests || []).map((n) => ({ ...n, isLocal: true, actorName: n.actorName, followId: n.id, id: n.id }))];
    setPending(mergedPending);
    setAccepted([...(remoteAccepted || []), ...(local.acceptedForActor || []).map((n) => ({ ...n, isLocal: true, actorName: n.targetName, id: n.id }))]);
    setDeclined([...(local.declinedForActor || []).map((n) => ({ ...n, isLocal: true, actorName: n.targetName, id: n.id }))]);
    setPostLikes([
      ...remotePostLikes,
      ...localEng.postLikes.map((n) => ({
        ...n,
        isLocal: true,
        id: n.id,
        type: "post_like",
        postIsReel: n.isReel,
        postId: n.postId
      }))
    ]);
    setPostComments([
      ...remotePostComments,
      ...localEng.postComments.map((n) => ({
        ...n,
        isLocal: true,
        id: n.id,
        type: "post_comment",
        postIsReel: n.isReel,
        postId: n.postId,
        commentExcerpt: n.commentExcerpt
      }))
    ]);

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
  }, [token, user?.email, user?.fullName, user?.id]);

  React.useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 4000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  React.useEffect(() => {
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

  const allFetchedNotifications = React.useMemo(
    () => [...pending, ...accepted, ...declined, ...postLikes, ...postComments],
    [accepted, declined, pending, postComments, postLikes]
  );

  const unreadCount = React.useMemo(() => {
    if (open) return 0;
    if (!lastSeenMs) return allFetchedNotifications.length;
    return allFetchedNotifications.filter((n) => {
      const ts = Date.parse(String(n?.createdAt || ""));
      return Number.isFinite(ts) && ts > lastSeenMs;
    }).length;
  }, [allFetchedNotifications, lastSeenMs, open]);

  React.useEffect(() => {
    if (!open) return;
    const now = Date.now();
    setLastSeenMs(now);
    AsyncStorage.setItem(notificationSeenKey, String(now)).catch(() => {});
  }, [notificationSeenKey, open]);

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

  const postActivityLabel = (n: any) => {
    const kind = n.postIsReel ? "reel" : "post";
    if (n.type === "post_comment" || (n.isLocal && n.commentExcerpt)) {
      const ex = String(n.commentExcerpt || "").trim();
      const tail = ex ? `: "${ex}"` : "";
      return `${n.actorName} commented on your ${kind}${tail}`;
    }
    return `${n.actorName} liked your ${kind}.`;
  };

  const toMillis = (value: any) => {
    const ts = Date.parse(String(value || ""));
    return Number.isFinite(ts) ? ts : 0;
  };

  const notificationItems = React.useMemo(() => {
    const items: Array<{ kind: string; createdAt: string; entry: any; key: string }> = [];
    for (const n of pending) items.push({ kind: "pending", createdAt: n.createdAt || "", entry: n, key: `pending-${String(n.id)}` });
    for (const n of followBackQueue) {
      const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
      items.push({ kind: "follow_back", createdAt: n.createdAt || "", entry: n, key: `fb-${key}` });
    }
    for (const n of accepted) items.push({ kind: "accepted", createdAt: n.createdAt || "", entry: n, key: `accepted-${String(n.id)}` });
    for (const n of declined) items.push({ kind: "declined", createdAt: n.createdAt || "", entry: n, key: `declined-${String(n.id)}` });
    for (const n of postLikes) items.push({ kind: "post_like", createdAt: n.createdAt || "", entry: n, key: `like-${n.isLocal ? n.id : `r-${n.id}`}` });
    for (const n of postComments) items.push({ kind: "post_comment", createdAt: n.createdAt || "", entry: n, key: `cmt-${n.isLocal ? n.id : `r-${n.id}`}` });
    items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return items;
  }, [accepted, declined, followBackQueue, pending, postComments, postLikes]);

  return (
    <>
      <View style={styles.topBar}>
        <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
        <View style={styles.rightSide}>
          <Pressable style={styles.iconBadge} onPress={() => setOpen(true)}>
            <Ionicons name="notifications-outline" size={16} color="#d8ff37" />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{Math.min(99, unreadCount)}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Notifications</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Ionicons name="close" size={20} color="#d8ff37" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {notificationItems.length === 0 ? (
                <Text style={styles.emptyText}>No notifications yet.</Text>
              ) : null}
              {notificationItems.map((item) => {
                const n = item.entry;
                if (item.kind === "pending") {
                  return (
                    <View key={item.key} style={styles.row}>
                      <Text style={styles.rowText}>{n.actorName} sent a follow request</Text>
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
                          <Text style={styles.acceptText}>Accept</Text>
                        </Pressable>
                        <Pressable style={styles.declineBtn} onPress={() => onRespond(n, "decline")}>
                          <Text style={styles.declineText}>Decline</Text>
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
                      <Text style={styles.rowText}>{n.actorName} is now following you.</Text>
                      <View style={styles.rowActions}>
                        {status === "accepted" ? (
                          <View style={styles.followingPill}>
                            <Text style={styles.followingText}>Following</Text>
                          </View>
                        ) : status === "pending" ? (
                          <View style={styles.requestedPill}>
                            <Text style={styles.requestedText}>Requested</Text>
                          </View>
                        ) : showPrompt ? (
                          <Pressable style={styles.followBackBtn} onPress={() => onFollowBack(n)}>
                            <Text style={styles.followBackText}>Follow Back</Text>
                          </Pressable>
                        ) : (
                          <Pressable style={styles.followBackBtn} onPress={() => onFollowBack(n)}>
                            <Text style={styles.followBackText}>Follow Back</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                }
                if (item.kind === "accepted") {
                  return (
                    <Pressable key={item.key} style={styles.acceptedRow} onPress={() => onMarkAcceptedRead(n)}>
                      <Ionicons name="checkmark-circle" size={16} color="#0a9f46" />
                      <Text style={styles.rowText}>{n.actorName} accepted your follow request.</Text>
                    </Pressable>
                  );
                }
                if (item.kind === "declined") {
                  return (
                    <Pressable key={item.key} style={styles.declinedRow} onPress={() => onMarkDeclinedRead(n)}>
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                      <Text style={styles.rowText}>{n.actorName} declined your follow request.</Text>
                    </Pressable>
                  );
                }
                if (item.kind === "post_like") {
                  return (
                    <Pressable key={item.key} style={styles.activityRow} onPress={() => onMarkPostActivityRead(n)}>
                      <Ionicons name="heart" size={16} color="#16a34a" />
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
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#262626",
    paddingHorizontal: 10,
    paddingVertical: 7,
    paddingTop: 10
  },
  logoImage: { width: 86, height: 20 },
  rightSide: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  badge: {
    position: "absolute",
    right: -5,
    top: -4,
    backgroundColor: "#d8ff37",
    borderRadius: 7,
    minWidth: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: "#1f2b28", fontSize: 8, fontWeight: "700" }
  ,
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1d2126",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#3a424c"
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: "#d8ff37", fontWeight: "900", fontSize: 16 },
  sheetBody: { paddingTop: 10, gap: 10 },
  emptyText: { color: "#9ca8b1", fontWeight: "700" },
  row: { borderWidth: 1, borderColor: "#3a424c", borderRadius: 10, backgroundColor: "#252a30", padding: 10, gap: 8 },
  rowText: { color: "#eef4f8", fontWeight: "700", flex: 1 },
  rowActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { backgroundColor: "#b9f530", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: "#1b1f23", fontWeight: "900", fontSize: 12 },
  declineBtn: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  declineText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  followBackBtn: { backgroundColor: "#0a9f46", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followBackText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  requestedPill: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  requestedText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  followingPill: { backgroundColor: "#1f6f43", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followingText: { color: "#e8fff2", fontWeight: "800", fontSize: 12 },
  acceptedRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#3a424c", borderRadius: 10, backgroundColor: "#252a30", padding: 10 },
  declinedRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#3a424c", borderRadius: 10, backgroundColor: "#252a30", padding: 10 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#3a424c", borderRadius: 10, backgroundColor: "#252a30", padding: 10 }
});
