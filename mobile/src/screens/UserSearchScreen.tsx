import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
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
import {
  fetchMutualConnections,
  fetchSocialNetwork,
  fetchUsers,
  sendFollowRequest,
  type MutualConnectionInfo,
  type UserSearchRecord
} from "../services/api";
import { formatMutualConnectionLabel } from "../social/formatMutualConnection";
import {
  getLocalFollowNetworkByIdentity,
  sendLocalFollowRequestByIdentity
} from "../social/localFollowStore";
import { socialDiscoveryTheme as T } from "../theme/socialDiscoveryTheme";
import { useLanguage } from "../localization/LanguageContext";
import { UserAvatar } from "../components/UserAvatar";

type SearchUserFollowRow = "following" | "requested" | "follow_back" | "follow";

type SearchUser = {
  id?: number;
  key?: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  followRow: SearchUserFollowRow;
};

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

function mapRemoteUsersToSearchRows(
  remoteUsers: UserSearchRecord[],
  ctx: {
    selfName: string;
    followingIds: Set<number>;
    followingNames: Set<string>;
  }
): SearchUser[] {
  const list: SearchUser[] = [];
  const seen = new Set<string>();
  for (const remoteUser of remoteUsers) {
    const n = normalizeName(remoteUser.fullName);
    if (!n || n === ctx.selfName || seen.has(`id:${remoteUser.id}`)) continue;
    seen.add(`id:${remoteUser.id}`);

    const inMergedFollowing = ctx.followingIds.has(remoteUser.id) || ctx.followingNames.has(n);
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
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function UserSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const { token, user } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("searchUsers") });
  }, [navigation, t]);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchUser[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [mutualByUserId, setMutualByUserId] = useState<Record<number, MutualConnectionInfo>>({});
  const [busyName, setBusyName] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

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

  const buildFollowContext = useCallback(async () => {
    const selfName = normalizeName(user?.fullName || "");
    const identity = { name: user?.fullName || "", key: user?.email || String(user?.id || "") };
    const followingIds = new Set<number>();
    const followingNames = new Set<string>();
    const followerIds: number[] = [];

    if (token && user?.id) {
      try {
        const [network, localNet] = await Promise.all([
          fetchSocialNetwork(token, Number(user.id)),
          getLocalFollowNetworkByIdentity(identity)
        ]);
        const mergedFollowing = [...(network.following || []), ...(localNet.following || [])];
        for (const p of mergedFollowing) {
          const pid = parsePersonUserId(p);
          if (pid != null && pid > 0) followingIds.add(pid);
          const nn = normalizeName(p.name);
          if (nn) followingNames.add(nn);
        }
        for (const p of network.followers || []) {
          const pid = parsePersonUserId(p);
          if (pid != null && pid > 0) followerIds.push(pid);
        }
      } catch {
        // Suggestions still load without network merge.
      }
    }

    return { selfName, followingIds, followingNames, followerIds, identity };
  }, [token, user?.email, user?.fullName, user?.id]);

  const loadSuggestions = useCallback(async () => {
    if (!token || !user?.id) {
      setSuggestions([]);
      return;
    }
    try {
      const { selfName, followingIds, followingNames, followerIds } = await buildFollowContext();
      const myId = Number(user.id);
      const data = await fetchUsers(token, { limit: 40 });
      const alreadyConnected = new Set([...followingIds, ...followerIds, myId]);
      const candidates = (data.users || []).filter(
        (u) =>
          u.id !== myId &&
          !alreadyConnected.has(u.id) &&
          u.viewerStatus !== "accepted" &&
          u.viewerStatus !== "pending"
      );
      const slice = candidates.slice(0, 20);
      const ids = slice.map((u) => u.id);
      let connections: Record<number, MutualConnectionInfo> = {};
      try {
        const mutualRes = await fetchMutualConnections(token, ids);
        connections = mutualRes.connections || {};
      } catch {
        connections = {};
      }
      const sorted = [...slice].sort((a, b) => {
        const aConn = connections[a.id];
        const bConn = connections[b.id];
        const aScore = (aConn?.mutualCount ?? 0) * 10 + (aConn?.followsYou ? 5 : 0) + (followerIds.includes(a.id) ? 1 : 0);
        const bScore = (bConn?.mutualCount ?? 0) * 10 + (bConn?.followsYou ? 5 : 0) + (followerIds.includes(b.id) ? 1 : 0);
        return bScore - aScore;
      });
      setMutualByUserId(connections);
      setSuggestions(mapRemoteUsersToSearchRows(sorted.slice(0, 15), { selfName, followingIds, followingNames }));
    } catch {
      setSuggestions([]);
      setMutualByUserId({});
    }
  }, [buildFollowContext, token, user?.id]);

  const runSearch = useCallback(
    async (searchText: string) => {
      const q = searchText.trim();
      if (!q) {
        setSearchResults([]);
        return;
      }
      if (!token) {
        setSearchResults([]);
        return;
      }
      try {
        const { selfName, followingIds, followingNames } = await buildFollowContext();
        const { users: remoteUsers } = await fetchUsers(token, { search: q, limit: 50 });
        const rows = mapRemoteUsersToSearchRows(remoteUsers, { selfName, followingIds, followingNames });
        const ids = rows.map((r) => r.id).filter((id): id is number => id != null && id > 0);
        let connections: Record<number, MutualConnectionInfo> = {};
        try {
          const mutualRes = await fetchMutualConnections(token, ids);
          connections = mutualRes.connections || {};
        } catch {
          connections = {};
        }
        setMutualByUserId(connections);
        setSearchResults(rows);
      } catch {
        setSearchResults([]);
        setMutualByUserId({});
      }
    },
    [buildFollowContext, token]
  );

  useFocusEffect(
    useCallback(() => {
      void loadSuggestions();
    }, [loadSuggestions])
  );

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(() => {
      void runSearch(trimmedQuery);
    }, 250);
    return () => clearTimeout(handle);
  }, [isSearching, runSearch, trimmedQuery]);

  const refreshLists = useCallback(async () => {
    if (isSearching) await runSearch(trimmedQuery);
    else await loadSuggestions();
  }, [isSearching, loadSuggestions, runSearch, trimmedQuery]);

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
      await refreshLists();
    } finally {
      setBusyName(null);
    }
  };

  const renderUserRow = useCallback(
    (item: SearchUser) => (
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
          <View style={styles.nameCol}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {(() => {
              const mutualLabel =
                item.id != null ? formatMutualConnectionLabel(mutualByUserId[item.id], t) : "";
              if (mutualLabel) {
                return (
                  <Text style={styles.mutualHint} numberOfLines={2}>
                    {mutualLabel}
                  </Text>
                );
              }
              return item.username ? (
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username.replace(/^@/, "")}
                </Text>
              ) : null;
            })()}
          </View>
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
    ),
    [busyName, mutualByUserId, navigation, onFollow, t]
  );

  const suggestionsHeader = useMemo(() => {
    if (isSearching || !suggestions.length) return null;
    return (
      <View style={styles.suggestedBlock}>
        <Text style={styles.suggestedTitle}>{t("peopleYouMayKnow")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedRow}>
          {suggestions.map((person) => (
            <View key={person.key || person.name} style={styles.suggestedCard}>
              <Pressable
                onPress={() =>
                  navigation.navigate("PublicProfile", {
                    userId: person.id,
                    userName: person.name,
                    userKey: person.key,
                    avatarUrl: person.avatarUrl
                  })
                }
              >
                <UserAvatar uri={person.avatarUrl} name={person.name} size={52} borderRadius={26} />
              </Pressable>
              <Text style={styles.suggestedName} numberOfLines={1}>
                {person.name}
              </Text>
              {person.id != null && formatMutualConnectionLabel(mutualByUserId[person.id], t) ? (
                <Text style={styles.suggestedMutual} numberOfLines={2}>
                  {formatMutualConnectionLabel(mutualByUserId[person.id], t)}
                </Text>
              ) : null}
              {person.followRow === "following" || person.followRow === "requested" ? (
                <Text style={styles.suggestedStatus}>
                  {person.followRow === "following" ? t("following") : t("requested")}
                </Text>
              ) : (
                <Pressable style={styles.suggestedFollowBtn} onPress={() => onFollow(person)} disabled={busyName === person.name}>
                  <Text style={styles.suggestedFollowText}>
                    {busyName === person.name ? t("followBusy") : person.followRow === "follow_back" ? t("followBack") : t("follow")}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }, [busyName, isSearching, mutualByUserId, navigation, onFollow, suggestions, t]);

  const listEmpty = useMemo(() => {
    if (!isSearching) {
      if (suggestions.length) return null;
      return <Text style={styles.empty}>{t("searchUsers")}</Text>;
    }
    return <Text style={styles.empty}>{t("noUsersFound")}</Text>;
  }, [isSearching, suggestions.length, t]);

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
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable hitSlop={8} onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={T.muted} />
          </Pressable>
        ) : null}
      </View>

      {!isSearching ? suggestionsHeader : null}

      {isSearching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => `${item.key || item.name}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={listEmpty}
          renderItem={({ item }) => renderUserRow(item)}
        />
      ) : (
        <View style={styles.idleBody}>{listEmpty}</View>
      )}
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
  idleBody: { flex: 1 },
  suggestedBlock: { paddingBottom: 8 },
  suggestedTitle: {
    color: T.text,
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 14,
    marginBottom: 10
  },
  suggestedRow: { paddingHorizontal: 12, gap: 10 },
  suggestedCard: {
    width: 108,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: T.searchBarBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border
  },
  suggestedName: { marginTop: 8, color: T.text, fontSize: 12, fontWeight: "700", maxWidth: 96, textAlign: "center" },
  suggestedMutual: {
    marginTop: 4,
    color: T.muted,
    fontSize: 10,
    fontWeight: "600",
    maxWidth: 96,
    textAlign: "center",
    lineHeight: 13
  },
  mutualHint: { color: T.muted, fontSize: 12, fontWeight: "600", marginTop: 2, lineHeight: 16 },
  suggestedFollowBtn: {
    marginTop: 8,
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  suggestedFollowText: { color: T.accentText, fontSize: 11, fontWeight: "800" },
  suggestedStatus: { marginTop: 8, color: T.muted, fontSize: 11, fontWeight: "700" },
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
  nameCol: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontWeight: "700", fontSize: 15 },
  username: { color: T.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  followBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  followBtnText: { color: T.accentText, fontSize: 13, fontWeight: "800" },
  followingText: { color: T.muted, fontWeight: "700", fontSize: 13 },
  requestedText: { color: T.muted, fontWeight: "700", fontSize: 13, fontStyle: "italic" },
  empty: { padding: 20, textAlign: "center", color: T.muted, fontSize: 14 }
});
