import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fetchUsers, sendFollowRequest } from "../services/api";
import {
  getLocalFollowNetworkByIdentity,
  sendLocalFollowRequestByIdentity
} from "../social/localFollowStore";

type SearchUser = {
  id?: number;
  key?: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  isFollowing: boolean;
};

const BG = "#ffffff";
const TEXT = "#101010";
const MUTED = "#8a8a8a";
const BORDER = "#e6e6e6";
const TEAL = "#0f9b8e";

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function UserSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [busyName, setBusyName] = useState<string | null>(null);

  const load = useCallback(async (searchText = "") => {
    const list: SearchUser[] = [];
    const seen = new Set<string>();
    const selfName = normalizeName(user?.fullName || "");
    const identity = { name: user?.fullName || "", key: user?.email || String(user?.id || "") };

    if (token) {
      try {
        const { users: remoteUsers } = await fetchUsers(token, { search: searchText, limit: 100 });
        for (const remoteUser of remoteUsers) {
          const n = normalizeName(remoteUser.fullName);
          if (!n || n === selfName || seen.has(n)) continue;
          seen.add(n);
          list.push({
            id: remoteUser.id,
            key: String(remoteUser.id),
            name: remoteUser.fullName,
            username: remoteUser.username,
            avatarUrl: remoteUser.avatarUrl,
            isFollowing: remoteUser.viewerStatus === "accepted" || remoteUser.viewerStatus === "pending"
          });
        }
        setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
        return;
      } catch {
        /* fall through to local */
      }
    }

    try {
      const { followers, following } = await getLocalFollowNetworkByIdentity(identity);
      for (const n of [...following, ...followers]) {
        const key = normalizeName(n.name);
        if (!key || key === selfName || seen.has(key)) continue;
        seen.add(key);
        list.push({ name: n.name, key: n.key, isFollowing: following.some((f) => normalizeName(f.name) === key) });
      }
      setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setUsers([]);
    }
  }, [token, user?.id, user?.fullName, user?.email]);

  useFocusEffect(
    useCallback(() => {
      void load(query);
    }, [load, query])
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      void load(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [load, query]);

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    if (!q) return users;
    return users.filter((u) => normalizeName(u.name).includes(q));
  }, [query, users]);

  const onFollow = async (person: SearchUser) => {
    if (!user?.fullName) return;
    setBusyName(person.name);
    try {
      if (token && person.id) {
        await sendFollowRequest(token, person.id);
      } else {
        await sendLocalFollowRequestByIdentity(
          { name: user.fullName, key: user.email || String(user.id || "") },
          { name: person.name, key: person.key }
        );
      }
      setUsers((prev) => prev.map((p) => (normalizeName(p.name) === normalizeName(person.name) ? { ...p, isFollowing: true } : p)));
    } finally {
      setBusyName(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users"
          placeholderTextColor={MUTED}
          style={styles.input}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.key || item.name}`}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate("PublicProfile", {
                userId: item.id,
                userName: item.name,
                userKey: item.key,
                avatarUrl: item.avatarUrl
              })
            }
          >
            <View style={styles.avatar}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isFollowing ? (
              <Text style={styles.followingText}>Following</Text>
            ) : (
              <Pressable style={styles.followBtn} onPress={() => onFollow(item)} disabled={busyName === item.name}>
                <Text style={styles.followBtnText}>{busyName === item.name ? "..." : "Follow"}</Text>
              </Pressable>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  searchWrap: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  input: { flex: 1, color: TEXT, fontSize: 15, paddingVertical: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 10
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e6f2ef",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: TEAL, fontWeight: "800", fontSize: 17 },
  name: { flex: 1, color: TEXT, fontWeight: "700", fontSize: 15 },
  followBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  followBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  followingText: { color: MUTED, fontWeight: "700", fontSize: 13 },
  empty: { padding: 20, textAlign: "center", color: MUTED, fontSize: 14 }
});
