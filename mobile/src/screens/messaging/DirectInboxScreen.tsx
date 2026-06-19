import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  Image,
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
import { navigateToDirectChat } from "../../navigation/navigationRef";
import { fetchMessageThreads, type MessageThread } from "../../services/api";
import { APP_LIME } from "../../theme/appColors";
import { useLanguage } from "../../localization/LanguageContext";
import { formatDmInboxPreview } from "./dmMessageFormats";

const BG = "#121212";
const TEXT = "#ffffff";
const MUTED = "#9e9e9e";
const BORDER = "#2a2a2a";
const SEARCH_BG = "#303132";
const AVATAR_BG = "#3a3f46";
const LIME = APP_LIME;

const INBOX_ASSETS = {
  searchActive: require("../../../assets/bottom-icons/search-active.svg"),
  edit: require("../../../assets/edit-icon.svg")
} as const;

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
      const timer = setInterval(() => {
        void load();
      }, 4000);
      return () => clearInterval(timer);
    }, [load])
  );

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
      peerAvatarUrl: thread.peerAvatarUrl
    });
  };

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
        <Pressable hitSlop={8} accessibilityLabel="New message">
          <Image source={INBOX_ASSETS.edit} style={styles.editIcon} resizeMode="contain" />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Image source={INBOX_ASSETS.searchActive} style={styles.searchIconImage} resizeMode="contain" />
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
                  <Text style={styles.peerName} numberOfLines={1}>
                    {item.peerName}
                  </Text>
                  <View style={styles.previewRow}>
                    <Text style={styles.preview} numberOfLines={1}>
                      {preview}
                      <Text style={styles.previewMeta}> • {timeLabel}</Text>
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
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
  editIcon: {
    width: 34,
    height: 34
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
  searchIconImage: { width: 18, height: 18, marginRight: 8 },
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
  previewMeta: {
    color: MUTED,
    fontWeight: "400"
  },
  emptyWrap: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: "800", color: TEXT },
  emptySub: { marginTop: 8, fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 }
});
