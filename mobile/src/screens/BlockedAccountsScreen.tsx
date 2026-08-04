import React, { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { useAuth } from "../auth/AuthContext";
import {
  fetchBlockedUsers,
  unblockUser,
  type BlockedUser
} from "../services/api";
import { forgetBlockedUser } from "../social/blockedUsers";
import { UserAvatar } from "../components/UserAvatar";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const DIVIDER = "rgba(255,255,255,0.1)";

export function BlockedAccountsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setUsers([]);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchBlockedUsers(token);
      setUsers(data.users || []);
    } catch (error) {
      setUsers([]);
      setLoadError(error instanceof Error ? error.message : "Could not load blocked accounts");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onUnblock = useCallback(
    (person: BlockedUser) => {
      if (!token || busyId != null) return;
      void (async () => {
        setBusyId(person.userId);
        try {
          await unblockUser(token, person.userId);
          await forgetBlockedUser(person.userId, user?.id);
          setUsers((prev) => prev.filter((u) => u.userId !== person.userId));
        } catch {
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert("Could not unblock this account. Try again.");
          } else {
            Alert.alert("Error", "Could not unblock this account. Try again.");
          }
        } finally {
          setBusyId(null);
        }
      })();
    },
    [busyId, token, user?.id]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Blocked</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={APP_LIME} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.userId)}
          contentContainerStyle={users.length ? styles.list : styles.centered}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{loadError || "No blocked accounts"}</Text>
          }
          renderItem={({ item }) => {
            const username = String(item.username || "").replace(/^@+/, "");
            return (
              <View style={styles.row}>
                <UserAvatar
                  uri={item.avatarUrl}
                  name={item.fullName || "?"}
                  size={44}
                  borderRadius={22}
                  style={styles.avatar}
                />
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.fullName}
                  </Text>
                  {username ? (
                    <Text style={styles.username} numberOfLines={1}>
                      @{username}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  style={styles.unblockBtn}
                  disabled={busyId === item.userId}
                  onPress={() => onUnblock(item)}
                >
                  {busyId === item.userId ? (
                    <ActivityIndicator size="small" color={APP_TEXT} />
                  ) : (
                    <Text style={styles.unblockText}>Unblock</Text>
                  )}
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: APP_TEXT,
    fontSize: 16,
    fontWeight: "600"
  },
  list: { paddingVertical: 8 },
  centered: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: APP_TEXT_MUTED, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  rowBody: { flex: 1, gap: 2 },
  name: { color: APP_TEXT, fontSize: 15, fontWeight: "600" },
  username: { color: APP_TEXT_MUTED, fontSize: 13 },
  unblockBtn: {
    minWidth: 88,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: APP_SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DIVIDER
  },
  unblockText: { color: APP_TEXT, fontSize: 13, fontWeight: "700" },
  divider: { height: 1, backgroundColor: DIVIDER, marginLeft: 72 }
});
