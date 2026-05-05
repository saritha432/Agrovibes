import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { fetchMessageThreads } from "../../services/api";

const BG = "#ffffff";
const TEXT = "#0f0f0f";
const MUTED = "#8e8e8e";
const BORDER = "#dbdbdb";
const TEAL = "#0f9b8e";

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function DirectInboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, token } = useAuth();
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<
    Array<{ peerUserId: number; peerName: string; peerEmail?: string; lastMessage: string; lastAt: string }>
  >([]);

  const openNewMessage = useCallback(async () => {
    const peerName = "Demo Farmer";
    const peerUserId = 1;
    navigation.navigate("DirectChat", { peerUserId, peerName, peerKey: String(peerUserId) });
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openNewMessage} hitSlop={12} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="create-outline" size={26} color="#0f0f0f" />
        </Pressable>
      )
    });
  }, [navigation, openNewMessage]);

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

  const filtered = query.trim()
    ? threads.filter((t) => t.peerName.toLowerCase().includes(query.trim().toLowerCase()))
    : threads;

  const openThread = (t: { peerUserId: number; peerName: string; peerEmail?: string }) => {
    navigation.navigate("DirectChat", {
      peerUserId: t.peerUserId,
      peerName: t.peerName,
      peerKey: t.peerEmail
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={MUTED} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={MUTED}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={56} color={BORDER} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>When someone reaches out, you will see it here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.peerUserId)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openThread(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.peerName.trim().charAt(0).toUpperCase() || "?"}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.peerName} numberOfLines={1}>
                    {item.peerName}
                  </Text>
                  <Text style={styles.time}>{formatTime(new Date(item.lastAt).getTime())}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={BORDER} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#efefef"
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: TEXT, paddingVertical: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 12
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e8f4f1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: TEAL },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  peerName: { flex: 1, fontSize: 15, fontWeight: "700", color: TEXT },
  time: { fontSize: 13, color: MUTED },
  preview: { marginTop: 4, fontSize: 14, color: MUTED },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: "800", color: TEXT },
  emptySub: { marginTop: 8, fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 }
});
