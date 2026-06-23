import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { UserAvatar } from "../../components/UserAvatar";
import { fetchSocialNetwork, sendDirectMessage } from "../../services/api";
import { APP_LIME } from "../../theme/appColors";

type FollowPerson = {
  userId: number;
  name: string;
  avatarUrl?: string | null;
};

type Props = {
  visible: boolean;
  messageBody: string;
  excludeUserId?: number;
  onClose: () => void;
  onSent?: () => void;
};

export function ForwardMessageModal({ visible, messageBody, excludeUserId, onClose, onSent }: Props) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [following, setFollowing] = useState<FollowPerson[]>([]);
  const [error, setError] = useState("");

  const loadFollowing = useCallback(async () => {
    if (!token || !user?.id) {
      setFollowing([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const network = await fetchSocialNetwork(token, user.id);
      const list = (network.following || [])
        .map((row) => ({
          userId: Number(row.key),
          name: String(row.name || "User").trim() || "User",
          avatarUrl: row.avatarUrl
        }))
        .filter((row) => Number.isFinite(row.userId) && row.userId > 0 && row.userId !== excludeUserId);
      setFollowing(list);
    } catch {
      setFollowing([]);
      setError("Could not load your friends list.");
    } finally {
      setLoading(false);
    }
  }, [excludeUserId, token, user?.id]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setSendingId(null);
      return;
    }
    void loadFollowing();
  }, [loadFollowing, visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return following;
    return following.filter((person) => person.name.toLowerCase().includes(q));
  }, [following, query]);

  const forwardTo = async (person: FollowPerson) => {
    if (!token || sendingId != null) return;
    setSendingId(person.userId);
    try {
      await sendDirectMessage(token, person.userId, messageBody);
      onSent?.();
      onClose();
    } catch {
      setError(`Could not forward to ${person.name}.`);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Forward</Text>
          <Pressable hitSlop={10} onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#9e9e9e" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people you follow"
            placeholderTextColor="#9e9e9e"
            style={styles.searchInput}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={APP_LIME} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.userId)}
            contentContainerStyle={filtered.length ? undefined : styles.center}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {following.length ? "No matches" : "Follow people to forward messages to them in chat."}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => void forwardTo(item)} disabled={sendingId != null}>
                <UserAvatar
                  uri={item.avatarUrl}
                  name={item.name}
                  size={46}
                  borderRadius={23}
                  fallbackBackgroundColor="#3a3f46"
                  initialsColor="#fff"
                />
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                {sendingId === item.userId ? <ActivityIndicator color={APP_LIME} /> : null}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#121212" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: "#303132",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 44
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 8 },
  errorText: { color: "#ff8a80", paddingHorizontal: 16, paddingBottom: 8, fontSize: 13 },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: "#9e9e9e", textAlign: "center", fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a2a"
  },
  rowName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" }
});
