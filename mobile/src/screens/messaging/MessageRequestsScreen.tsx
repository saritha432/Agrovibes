import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTopChromeInset } from "../../theme/topChromeInset";
import { useAuth } from "../../auth/AuthContext";
import { UserAvatar } from "../../components/UserAvatar";
import { navigateToDirectChat } from "../../navigation/navigationRef";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import {
  declineMessageRequest,
  fetchMessageThreads,
  type MessageThread
} from "../../services/api";
import { APP_LIME } from "../../theme/appColors";
import { formatDmInboxPreview } from "./dmMessageFormats";
import { useLanguage } from "../../localization/LanguageContext";

const BG = "#121212";
const TEXT = "#ffffff";
const MUTED = "#9e9e9e";
const BORDER = "#2a2a2a";
const LIME = APP_LIME;

function formatShortRelativeTime(ts: number) {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MessageRequestsScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const topChromeInset = useTopChromeInset();
  const { token } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPeerId, setBusyPeerId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchMessageThreads(token, { bucket: "requests" });
      setThreads(list.threads || []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openThread = (thread: MessageThread) => {
    navigateToDirectChat({
      peerUserId: thread.peerUserId,
      peerName: thread.peerName,
      peerKey: thread.peerEmail,
      peerUsername: thread.peerUsername || undefined,
      peerAvatarUrl: thread.peerAvatarUrl,
      isMessageRequest: true
    });
  };

  const deleteRequest = async (thread: MessageThread) => {
    if (!token || busyPeerId) return;
    setBusyPeerId(thread.peerUserId);
    try {
      await declineMessageRequest(token, thread.peerUserId);
      setThreads((prev) => prev.filter((row) => row.peerUserId !== thread.peerUserId));
    } catch {
      // keep row
    } finally {
      setBusyPeerId(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: topChromeInset }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={TEXT} />
        </Pressable>
        <Text style={styles.title}>Message requests</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.subtitle}>
        Messages from people you don&apos;t follow. Accept to move them into your inbox, or delete.
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={LIME} />
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="mail-unread-outline" size={52} color={BORDER} />
          <Text style={styles.emptyTitle}>No message requests</Text>
          <Text style={styles.emptySub}>When someone you don&apos;t follow messages you, it will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => `req-${item.peerUserId}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const preview = formatDmInboxPreview(item.lastMessage, t);
            const timeLabel = formatShortRelativeTime(new Date(item.lastAt).getTime());
            const unread = Number(item.unreadCount || 0) > 0;
            const busy = busyPeerId === item.peerUserId;
            return (
              <Pressable style={styles.row} onPress={() => openThread(item)}>
                <UserAvatar
                  uri={item.peerAvatarUrl}
                  name={item.peerName}
                  size={56}
                  borderRadius={28}
                  style={styles.avatar}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.peerName, unread ? styles.peerNameUnread : null]} numberOfLines={1}>
                    {item.peerName}
                  </Text>
                  <Text style={[styles.preview, unread ? styles.previewUnread : null]} numberOfLines={1}>
                    {preview} · {timeLabel}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  style={styles.deleteBtn}
                  disabled={busy}
                  onPress={() => void deleteRequest(item)}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={MUTED} />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color={MUTED} />
                  )}
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: TEXT },
  subtitle: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  emptyTitle: { marginTop: 8, fontSize: 17, fontWeight: "700", color: TEXT, textAlign: "center" },
  emptySub: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 18 },
  list: { paddingBottom: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12
  },
  avatar: {},
  rowBody: { flex: 1, minWidth: 0 },
  peerName: { fontSize: 15, fontWeight: "600", color: TEXT },
  peerNameUnread: { fontWeight: "800" },
  preview: { marginTop: 3, fontSize: 13, color: MUTED },
  previewUnread: { color: TEXT, fontWeight: "600" },
  deleteBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }
});
