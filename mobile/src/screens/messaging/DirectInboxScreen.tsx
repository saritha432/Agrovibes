import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { UserAvatar } from "../../components/UserAvatar";
import { SvgAssetIcon } from "../../components/SvgAssetIcon";
import { navigateToDirectChat } from "../../navigation/navigationRef";
import { fetchMessageThreads, type MessageThread } from "../../services/api";
import {
  isSocketChatConnected,
  onDirectRead,
  onDirectThreadUpdate,
  onSocketConnectionChange
} from "../../services/socketChat";
import { APP_LIME } from "../../theme/appColors";
import { useLanguage } from "../../localization/LanguageContext";
import { formatDmInboxPreview } from "./dmMessageFormats";
import { NewMessageComposerModal } from "./NewMessageComposerModal";

const BG = "#121212";
const TEXT = "#ffffff";
const MUTED = "#9e9e9e";
const BORDER = "#2a2a2a";
const SEARCH_BG = "#303132";
const AVATAR_BG = "#3a3f46";
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

export function DirectInboxScreen() {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [socketConnected, setSocketConnected] = useState(isSocketChatConnected());
  const [composerOpen, setComposerOpen] = useState(false);

  const displayName = user?.username || user?.fullName || "You";

  const load = useCallback(async () => {
    if (!token) {
      setThreads([]);
      return;
    }
    try {
      const list = await fetchMessageThreads(token);
      setThreads(list.threads || []);
    } catch {
      setThreads([]);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (socketConnected) return;
      const timer = setInterval(() => {
        void load();
      }, 20000);
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
        next[idx] = {
          ...current,
          lastMessage: update.lastMessage,
          lastAt: update.lastAt,
          lastSenderId: update.lastSenderId,
          lastReceiverId: update.lastReceiverId,
          unreadCount: Math.max(0, Number(current.unreadCount || 0) + unreadDelta)
        };
        next.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        return next;
      });
    });
  }, [load]);

  useEffect(() => {
    return onDirectRead(() => {
      void load();
    });
  }, [load]);

  const trimmedQuery = query.trim().toLowerCase();
  const filtered = trimmedQuery
    ? threads.filter((thread) => {
        const preview = previewMessage(thread.lastMessage, t).toLowerCase();
        return thread.peerName.toLowerCase().includes(trimmedQuery) || preview.includes(trimmedQuery);
      })
    : threads;

  const openThread = (thread: MessageThread) => {
    navigateToDirectChat({
      peerUserId: thread.peerUserId,
      peerName: thread.peerName,
      peerKey: thread.peerEmail,
      peerUsername: thread.peerUsername || undefined,
      peerAvatarUrl: thread.peerAvatarUrl
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
    <SafeAreaView style={styles.root} edges={["top"]}>
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
          placeholder={t("search")}
          placeholderTextColor={MUTED}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {filtered.length === 0 ? (
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
          data={filtered}
          keyExtractor={(item) => String(item.peerUserId)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => {
            const preview = previewMessage(item.lastMessage, t);
            const timeLabel = formatShortRelativeTime(new Date(item.lastAt).getTime());
            const unread = isThreadUnread(item);
            return (
              <Pressable style={styles.row} onPress={() => openThread(item)}>
                <UserAvatar
                  uri={item.peerAvatarUrl}
                  name={item.peerName}
                  size={56}
                  borderRadius={28}
                  style={styles.avatar}
                  fallbackBackgroundColor={AVATAR_BG}
                  initialsColor={MUTED}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.peerName, unread ? styles.peerNameUnread : null]} numberOfLines={1}>
                    {item.peerName}
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
      <NewMessageComposerModal visible={composerOpen} recentThreads={threads} onClose={() => setComposerOpen(false)} />
    </SafeAreaView>
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
    borderRadius: 28,
    backgroundColor: AVATAR_BG
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
