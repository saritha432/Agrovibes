import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTopChromeInset } from "../../theme/topChromeInset";
import { DeactivatedContentPlaceholder, DeactivatedChromeWrap, useIsAccountDeactivated } from "../../components/DeactivatedAccountGate";
import { useAuth } from "../../auth/AuthContext";
import { UserAvatar } from "../../components/UserAvatar";
import { SvgAssetIcon } from "../../components/SvgAssetIcon";
import { navigateToDirectChat } from "../../navigation/navigationRef";
import { useAndroidTabBackToHome } from "../../navigation/useAndroidScreenBack";
import { fetchMessageThreads, fetchUsers, type MessageThread, type UserSearchRecord } from "../../services/api";
import {
  isSocketChatConnected,
  onDirectRead,
  onDirectThreadUpdate,
  onSocketConnectionChange
} from "../../services/socketChat";
import { APP_LIME } from "../../theme/appColors";
import { useLanguage } from "../../localization/LanguageContext";
import { useNotificationPanel } from "../../context/NotificationPanelContext";
import { formatDmInboxPreview } from "./dmMessageFormats";
import { NewMessageComposerModal } from "./NewMessageComposerModal";

const BG = "#121212";
const TEXT = "#ffffff";
const MUTED = "#9e9e9e";
const BORDER = "#2a2a2a";
const SEARCH_BG = "#303132";
const LIME = APP_LIME;

const SEARCH_ICON = require("../../../assets/bottom-icons/search.svg");

function formatShortRelativeTime(ts: number) {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 28) return `${Math.floor(diffDays / 7)}w`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function previewMessage(body: string, t: (key: string) => string) {
  return formatDmInboxPreview(body, t);
}

type InboxRow =
  | { key: string; kind: "header"; title: string }
  | { key: string; kind: "thread"; thread: MessageThread }
  | {
      key: string;
      kind: "person";
      person: { id: number; name: string; username?: string; avatarUrl?: string | null };
    }
  | { key: string; kind: "status"; text: string };

export function DirectInboxScreen() {
  const { t } = useLanguage();
  useAndroidTabBackToHome();
  const topChromeInset = useTopChromeInset();
  const { user, token } = useAuth();
  const { refreshMessageUnread, syncMessageUnreadFromThreads } = useNotificationPanel();
  const isAccountDeactivated = useIsAccountDeactivated();
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [peopleHits, setPeopleHits] = useState<UserSearchRecord[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [socketConnected, setSocketConnected] = useState(isSocketChatConnected());
  const [composerOpen, setComposerOpen] = useState(false);

  const displayName = user?.username || user?.fullName || "You";

  const load = useCallback(async () => {
    if (!token) {
      setThreads([]);
      syncMessageUnreadFromThreads([]);
      return;
    }
    try {
      const list = await fetchMessageThreads(token);
      const next = list.threads || [];
      setThreads(next);
      // Keep Chat tab badge aligned with what the inbox shows (clears stale "3").
      syncMessageUnreadFromThreads(next);
    } catch {
      setThreads([]);
    }
  }, [syncMessageUnreadFromThreads, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (socketConnected) return;
      const timer = setInterval(() => {
        void load();
      }, 45_000);
      return () => clearInterval(timer);
    }, [load, socketConnected])
  );

  useEffect(() => {
    return onSocketConnectionChange(setSocketConnected);
  }, []);

  useEffect(() => {
    return onDirectThreadUpdate((update) => {
      setThreads((prev) => {
        const idx = prev.findIndex((thread) => thread.peerUserId === update.peerUserId);
        if (idx < 0) {
          void load();
          return prev;
        }
        const next = [...prev];
        const current = next[idx];
        const unreadDelta = Number(update.unreadDelta || 0);
        const nextUnread =
          typeof update.unreadCount === "number" && Number.isFinite(update.unreadCount)
            ? Math.max(0, update.unreadCount)
            : Math.max(0, Number(current.unreadCount || 0) + unreadDelta);
        next[idx] = {
          ...current,
          lastMessage: update.lastMessage,
          lastAt: update.lastAt,
          lastSenderId: update.lastSenderId,
          lastReceiverId: update.lastReceiverId,
          unreadCount: nextUnread
        };
        next.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        syncMessageUnreadFromThreads(next);
        return next;
      });
    });
  }, [load, syncMessageUnreadFromThreads]);

  useEffect(() => {
    return onDirectRead((payload) => {
      if (payload?.selfRead && payload.peerUserId) {
        setThreads((prev) => {
          const next = prev.map((thread) =>
            thread.peerUserId === payload.peerUserId ? { ...thread, unreadCount: 0 } : thread
          );
          syncMessageUnreadFromThreads(next);
          return next;
        });
      }
      void load();
      void refreshMessageUnread();
    });
  }, [load, refreshMessageUnread, syncMessageUnreadFromThreads]);

  const trimmedQuery = query.trim();
  const needle = trimmedQuery.toLowerCase();

  useEffect(() => {
    if (!token || needle.length < 1) {
      setPeopleHits([]);
      setSearchingPeople(false);
      return;
    }
    let cancelled = false;
    setSearchingPeople(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchUsers(token, { search: trimmedQuery, limit: 40 });
          if (cancelled) return;
          const me = Number(user?.id);
          setPeopleHits((res.users || []).filter((row) => Number(row.id) !== me));
        } catch {
          if (!cancelled) setPeopleHits([]);
        } finally {
          if (!cancelled) setSearchingPeople(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needle, token, trimmedQuery, user?.id]);

  const matchingThreads = useMemo(() => {
    if (!needle) return threads;
    const hitIds = new Set(peopleHits.map((row) => Number(row.id)));
    return threads.filter((thread) => {
      const preview = previewMessage(thread.lastMessage, t).toLowerCase();
      const name = thread.peerName.toLowerCase();
      const handle = String(thread.peerUsername || "").toLowerCase();
      return (
        name.includes(needle) ||
        handle.includes(needle) ||
        preview.includes(needle) ||
        hitIds.has(Number(thread.peerUserId))
      );
    });
  }, [needle, peopleHits, t, threads]);

  const extraPeople = useMemo(() => {
    if (!needle) return [];
    const chatIds = new Set(threads.map((thread) => Number(thread.peerUserId)));
    return peopleHits.filter((row) => !chatIds.has(Number(row.id)));
  }, [needle, peopleHits, threads]);

  const inboxRows = useMemo((): InboxRow[] => {
    if (!needle) {
      return matchingThreads.map((thread) => ({
        key: `thread-${thread.peerUserId}`,
        kind: "thread" as const,
        thread
      }));
    }
    const rows: InboxRow[] = [];
    if (matchingThreads.length) {
      rows.push({ key: "header-chats", kind: "header", title: t("messagesTitle") });
      for (const thread of matchingThreads) {
        rows.push({ key: `thread-${thread.peerUserId}`, kind: "thread", thread });
      }
    }
    if (extraPeople.length) {
      rows.push({ key: "header-people", kind: "header", title: t("suggested") });
      for (const person of extraPeople) {
        rows.push({
          key: `person-${person.id}`,
          kind: "person",
          person: {
            id: person.id,
            name: person.fullName || person.username || "User",
            username: person.username || undefined,
            avatarUrl: person.avatarUrl
          }
        });
      }
    } else if (searchingPeople) {
      rows.push({ key: "status-search", kind: "status", text: t("searchPeople") });
    } else if (!matchingThreads.length) {
      rows.push({ key: "status-empty", kind: "status", text: t("noUsersFound") });
    }
    return rows;
  }, [extraPeople, matchingThreads, needle, searchingPeople, t]);

  const openThread = (thread: MessageThread) => {
    navigateToDirectChat({
      peerUserId: thread.peerUserId,
      peerName: thread.peerName,
      peerKey: thread.peerEmail,
      peerUsername: thread.peerUsername || undefined,
      peerAvatarUrl: thread.peerAvatarUrl
    });
  };

  const openPersonChat = (person: { id: number; name: string; username?: string; avatarUrl?: string | null }) => {
    navigateToDirectChat({
      peerUserId: person.id,
      peerName: person.name,
      peerUsername: person.username,
      peerAvatarUrl: person.avatarUrl
    });
  };

  const isThreadUnread = useCallback((thread: MessageThread) => Number(thread.unreadCount || 0) > 0, []);

  const listHeader = (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{t("messagesTitle")}</Text>
      <Pressable hitSlop={8} accessibilityLabel="Request">
        <Text style={styles.requestLink}>Request</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: topChromeInset }]}>
      <DeactivatedChromeWrap>
      <View style={styles.topBar}>
        <Text style={styles.usernameTitle} numberOfLines={1}>
          {displayName}
        </Text>
        <Pressable hitSlop={8} accessibilityLabel="New message" onPress={() => setComposerOpen(true)}>
          <Ionicons name="create-outline" size={28} color={TEXT} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchIconImage}>
          <SvgAssetIcon module={SEARCH_ICON} size={18} color={MUTED} fallbackName="search" />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchPeople")}
          placeholderTextColor={MUTED}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          editable={!isAccountDeactivated}
        />
        {query ? (
          <Pressable hitSlop={8} onPress={() => setQuery("")} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={MUTED} />
          </Pressable>
        ) : null}
      </View>
      </DeactivatedChromeWrap>

      {isAccountDeactivated ? (
        <DeactivatedContentPlaceholder featureLabel="chat" />
      ) : !needle && threads.length === 0 ? (
        <View style={styles.emptyWrap}>
          {listHeader}
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={56} color={BORDER} />
            <Text style={styles.emptyTitle}>{t("noMessagesTitle")}</Text>
            <Text style={styles.emptySub}>{t("noMessagesSub")}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={inboxRows}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={needle ? null : listHeader}
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{item.title}</Text>
                </View>
              );
            }
            if (item.kind === "status") {
              return (
                <View style={styles.searchStatus}>
                  {searchingPeople ? <ActivityIndicator color={LIME} /> : null}
                  <Text style={styles.searchStatusText}>{item.text}</Text>
                </View>
              );
            }
            if (item.kind === "person") {
              return (
                <Pressable style={styles.row} onPress={() => openPersonChat(item.person)}>
                  <UserAvatar
                    uri={item.person.avatarUrl}
                    name={item.person.name}
                    size={56}
                    borderRadius={28}
                    style={styles.avatar}
                  />
                  <View style={styles.rowBody}>
                    <Text style={styles.peerName} numberOfLines={1}>
                      {item.person.name}
                    </Text>
                    {item.person.username ? (
                      <Text style={styles.preview} numberOfLines={1}>
                        {item.person.username}
                      </Text>
                    ) : (
                      <Text style={styles.preview} numberOfLines={1}>
                        {t("newMessage")}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            }
            const preview = previewMessage(item.thread.lastMessage, t);
            const timeLabel = formatShortRelativeTime(new Date(item.thread.lastAt).getTime());
            const unread = isThreadUnread(item.thread);
            return (
              <Pressable style={styles.row} onPress={() => openThread(item.thread)}>
                <UserAvatar
                  uri={item.thread.peerAvatarUrl}
                  name={item.thread.peerName}
                  size={56}
                  borderRadius={28}
                  style={styles.avatar}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.peerName, unread ? styles.peerNameUnread : null]} numberOfLines={1}>
                    {item.thread.peerName}
                  </Text>
                  <View style={styles.previewRow}>
                    <Text style={[styles.preview, unread ? styles.previewUnread : null]} numberOfLines={1}>
                      {preview}
                      <Text style={[styles.previewMeta, unread ? styles.previewMetaUnread : null]}> • {timeLabel}</Text>
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
      <NewMessageComposerModal visible={composerOpen && !isAccountDeactivated} recentThreads={threads} onClose={() => setComposerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12
  },
  usernameTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: LIME
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: SEARCH_BG
  },
  searchIconImage: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: TEXT, paddingVertical: 0 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT
  },
  requestLink: {
    fontSize: 15,
    fontWeight: "600",
    color: MUTED
  },
  searchStatus: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
    gap: 10
  },
  searchStatusText: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 12,
    backgroundColor: BG
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28
  },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  peerName: { fontSize: 15, fontWeight: "700", color: TEXT },
  peerNameUnread: { fontWeight: "900", color: TEXT },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0
  },
  preview: {
    flex: 1,
    fontSize: 14,
    color: MUTED,
    fontWeight: "400"
  },
  previewUnread: {
    color: "#e8e8e8",
    fontWeight: "800"
  },
  previewMeta: {
    color: MUTED,
    fontWeight: "400"
  },
  previewMetaUnread: {
    color: "#bdbdbd",
    fontWeight: "700"
  },
  emptyWrap: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: "800", color: TEXT },
  emptySub: { marginTop: 8, fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 }
});
