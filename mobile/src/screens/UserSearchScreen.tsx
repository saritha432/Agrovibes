import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fetchSocialNetwork, fetchUsers, sendFollowRequest } from "../services/api";
import {
  getLocalFollowNetworkByIdentity,
  sendLocalFollowRequestByIdentity
} from "../social/localFollowStore";
import { socialDiscoveryTheme as T } from "../theme/socialDiscoveryTheme";
import { useLanguage } from "../localization/LanguageContext";

type SearchUserFollowRow = "following" | "requested" | "follow_back" | "follow";

type SearchUser = {
  id?: number;
  key?: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  /** Matches profile Following sheet: accepted, or merged local+server following — not outgoing pending alone. */
  followRow: SearchUserFollowRow;
};

/** Same normalization as ProfileScreen follow lists (stable name matching). */
function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function parsePersonUserId(person: { key?: string }) {
  const raw = String(person.key || "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export function UserSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const { token, user } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("searchUsers") });
  }, [navigation, t]);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [busyName, setBusyName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(T.navBg);
      }
      return () => {
        StatusBar.setBarStyle("dark-content");
        if (Platform.OS === "android") {
          StatusBar.setBackgroundColor("#ffffff");
        }
      };
    }, [])
  );

  const load = useCallback(async (searchText = "") => {
    const list: SearchUser[] = [];
    const seen = new Set<string>();
    const selfName = normalizeName(user?.fullName || "");
    const identity = { name: user?.fullName || "", key: user?.email || String(user?.id || "") };

    if (token && user?.id) {
      try {
        const uid = Number(user.id);
        const [{ users: remoteUsers }, network, localNet] = await Promise.all([
          fetchUsers(token, { search: searchText, limit: 100 }),
          fetchSocialNetwork(token, uid),
          getLocalFollowNetworkByIdentity(identity)
        ]);

        const mergedFollowing = [...(network.following || []), ...(localNet.following || [])];
        const followingIds = new Set<number>();
        const followingNames = new Set<string>();
        for (const p of mergedFollowing) {
          const pid = parsePersonUserId(p);
          if (pid != null && pid > 0) followingIds.add(pid);
          const nn = normalizeName(p.name);
          if (nn) followingNames.add(nn);
        }

        for (const remoteUser of remoteUsers) {
          const n = normalizeName(remoteUser.fullName);
          if (!n || n === selfName || seen.has(`id:${remoteUser.id}`)) continue;
          seen.add(`id:${remoteUser.id}`);

          const inMergedFollowing = followingIds.has(remoteUser.id) || followingNames.has(n);
          const serverAccepted = remoteUser.viewerStatus === "accepted";
          const outgoingPending = remoteUser.viewerStatus === "pending";
          const isFollowing = serverAccepted || inMergedFollowing;

          let followRow: SearchUserFollowRow;
          if (isFollowing) followRow = "following";
          else if (outgoingPending) followRow = "requested";
          else if (remoteUser.canFollowBack) followRow = "follow_back";
          else followRow = "follow";

          list.push({
            id: remoteUser.id,
            key: String(remoteUser.id),
            name: remoteUser.fullName,
            username: remoteUser.username,
            avatarUrl: remoteUser.avatarUrl,
            followRow
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
        if (!key || key === selfName || seen.has(`name:${normalizeKey(n.key)}::${key}`)) continue;
        seen.add(`name:${normalizeKey(n.key)}::${key}`);
        const isFollowing = following.some((f) => normalizeName(f.name) === key);
        list.push({
          name: n.name,
          key: n.key,
          followRow: isFollowing ? "following" : "follow"
        });
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
      await load(query);
    } finally {
      setBusyName(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={T.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchUsers")}
          placeholderTextColor={T.muted}
          style={styles.input}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.key || item.name}`}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{t("noUsersFound")}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.rowMain}
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
            </Pressable>
            {item.followRow === "following" ? (
              <Text style={styles.followingText}>{t("following")}</Text>
            ) : item.followRow === "requested" ? (
              <Text style={styles.requestedText}>{t("requested")}</Text>
            ) : item.followRow === "follow_back" ? (
              <Pressable style={styles.followBtn} onPress={() => onFollow(item)} disabled={busyName === item.name}>
                <Text style={styles.followBtnText}>{busyName === item.name ? t("followBusy") : t("followBack")}</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.followBtn} onPress={() => onFollow(item)} disabled={busyName === item.name}>
                <Text style={styles.followBtnText}>{busyName === item.name ? t("followBusy") : t("follow")}</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  searchWrap: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: T.searchBarBg,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 12,
    height: 40,
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  input: { flex: 1, color: T.text, fontSize: 15, paddingVertical: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rowDivider,
    gap: 10
  },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: T.avatarRing,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: T.accent, fontWeight: "800", fontSize: 17 },
  name: { flex: 1, color: T.text, fontWeight: "700", fontSize: 15 },
  followBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  followBtnText: { color: T.accentText, fontSize: 13, fontWeight: "800" },
  followingText: { color: T.muted, fontWeight: "700", fontSize: 13 },
  requestedText: { color: T.muted, fontWeight: "700", fontSize: 13, fontStyle: "italic" },
  empty: { padding: 20, textAlign: "center", color: T.muted, fontSize: 14 }
});
