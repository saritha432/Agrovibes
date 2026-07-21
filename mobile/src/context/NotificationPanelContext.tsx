import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppIsActive } from "../hooks/useAppIsActive";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import {
  blockUser,
  fetchActiveHomeStories,
  fetchHomePost,
  fetchMessageThreads,
  fetchRelationships,
  markSocialNotificationRead,
  removeFollower,
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
import { rememberBlockedUser } from "../social/blockedUsers";
import {
  countUnreadSocialNotifications,
  fetchNotificationFeedSnapshot,
  flattenNotificationFeedSnapshot
} from "../social/notificationFeedSnapshot";
import { APP_LIME } from "../theme/appColors";
import { NotificationPostThumb } from "../components/NotificationPostThumb";
import { SwipeActionsRow, type SwipeAction } from "../components/SwipeActionsRow";
import { StoryRingAvatar } from "../components/StoryRingAvatar";
import { useLanguage } from "../localization/LanguageContext";
import { navigateToJoinLive } from "../navigation/navigationRef";
import { queueOpenSharedPostViewer } from "../navigation/sharedPostViewerBridge";
import { queueJoinLive } from "../navigation/liveJoinBridge";
import { queueOpenLiveCreate } from "../navigation/liveCreateBridge";
import { publishActiveStories } from "../navigation/storyActivityBridge";
import { stripLegacyCloudinaryUrl } from "../utils/mediaUrls";

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
  const appIsActive = useAppIsActive();
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
  const [newFollows, setNewFollows] = useState<any[]>([]);
  const [lastSeenMs, setLastSeenMs] = useState(0);
  const [lastSeenReady, setLastSeenReady] = useState(false);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [followRequestsExpanded, setFollowRequestsExpanded] = useState(false);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  const viewerUserId = useMemo(() => {
    const parsed = Number(user?.id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [user?.id]);

  const notificationSeenKey = useMemo(() => {
    if (viewerUserId) return `agrovibes.notifications.lastSeen.v2.uid.${viewerUserId}`;
    const identity = String(user?.email || user?.fullName || "guest").toLowerCase();
    return `agrovibes.notifications.lastSeen.v2.${identity}`;
  }, [user?.email, user?.fullName, viewerUserId]);

  const dismissedStorageKey = useMemo(() => {
    if (viewerUserId) return `agrovibes.notifications.dismissed.v1.uid.${viewerUserId}`;
    const identity = String(user?.email || user?.fullName || "guest").toLowerCase();
    return `agrovibes.notifications.dismissed.v1.${identity}`;
  }, [user?.email, user?.fullName, viewerUserId]);

  const lastSeenMsRef = useRef(0);
  lastSeenMsRef.current = lastSeenMs;
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const [dismissedReady, setDismissedReady] = useState(false);

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

  const mergeNotificationEntries = useCallback((prev: any[], incoming: any[]) => {
    const byKey = new Map<string, any>();
    const put = (row: any) => {
      const key = `${row?.isLocal ? "l" : "r"}:${String(row?.id ?? "")}`;
      if (!key.endsWith(":")) byKey.set(key, row);
    };
    for (const row of prev) put(row);
    for (const row of incoming) put(row);
    return [...byKey.values()].sort((a, b) => {
      const ta = Date.parse(String(a?.createdAt || "")) || 0;
      const tb = Date.parse(String(b?.createdAt || "")) || 0;
      return tb - ta;
    });
  }, []);

  const persistDismissedId = useCallback(
    async (entryId: string) => {
      if (!entryId) return;
      dismissedIdsRef.current.add(entryId);
      try {
        await AsyncStorage.setItem(dismissedStorageKey, JSON.stringify([...dismissedIdsRef.current]));
      } catch {
        // no-op
      }
    },
    [dismissedStorageKey]
  );

  const optimisticDismissNotification = useCallback(
    (entry: any) => {
      bumpLastSeenFromEntry(entry);
      setLiveStarts((prev) => filterOutNotificationEntry(prev, entry));
      setPostLikes((prev) => filterOutNotificationEntry(prev, entry));
      setPostComments((prev) => filterOutNotificationEntry(prev, entry));
      setAccepted((prev) => filterOutNotificationEntry(prev, entry));
      setDeclined((prev) => filterOutNotificationEntry(prev, entry));
      setPending((prev) => filterOutNotificationEntry(prev, entry));
      setNewFollows((prev) => filterOutNotificationEntry(prev, entry));

      const entryId = notificationEntryId(entry);
      if (entryId) void persistDismissedId(entryId);

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

      if (token && typeof entry.id === "number") {
        void markSocialNotificationRead(token, Number(entry.id)).catch(() => {});
      }
    },
    [
      bumpLastSeenFromEntry,
      filterOutNotificationEntry,
      notificationEntryId,
      persistDismissedId,
      token
    ]
  );

  const loadMessageUnread = useCallback(async () => {
    if (!token) {
      setMessageUnreadCount(0);
      return;
    }
    try {
      const threads = await fetchMessageThreads(token);
      const remoteMessageUnread = (threads.threads || []).reduce((sum, t) => {
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
      setMessageUnreadCount(remoteMessageUnread);
    } catch {
      /* keep previous badge */
    }
  }, [token, viewerUserId]);

  const loadNotifications = useCallback(async () => {
    if (!user?.fullName) return;

    const snap = await fetchNotificationFeedSnapshot({
      token,
      userFullName: user.fullName,
      userEmail: user.email,
      userId: user.id
    });
    const mergedPending = filterDismissedNotifications(snap.pending);
    setPending(mergedPending);
    setAccepted((prev) => filterDismissedNotifications(mergeNotificationEntries(prev, snap.accepted)));
    setDeclined((prev) => filterDismissedNotifications(mergeNotificationEntries(prev, snap.declined)));
    setNewFollows((prev) => filterDismissedNotifications(mergeNotificationEntries(prev, snap.newFollows || [])));
    setPostLikes((prev) => filterDismissedNotifications(mergeNotificationEntries(prev, snap.postLikes)));
    setPostComments((prev) => filterDismissedNotifications(mergeNotificationEntries(prev, snap.postComments)));
    setLiveStarts((prev) => filterDismissedNotifications(mergeNotificationEntries(prev, snap.liveStarts)));

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
    const remoteNewFollows = filterDismissedNotifications(snap.newFollows || []);
    for (const n of remoteNewFollows) {
      const nm = String(n.actorName || "").trim();
      if (nm) nameSet.add(nm);
    }
    const names = [...nameSet];
    const statusEntries = [...mergedPending, ...fbQueue, ...remoteNewFollows];
    const actorIds = [
      ...new Set(statusEntries.map((n) => Number(n.actorId)).filter((id) => Number.isFinite(id) && id > 0))
    ];
    if ((names.length || actorIds.length) && (user?.fullName || token)) {
      const [localMap, remoteData] = await Promise.all([
        user?.fullName && names.length
          ? getLocalRelationshipMapByNames({ name: user.fullName, key: user.email || String(user.id || "") }, names)
          : Promise.resolve({} as Record<string, { viewerStatus?: string }>),
        token && actorIds.length
          ? fetchRelationships(token, actorIds).catch(() => ({ relationships: {} as Record<number, { viewerStatus: string }> }))
          : Promise.resolve({ relationships: {} as Record<number, { viewerStatus: string }> })
      ]);
      const remoteRel = remoteData.relationships || {};
      const next: Record<string, "none" | "pending" | "accepted"> = {};
      for (const n of statusEntries) {
        const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
        const nm = String(n.actorName || "").toLowerCase();
        let st: "none" | "pending" | "accepted" = (localMap[nm]?.viewerStatus as "none" | "pending" | "accepted") || "none";
        if (n.actorId && remoteRel[Number(n.actorId)]?.viewerStatus) {
          const rs = String(remoteRel[Number(n.actorId)].viewerStatus) as "none" | "pending" | "accepted";
          if (rs === "accepted" || rs === "pending") st = rs;
        }
        next[key] = st;
      }
      setFollowBackStatusByKey((prev) => ({ ...prev, ...next }));
    }

    const actorStoryIds = [
      ...new Set(
        [...mergedPending, ...fbQueue, ...remoteNewFollows, ...(snap.postLikes || []), ...(snap.postComments || [])]
          .map((n) => Number(n.actorId))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    ].slice(0, 80);
    if (token && actorStoryIds.length) {
      void fetchActiveHomeStories(token, actorStoryIds)
        .then((data) => {
          publishActiveStories(data.stories || []);
        })
        .catch(() => {});
    }
  }, [filterDismissedNotifications, mergeNotificationEntries, token, user?.email, user?.fullName, user?.id]);

  useEffect(() => {
    if (!appIsActive || !dismissedReady) return;
    void loadNotifications();
    // Background badge refresh — keep light so JS thread stays free for swipes.
    const timer = setInterval(() => {
      void loadNotifications();
    }, sheetOpen ? 20000 : 15000);
    return () => clearInterval(timer);
  }, [appIsActive, dismissedReady, loadNotifications, sheetOpen]);

  useEffect(() => {
    if (!appIsActive) return;
    void loadMessageUnread();
    const timer = setInterval(() => {
      void loadMessageUnread();
    }, 30000);
    return () => clearInterval(timer);
  }, [appIsActive, loadMessageUnread]);

  useEffect(() => {
    let mounted = true;
    setDismissedReady(false);
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(dismissedStorageKey);
        if (!mounted) return;
        const parsed = raw ? JSON.parse(raw) : [];
        dismissedIdsRef.current = new Set(
          Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean) : []
        );
      } catch {
        if (!mounted) return;
        dismissedIdsRef.current = new Set();
      } finally {
        if (mounted) setDismissedReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [dismissedStorageKey]);

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
      newFollows,
      postLikes,
      postComments,
      liveStarts
    });
    return countUnreadSocialNotifications(entries, lastSeenMs);
  }, [accepted, declined, lastSeenMs, lastSeenReady, liveStarts, newFollows, sheetOpen, pending, postComments, postLikes]);

  const openNotificationSheet = useCallback(() => {
    setFollowRequestsExpanded(false);
    setSheetOpen(true);
    void loadNotifications();
  }, [loadNotifications]);

  const closeNotificationSheet = useCallback(() => {
    const now = Date.now();
    void persistLastSeenMs(now);
    setFollowRequestsExpanded(false);
    setSheetOpen(false);
  }, [persistLastSeenMs]);

  const onRespond = async (entry: any, action: "accept" | "decline") => {
    if (action === "accept") {
      setPending((prev) => filterOutNotificationEntry(prev, entry));
    }
    if (entry?.isLocal) {
      await respondLocalFollowRequest(String(entry.id), action);
      void loadNotifications();
      return;
    }
    if (token && entry?.followId) {
      await respondToFollowRequest(token, Number(entry.followId), action);
      void loadNotifications();
    }
  };

  const queueFollowBackPrompt = useCallback((entry: any) => {
    const key = entry.actorId ? `id:${entry.actorId}` : `name:${String(entry.actorName || "").toLowerCase()}`;
    setFollowBackPromptByKey((prev) => ({ ...prev, [key]: true }));
    setFollowBackQueue((prev) => {
      if (prev.some((x) => (x.actorId ? `id:${x.actorId}` : `name:${String(x.actorName || "").toLowerCase()}`) === key)) {
        return prev;
      }
      return [{ ...entry, createdAt: entry.createdAt || new Date().toISOString() }, ...prev];
    });
  }, []);

  const handleAcceptFollowRequest = useCallback(
    (entry: any) => {
      const key = entry.actorId ? `id:${entry.actorId}` : `name:${String(entry.actorName || "").toLowerCase()}`;
      queueFollowBackPrompt(entry);
      void (async () => {
        await onRespond(entry, "accept");
        let viewerSt: "none" | "pending" | "accepted" = "none";
        if (token && entry.actorId && user?.fullName) {
          try {
            const data = await fetchRelationships(token, [Number(entry.actorId)]);
            const rs = data.relationships?.[Number(entry.actorId)]?.viewerStatus;
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
            [String(entry.actorName || "")]
          );
          const ls = lm[String(entry.actorName || "").toLowerCase()]?.viewerStatus;
          if (ls === "accepted" || ls === "pending") viewerSt = ls;
        }
        setFollowBackStatusByKey((prev) => ({ ...prev, [key]: viewerSt }));
      })();
    },
    [onRespond, queueFollowBackPrompt, token, user?.email, user?.fullName, user?.id]
  );

  const onDismissFollowBack = useCallback((entry: any) => {
    const key = entry.actorId ? `id:${entry.actorId}` : `name:${String(entry.actorName || "").toLowerCase()}`;
    setFollowBackQueue((prev) =>
      prev.filter((x) => (x.actorId ? `id:${x.actorId}` : `name:${String(x.actorName || "").toLowerCase()}`) !== key)
    );
    setFollowBackPromptByKey((prev) => ({ ...prev, [key]: false }));
    optimisticDismissNotification(entry);
  }, [optimisticDismissNotification]);

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
      try {
        const res = await sendFollowRequest(token, Number(entry.actorId));
        const st = String(res?.follow?.status || "").toLowerCase();
        setFollowBackStatusByKey((prev) => ({
          ...prev,
          [key]: st === "accepted" ? "accepted" : "pending"
        }));
      } catch {
        setFollowBackStatusByKey((prev) => ({ ...prev, [key]: "pending" }));
      }
      setFollowBackPromptByKey((prev) => ({ ...prev, [key]: false }));
    }
  };

  const onOpenPostFromNotification = useCallback(
    (entry: any) => {
      const postId = Number(entry?.postId);
      if (!Number.isFinite(postId) || postId <= 0) return;
      bumpLastSeenFromEntry(entry);
      setSheetOpen(false);
      navigateToJoinLive();
      void (async () => {
        try {
          const { post } = await fetchHomePost(token ?? null, postId);
          queueOpenSharedPostViewer(post, true);
        } catch {
          // Post may have been removed.
        }
      })();
    },
    [bumpLastSeenFromEntry, token]
  );

  const onDismissNotification = (entry: any) => {
    optimisticDismissNotification(entry);
  };

  const resolveActorId = (entry: any): number | null => {
    const id = Number(entry?.actorId);
    return Number.isFinite(id) && id > 0 ? id : null;
  };

  const onRemoveFollowerFromNotif = useCallback(
    (entry: any) => {
      const actorId = resolveActorId(entry);
      const name = String(entry?.actorName || "this user").trim() || "this user";
      if (!token || !actorId) {
        Alert.alert(t("loginRequired") || "Login required", t("loginRequiredReport") || "Please sign in again.");
        return;
      }
      Alert.alert(
        t("removeFollowerConfirmTitle") || "Remove follower?",
        t("removeFollowerConfirmBody", { name }) || `Cropvibe won't tell ${name} they were removed.`,
        [
          { text: t("cancel") || "Cancel", style: "cancel" },
          {
            text: t("removeFollowerAction") || "Remove",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await removeFollower(token, actorId);
                  optimisticDismissNotification(entry);
                } catch (e: unknown) {
                  Alert.alert(t("error") || "Error", e instanceof Error ? e.message : "Could not remove follower");
                }
              })();
            }
          }
        ]
      );
    },
    [optimisticDismissNotification, t, token]
  );

  const onBlockUserFromNotif = useCallback(
    (entry: any) => {
      const actorId = resolveActorId(entry);
      const name = String(entry?.actorName || "this user").trim() || "this user";
      if (!token || !actorId) {
        Alert.alert(t("loginRequired") || "Login required", t("loginRequiredReport") || "Please sign in again.");
        return;
      }
      Alert.alert(
        t("blockUserConfirmTitle", { name }) || `Block ${name}?`,
        t("blockUserConfirmBody", { name }) ||
          `They won't be able to find your profile or posts. Cropvibe won't tell them you blocked them.`,
        [
          { text: t("cancel") || "Cancel", style: "cancel" },
          {
            text: t("blockAccount") || "Block",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await blockUser(token, actorId);
                  await rememberBlockedUser(
                    {
                      userId: actorId,
                      fullName: name,
                      username: null,
                      avatarUrl: entry?.actorAvatarUrl ?? null
                    },
                    user?.id
                  );
                  optimisticDismissNotification(entry);
                } catch (e: unknown) {
                  Alert.alert(t("error") || "Error", e instanceof Error ? e.message : "Could not block user");
                }
              })();
            }
          }
        ]
      );
    },
    [optimisticDismissNotification, t, token, user?.id]
  );

  const onSwipeActiveChange = useCallback((active: boolean) => {
    setListScrollEnabled(!active);
  }, []);

  const swipeRow = (key: string, actions: SwipeAction[], row: React.ReactNode) => (
    <SwipeActionsRow
      key={key}
      actions={actions}
      style={styles.swipeShell}
      onSwipeActiveChange={onSwipeActiveChange}
    >
      {row}
    </SwipeActionsRow>
  );

  const dismissibleRow = (key: string, onDelete: () => void, row: React.ReactNode) =>
    swipeRow(
      key,
      [
        {
          key: "delete",
          label: t("deleteConfirm") || "Delete",
          icon: "trash",
          backgroundColor: "#ed4956",
          onPress: onDelete
        }
      ],
      row
    );

  const followActionRow = (key: string, entry: any, _onDismiss: () => void, row: React.ReactNode) =>
    swipeRow(
      key,
      [
        {
          key: "remove",
          label: t("removeFollowerAction") || "Remove",
          icon: "person-remove",
          backgroundColor: "#525252",
          onPress: () => onRemoveFollowerFromNotif(entry)
        },
        {
          key: "block",
          label: t("blockAccount") || "Block",
          icon: "ban",
          backgroundColor: "#ed4956",
          onPress: () => onBlockUserFromNotif(entry)
        }
      ],
      row
    );

  const renderPostActivityNotification = (
    itemKey: string,
    entry: any,
    icon: "heart" | "chatbubble-ellipses" | "chatbubble",
    iconColor: string
  ) =>
    dismissibleRow(
      itemKey,
      () => onDismissNotification(entry),
      <Pressable style={styles.activityRow} onPress={() => onOpenPostFromNotification(entry)}>
        <View style={styles.activityMain}>
          <Ionicons name={icon} size={16} color={iconColor} />
          <Text style={styles.rowText}>{postActivityLabel(entry)}</Text>
        </View>
        <NotificationPostThumb
          postId={entry.postId}
          postThumbnailUrl={entry.postThumbnailUrl}
          postImageUrl={entry.postImageUrl}
          postVideoUrl={entry.postVideoUrl}
          postIsReel={entry.postIsReel}
          token={token}
        />
      </Pressable>
    );

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
    for (const n of newFollows) {
      const key = n.actorId ? `id:${n.actorId}` : `name:${String(n.actorName || "").toLowerCase()}`;
      if (items.some((item) => item.key === `fb-${key}` || item.key === `nf-${key}`)) continue;
      items.push({ kind: "new_follow", createdAt: n.createdAt || "", entry: n, key: `nf-${key}` });
    }
    for (const n of accepted) items.push({ kind: "accepted", createdAt: n.createdAt || "", entry: n, key: `accepted-${String(n.id)}` });
    for (const n of declined) items.push({ kind: "declined", createdAt: n.createdAt || "", entry: n, key: `declined-${String(n.id)}` });
    for (const n of liveStarts) {
      const kind = String(n.type || "live_start");
      items.push({ kind, createdAt: n.createdAt || "", entry: n, key: `live-${kind}-${String(n.id)}` });
    }
    for (const n of postLikes) items.push({ kind: "post_like", createdAt: n.createdAt || "", entry: n, key: `like-${n.isLocal ? n.id : `r-${n.id}`}` });
    for (const n of postComments) {
      const kind = n.type === "comment_reply" ? "comment_reply" : "post_comment";
      items.push({ kind, createdAt: n.createdAt || "", entry: n, key: `cmt-${n.isLocal ? n.id : `r-${n.id}`}` });
    }
    items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return items;
  }, [accepted, declined, followBackQueue, liveStarts, newFollows, pending, postComments, postLikes]);

  const pendingRequestItems = useMemo(
    () => notificationItems.filter((item) => item.kind === "pending"),
    [notificationItems]
  );

  useEffect(() => {
    if (pendingRequestItems.length === 0) {
      setFollowRequestsExpanded(false);
    }
  }, [pendingRequestItems.length]);

  const notificationSections = useMemo(() => {
    const datedItems = notificationItems.filter((item) => item.kind !== "pending");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = startOfToday.getTime() - 24 * 60 * 60 * 1000;

    const grouped = new Map<string, Array<{ kind: string; createdAt: string; entry: any; key: string }>>();
    for (const item of datedItems) {
      const createdMs = toMillis(item.createdAt);
      const label =
        createdMs >= startOfToday.getTime()
          ? "Today"
          : createdMs >= startOfYesterday
            ? "Yesterday"
            : "Earlier";
      const list = grouped.get(label) || [];
      list.push(item);
      grouped.set(label, list);
    }

    const order = ["Today", "Yesterday", "Earlier"];
    return order
      .map((label) => ({ label, items: grouped.get(label) || [] }))
      .filter((section) => section.items.length > 0);
  }, [notificationItems]);

  const relativeTimeLabel = useCallback((createdAt: string) => {
    const createdMs = Date.parse(String(createdAt || ""));
    if (!Number.isFinite(createdMs)) return "";
    const diffMs = Math.max(0, Date.now() - createdMs);
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours < 1) {
      const mins = Math.floor(diffMs / (60 * 1000));
      return `${Math.max(1, mins)}m`;
    }
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${Math.max(1, days)}d`;
  }, []);

  const actorAvatarUri = useCallback((entry: any): string | undefined => {
    const direct =
      entry?.actorAvatarUrl ??
      entry?.actor_avatar_url ??
      entry?.avatarUrl ??
      entry?.avatar_url ??
      entry?.profilePhotoUrl ??
      entry?.profile_photo_url ??
      entry?.profileImage ??
      entry?.actor?.avatarUrl ??
      entry?.actor?.avatar_url ??
      entry?.actor?.profileImageUrl ??
      entry?.actor?.profile_image_url ??
      entry?.actorProfileImageUrl ??
      entry?.actor_profile_image_url ??
      entry?.profileImageUrl;
    if (typeof direct === "string" && direct.trim()) return stripLegacyCloudinaryUrl(direct.trim()) || direct.trim();
    return undefined;
  }, []);

  const actorDisplayName = useCallback((entry: any) => String(entry?.actorName || "User"), []);

  const notificationBadgeIcon = useCallback((kind: string): keyof typeof Ionicons.glyphMap => {
    if (kind === "post_comment" || kind === "comment_reply") return "chatbubble";
    if (kind === "follow_back" || kind === "new_follow" || kind === "pending") return "person-add";
    if (kind === "accepted") return "checkmark";
    if (kind === "declined") return "close";
    if (kind.startsWith("live")) return "radio";
    return "heart";
  }, []);

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
      <Modal visible={sheetOpen} animationType="none" onRequestClose={closeNotificationSheet}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable
                style={styles.headerBackBtn}
                onPress={() => {
                  if (followRequestsExpanded) {
                    setFollowRequestsExpanded(false);
                    return;
                  }
                  closeNotificationSheet();
                }}
              >
                <Ionicons name="chevron-back" size={22} color={APP_LIME} />
              </Pressable>
              <Text style={styles.sheetTitle}>{t("notifications")}</Text>
              <View style={styles.headerBackBtn} />
            </View>
            <ScrollView
              contentContainerStyle={styles.sheetBody}
              scrollEnabled={listScrollEnabled}
              directionalLockEnabled
            >
              {notificationItems.length === 0 ? (
                <Text style={styles.emptyText}>{t("noNotifications")}</Text>
              ) : null}
              {pendingRequestItems.length > 0 && !followRequestsExpanded ? (
                <Pressable style={styles.followRequestSummaryCard} onPress={() => setFollowRequestsExpanded(true)}>
                  <View style={styles.followRequestSummaryIconWrap}>
                    <Ionicons name="person-add" size={22} color={APP_LIME} />
                  </View>
                  <View style={styles.followRequestSummaryTextWrap}>
                    <Text style={styles.followRequestSummaryTitle}>Follow Request</Text>
                    <Text style={styles.followRequestSummarySubtitle}>Approve Or Decline Request</Text>
                  </View>
                </Pressable>
              ) : null}
              {pendingRequestItems.length > 0 && followRequestsExpanded ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Follow Request</Text>
                  {pendingRequestItems.map((item, idx) => {
                    const n = item.entry;
                    const isLastRow = idx === pendingRequestItems.length - 1;
                    return (
                      <View key={item.key} style={[styles.figRow, !isLastRow ? styles.figRowDivider : null]}>
                        <View style={styles.figAvatarWrap}>
                          <StoryRingAvatar
                            uri={actorAvatarUri(n)}
                            name={actorDisplayName(n)}
                            userId={n.actorId}
                            userName={n.actorName}
                            size={42}
                            borderRadius={21}
                            fallbackBackgroundColor="#404040"
                            initialsColor="#f2f5f7"
                          />
                        </View>
                        <View style={[styles.figContentWrap, styles.figContentWrapExpanded]}>
                          <Text style={styles.figMessageText}>
                            <Text style={styles.figActorName}>{String(n.actorName || "User")}</Text>
                            <Text style={styles.figActionText}> requested follow</Text>
                          </Text>
                        </View>
                        <View style={styles.figRightWrap}>
                          <View style={styles.rowActionsHorizontal}>
                            <Pressable style={styles.declineBtnCompact} onPress={() => onRespond(n, "decline")}>
                              <Text style={styles.declineTextLime}>{t("decline")}</Text>
                            </Pressable>
                            <Pressable style={styles.acceptBtnCompact} onPress={() => handleAcceptFollowRequest(n)}>
                              <Text style={styles.acceptText}>Approve</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {notificationSections.map((section) => (
                <View key={section.label} style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>{section.label}</Text>
                  {section.items.map((item, idx) => {
                    const n = item.entry;
                    const isLastRow = idx === section.items.length - 1;
                    const followKey =
                      n.actorId != null && Number(n.actorId) > 0
                        ? `id:${n.actorId}`
                        : `name:${String(n.actorName || "").toLowerCase()}`;
                    const followStatus =
                      item.kind === "follow_back" || item.kind === "new_follow"
                        ? followBackStatusByKey[followKey] || "none"
                        : "none";
                    const hideRightPaneForType =
                      item.kind === "accepted" ||
                      item.kind === "declined" ||
                      ((item.kind === "follow_back" || item.kind === "new_follow") && followStatus === "accepted");

                    const openPostFromRow =
                      item.kind === "post_like" || item.kind === "post_comment" || item.kind === "comment_reply"
                        ? () => onOpenPostFromNotification(n)
                        : null;

                    const rowInner = (
                      <View style={[styles.figRow, !isLastRow ? styles.figRowDivider : null]}>
                        <View style={styles.figAvatarWrap}>
                          <StoryRingAvatar
                            uri={actorAvatarUri(n)}
                            name={actorDisplayName(n)}
                            userId={n.actorId}
                            userName={n.actorName}
                            size={42}
                            borderRadius={21}
                            fallbackBackgroundColor="#404040"
                            initialsColor="#f2f5f7"
                          />
                          <View style={styles.figBadge}>
                            <Ionicons name={notificationBadgeIcon(item.kind)} size={9} color="#1f2328" />
                          </View>
                        </View>
                        <View
                          style={[
                            styles.figContentWrap,
                            hideRightPaneForType ? styles.figContentWrapExpanded : null
                          ]}
                        >
                          {item.kind === "pending" ? (
                            <Text style={styles.figMessageText}>
                              {t("notifFollowRequest", { name: String(n.actorName || "") })}
                            </Text>
                          ) : item.kind === "follow_back" || item.kind === "new_follow" ? (
                            <Text style={styles.figMessageText}>
                              {t("notifNowFollowing", { name: String(n.actorName || "") })}
                            </Text>
                          ) : item.kind === "accepted" ? (
                            <Text style={styles.figMessageText}>
                              {t("notifAcceptedRequest", { name: String(n.actorName || "") })}
                            </Text>
                          ) : item.kind === "declined" ? (
                            <Text style={styles.figMessageText}>
                              {t("notifDeclinedRequest", { name: String(n.actorName || "") })}
                            </Text>
                          ) : item.kind === "post_like" || item.kind === "post_comment" || item.kind === "comment_reply" ? (
                            <Text style={styles.figMessageText}>{postActivityLabel(n)}</Text>
                          ) : (
                            <Text style={styles.figMessageText}>{liveStartLabel(n)}</Text>
                          )}
                          <Text style={styles.figTimeText}>{relativeTimeLabel(item.createdAt)}</Text>
                        </View>
                        {!hideRightPaneForType ? (
                          <View style={[styles.figRightWrap, styles.figRightWrapMedia]}>
                            {item.kind === "pending" ? (
                              <View style={styles.rowActions}>
                                <Pressable style={styles.acceptBtn} onPress={() => handleAcceptFollowRequest(n)}>
                                  <Text style={styles.acceptText}>{t("accept")}</Text>
                                </Pressable>
                                <Pressable style={styles.declineBtn} onPress={() => onRespond(n, "decline")}>
                                  <Text style={styles.declineText}>{t("decline")}</Text>
                                </Pressable>
                              </View>
                            ) : item.kind === "follow_back" || item.kind === "new_follow" ? (
                              followStatus === "pending" ? (
                                <View style={styles.requestedPill}>
                                  <Text style={styles.requestedText}>{t("requested")}</Text>
                                </View>
                              ) : (
                                <Pressable style={styles.followBackBtn} onPress={() => onFollowBack(n)}>
                                  <Text style={styles.followBackText}>{t("followBackCapital")}</Text>
                                </Pressable>
                              )
                            ) : item.kind === "live_host_reminder" ? (
                              <Pressable style={styles.joinLiveBtn} onPress={() => onStartScheduledLiveFromNotif(n)}>
                                <Text style={styles.joinLiveText}>{t("goLive")}</Text>
                              </Pressable>
                            ) : item.kind === "live_start" ||
                              item.kind === "live_scheduled" ||
                              item.kind === "live_reminder" ? (
                              (() => {
                                const postId = Number(n.postId);
                                const liveEnded = item.kind === "live_start" && isLivePostEnded(n);
                                const canJoin =
                                  item.kind === "live_start" && Number.isFinite(postId) && postId > 0 && !liveEnded;
                                if (canJoin) {
                                  return (
                                    <Pressable style={styles.joinLiveBtn} onPress={() => void onJoinLive(n)}>
                                      <Text style={styles.joinLiveText}>Join live</Text>
                                    </Pressable>
                                  );
                                }
                                if (liveEnded) {
                                  return (
                                    <View style={styles.liveEndedBadge}>
                                      <Text style={styles.liveEndedBadgeText}>{t("liveEndedBadge")}</Text>
                                    </View>
                                  );
                                }
                                return <View style={styles.figPostPlaceholder} />;
                              })()
                            ) : item.kind === "post_like" || item.kind === "post_comment" || item.kind === "comment_reply" ? (
                              <NotificationPostThumb
                                postId={n.postId}
                                postThumbnailUrl={n.postThumbnailUrl}
                                postImageUrl={n.postImageUrl}
                                postVideoUrl={n.postVideoUrl}
                                postIsReel={n.postIsReel}
                                token={token}
                              />
                            ) : (
                              <View style={styles.figPostPlaceholder} />
                            )}
                          </View>
                        ) : null}
                      </View>
                    );

                    const rowCore = openPostFromRow ? (
                      <Pressable onPress={openPostFromRow} accessibilityRole="button">
                        {rowInner}
                      </Pressable>
                    ) : (
                      rowInner
                    );

                    if (item.kind === "pending") {
                      return <View key={item.key}>{rowCore}</View>;
                    }
                    if (item.kind === "follow_back" || item.kind === "new_follow" || item.kind === "accepted") {
                      return followActionRow(
                        item.key,
                        n,
                        () => (item.kind === "follow_back" ? onDismissFollowBack(n) : onDismissNotification(n)),
                        rowCore
                      );
                    }
                    return dismissibleRow(item.key, () => onDismissNotification(n), rowCore);
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </NotificationPanelContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#262626" },
  sheet: {
    flex: 1,
    backgroundColor: "#262626",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 0
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8
  },
  headerBackBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sheetTitle: { color: "#ffffff", fontWeight: "700", fontSize: 20, letterSpacing: 0.1, flex: 1, textAlign: "center" },
  sheetBody: { paddingTop: 10, gap: 14, paddingBottom: 22 },
  emptyText: { color: "#9ca8b1", fontWeight: "700" },
  followRequestSummaryCard: {
    borderRadius: 14,
    backgroundColor: "#303132",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  followRequestSummaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center"
  },
  followRequestSummaryTextWrap: { flex: 1, minWidth: 0 },
  followRequestSummaryTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20
  },
  followRequestSummarySubtitle: {
    marginTop: 2,
    color: "rgba(156,156,156,0.6)",
    fontSize: 12,
    lineHeight: 16
  },
  sectionCard: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#303132",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  sectionTitle: {
    color: APP_LIME,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  figRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 102,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#303132"
  },
  figRowDivider: {
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  figAvatarWrap: {
    width: 46,
    height: 46,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center"
  },
  figBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  figContentWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10
  },
  figContentWrapExpanded: {
    paddingRight: 0
  },
  figMessageText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 22
  },
  figActorName: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12
  },
  figActionText: {
    color: "#ffffff",
    fontWeight: "400",
    fontSize: 12
  },
  figTimeText: {
    marginTop: 2,
    color: "rgba(156,153,156,0.8)",
    fontSize: 12,
    lineHeight: 18
  },
  figRightWrap: {
    minWidth: 160,
    minHeight: 78,
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0
  },
  figRightWrapMedia: {
    minWidth: 72,
    width: 72
  },
  figPostPlaceholder: {
    width: 69,
    height: 90,
    borderRadius: 6,
    backgroundColor: "#4d4d4d"
  },
  row: { borderWidth: 1, borderColor: "#3a424c", borderRadius: 10, backgroundColor: "#252a30", padding: 10, gap: 8 },
  rowText: { color: "#eef4f8", fontWeight: "700", flex: 1 },
  rowActions: { flexDirection: "column", gap: 6 },
  rowActionsHorizontal: { flexDirection: "row", gap: 8, alignItems: "center" },
  acceptBtn: { backgroundColor: APP_LIME, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptBtnCompact: { backgroundColor: APP_LIME, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, minWidth: 78, alignItems: "center" },
  acceptText: { color: "#1b1f23", fontWeight: "900", fontSize: 12 },
  declineBtn: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  declineBtnCompact: { backgroundColor: "#262626", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, minWidth: 78, alignItems: "center" },
  declineText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  declineTextLime: { color: APP_LIME, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  followBackBtn: { backgroundColor: APP_LIME, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followBackText: { color: "#1b1f23", fontWeight: "900", fontSize: 12 },
  requestedPill: { backgroundColor: "#323a44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  requestedText: { color: "#d8dde3", fontWeight: "800", fontSize: 12 },
  followingPill: { backgroundColor: APP_LIME, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followingText: { color: "#1b1f23", fontWeight: "800", fontSize: 12 },
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
    padding: 10,
    minHeight: 76
  },
  activityMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0
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
  rowTextMuted: { color: "rgba(255,255,255,0.45)" }
  ,
  swipeShell: {
    borderRadius: 0
  }
});