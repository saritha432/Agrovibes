import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "../components/UserAvatar";
import { formatDisplayName } from "../localization/feedDisplay";
import { useLanguage } from "../localization/LanguageContext";
import { navigateToMyProfile, navigateToPublicProfile } from "../navigation/navigationRef";
import { fetchRelationships, fetchUsers, sendFollowRequest, type FollowStatus } from "../services/api";
import { getLocalFollowNetworkByIdentity, sendLocalFollowRequestByIdentity } from "../social/localFollowStore";
import { APP_LIME } from "../theme/appColors";

const BG = "#121212";
const SEARCH_BG = "#303132";
const ROW_BORDER = "#2a2a2a";
const MUTED = "#9e9e9e";
const TEXT = "#ffffff";
const SEARCH_ICON = APP_LIME;

type SearchUser = {
  id?: number;
  key?: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
};

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function UserSearchScreen() {
  const { t, language } = useLanguage();
  const { token, user } = useAuth();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<SearchUser[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [recentUsers, setRecentUsers] = useState<SearchUser[]>([]);
  const [followStatusByUserId, setFollowStatusByUserId] = useState<Record<number, FollowStatus>>({});
  const [followBusyByUserId, setFollowBusyByUserId] = useState<Record<number, boolean>>({});

  const trimmedQuery = query.trim();
  const isUserSearchMode = trimmedQuery.length > 0;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(BG);
      }
      return () => {
        StatusBar.setBarStyle("dark-content");
        if (Platform.OS === "android") {
          StatusBar.setBackgroundColor("#ffffff");
        }
      };
    }, [])
  );

  const loadUsers = useCallback(
    async (searchText: string) => {
      const needle = searchText.trim();
      if (!needle) {
        setUsers([]);
        return;
      }

      setLoadingUsers(true);
      const list: SearchUser[] = [];
      const seen = new Set<string>();
      const selfId = Number(user?.id) || 0;
      const selfName = normalizeName(user?.fullName || user?.username || "");
      const identity = { name: user?.fullName || "", key: user?.email || String(user?.id || "") };

      try {
        if (token) {
          try {
            const { users: remoteUsers } = await fetchUsers(token, { search: needle, limit: 50 });
            for (const remoteUser of remoteUsers) {
              if (remoteUser.id === selfId) continue;
              const displayName = remoteUser.fullName || remoteUser.username || "";
              const n = normalizeName(displayName);
              if (!n || n === selfName || seen.has(String(remoteUser.id))) continue;
              seen.add(String(remoteUser.id));
              list.push({
                id: remoteUser.id,
                key: String(remoteUser.id),
                name: displayName,
                username: remoteUser.username,
                avatarUrl: remoteUser.avatarUrl
              });
            }
            setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
            return;
          } catch {
            /* fall through to local network */
          }
        }

        const { followers, following } = await getLocalFollowNetworkByIdentity(identity);
        const q = normalizeName(needle);
        for (const person of [...following, ...followers]) {
          const key = normalizeName(person.name);
          if (!key || key === selfName || seen.has(key)) continue;
          if (!key.includes(q)) continue;
          seen.add(key);
          list.push({ name: person.name, key: person.key });
        }
        setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    },
    [token, user?.email, user?.fullName, user?.id, user?.username]
  );

  const loadSuggestedUsers = useCallback(async () => {
    setLoadingSuggestions(true);
    const list: SearchUser[] = [];
    const seen = new Set<string>();
    const selfId = Number(user?.id) || 0;
    const selfName = normalizeName(user?.fullName || user?.username || "");
    const identity = { name: user?.fullName || "", key: user?.email || String(user?.id || "") };
    try {
      if (token) {
        try {
          const { users: remoteUsers } = await fetchUsers(token, { limit: 20 });
          for (const remoteUser of remoteUsers) {
            if (remoteUser.id === selfId) continue;
            const displayName = remoteUser.fullName || remoteUser.username || "";
            const n = normalizeName(displayName);
            if (!n || n === selfName || seen.has(String(remoteUser.id))) continue;
            seen.add(String(remoteUser.id));
            list.push({
              id: remoteUser.id,
              key: String(remoteUser.id),
              name: displayName,
              username: remoteUser.username,
              avatarUrl: remoteUser.avatarUrl
            });
          }
          setSuggestedUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
          return;
        } catch {
          /* fall through to local network */
        }
      }
      const { followers, following } = await getLocalFollowNetworkByIdentity(identity);
      for (const person of [...following, ...followers]) {
        const key = normalizeName(person.name);
        if (!key || key === selfName || seen.has(key)) continue;
        seen.add(key);
        list.push({ name: person.name, key: person.key });
      }
      setSuggestedUsers(list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20));
    } catch {
      setSuggestedUsers([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [token, user?.email, user?.fullName, user?.id, user?.username]);

  useFocusEffect(
    useCallback(() => {
      void loadSuggestedUsers();
    }, [loadSuggestedUsers])
  );

  const suggestionRows = useMemo(() => {
    const recentKeys = new Set(recentUsers.map((u) => String(u.id || u.key || normalizeName(u.name))));
    return suggestedUsers.filter((u) => !recentKeys.has(String(u.id || u.key || normalizeName(u.name))));
  }, [recentUsers, suggestedUsers]);

  useEffect(() => {
    if (!isUserSearchMode) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }
    const handle = setTimeout(() => {
      void loadUsers(trimmedQuery);
    }, 250);
    return () => clearTimeout(handle);
  }, [isUserSearchMode, loadUsers, trimmedQuery]);

  useEffect(() => {
    if (!token) return;
    const ids = suggestionRows
      .map((person) => Number(person.id) || 0)
      .filter((id) => id > 0);
    if (!ids.length) return;
    void fetchRelationships(token, ids)
      .then(({ relationships }) => {
        const next: Record<number, FollowStatus> = {};
        for (const [idStr, rel] of Object.entries(relationships)) {
          const id = Number(idStr);
          if (rel.viewerStatus === "accepted" || rel.viewerStatus === "pending") {
            next[id] = rel.viewerStatus;
          }
        }
        setFollowStatusByUserId((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {});
  }, [suggestionRows, token]);

  const handleFollowSuggestion = useCallback(
    async (person: SearchUser) => {
      const targetUserId = Number(person.id) || 0;
      if (targetUserId && followBusyByUserId[targetUserId]) return;

      if (!targetUserId) {
        await sendLocalFollowRequestByIdentity(
          { name: user?.fullName || "Farmer", key: user?.email || String(user?.id || "") },
          { name: person.name, key: person.key }
        );
        return;
      }

      if (!token) return;
      setFollowBusyByUserId((prev) => ({ ...prev, [targetUserId]: true }));
      try {
        const data = await sendFollowRequest(token, targetUserId);
        setFollowStatusByUserId((prev) => ({ ...prev, [targetUserId]: data.follow.status }));
      } catch (error: any) {
        Alert.alert(t("followFailed"), error?.message || t("followFailedMessage"));
      } finally {
        setFollowBusyByUserId((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [followBusyByUserId, t, token, user?.email, user?.fullName, user?.id]
  );

  const openUserProfile = useCallback(
    (person: SearchUser) => {
      setRecentUsers((prev) => {
        const id = String(person.id || person.key || normalizeName(person.name));
        const deduped = prev.filter((u) => String(u.id || u.key || normalizeName(u.name)) !== id);
        return [person, ...deduped].slice(0, 4);
      });
      const selfId = Number(user?.id) || 0;
      if (person.id && person.id === selfId) {
        navigateToMyProfile();
        return;
      }
      navigateToPublicProfile({
        userId: person.id,
        userName: person.name,
        userKey: person.key,
        avatarUrl: person.avatarUrl ?? null
      });
    },
    [user?.id]
  );

  const renderUserRow = useCallback(
    ({ item, showDot }: { item: SearchUser; showDot?: boolean }) => {
      const displayName = formatDisplayName(item.name, language, t);
      const handle = item.username ? `@${item.username.replace(/^@/, "")}` : null;

      return (
        <Pressable style={styles.userRow} onPress={() => openUserProfile(item)}>
          <UserAvatar
            uri={item.avatarUrl}
            name={item.name}
            size={48}
            borderRadius={24}
            fallbackBackgroundColor={SEARCH_BG}
            initialsColor={MUTED}
          />
          <View style={styles.userMeta}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.userSub} numberOfLines={1}>
              {handle || "Farmer"} {showDot ? "  ·  New Post" : ""}
            </Text>
          </View>
          {showDot ? <View style={styles.newDot} /> : null}
        </Pressable>
      );
    },
    [language, openUserProfile, t]
  );

  const renderSuggestionRow = useCallback(
    (item: SearchUser) => {
      const displayName = formatDisplayName(item.name, language, t);
      const handle = item.username ? `@${item.username.replace(/^@/, "")}` : null;
      const targetUserId = Number(item.id) || 0;
      const followStatus = targetUserId ? followStatusByUserId[targetUserId] : undefined;
      const isPending = followStatus === "pending";
      const isFollowing = followStatus === "accepted";
      const followLocked = isPending || isFollowing;
      const isBusy = targetUserId ? followBusyByUserId[targetUserId] : false;

      const followLabel = isBusy
        ? t("followBusy")
        : isPending
          ? t("requested")
          : isFollowing
            ? t("following")
            : t("follow");

      return (
        <View style={styles.userRow}>
          <Pressable style={styles.userRowMain} onPress={() => openUserProfile(item)}>
            <UserAvatar
              uri={item.avatarUrl}
              name={item.name}
              size={48}
              borderRadius={24}
              fallbackBackgroundColor={SEARCH_BG}
              initialsColor={MUTED}
            />
            <View style={styles.userMeta}>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.userSub} numberOfLines={1}>
                {handle || "Farmer"}
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.followBtn, followLocked ? styles.followBtnMuted : null]}
            onPress={() => void handleFollowSuggestion(item)}
            disabled={followLocked || isBusy}
            hitSlop={6}
          >
            <Text style={[styles.followBtnText, followLocked ? styles.followBtnTextMuted : null]}>{followLabel}</Text>
          </Pressable>
        </View>
      );
    },
    [followBusyByUserId, followStatusByUserId, handleFollowSuggestion, language, openUserProfile, t]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={SEARCH_ICON} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("search")}
          placeholderTextColor={MUTED}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable hitSlop={8} onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={MUTED} />
          </Pressable>
        ) : null}
      </View>

      {isUserSearchMode ? (
        loadingUsers ? (
          <View style={styles.centered}>
            <ActivityIndicator color={APP_LIME} />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>{t("noUsersFound")}</Text>
          </View>
        ) : (
          <FlatList
            key="search-users"
            data={users}
            keyExtractor={(item) => `${item.key || item.id || item.name}`}
            renderItem={renderUserRow}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.userList}
          />
        )
      ) : loadingSuggestions ? (
        <View style={styles.centered}>
          <ActivityIndicator color={APP_LIME} />
        </View>
      ) : recentUsers.length === 0 && suggestionRows.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>{t("noUsersFound")}</Text>
        </View>
      ) : (
        <ScrollView style={styles.defaultList} contentContainerStyle={styles.defaultListInner} keyboardShouldPersistTaps="handled">
          {recentUsers.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Recent</Text>
              {recentUsers.map((item, index) => (
                <View key={`recent-${item.id || item.key || item.name}-${index}`}>{renderUserRow({ item, showDot: index === 0 })}</View>
              ))}
            </>
          ) : null}
          {suggestionRows.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, recentUsers.length > 0 ? styles.sectionTitleSpaced : null]}>Suggestion</Text>
              {suggestionRows.map((item, index) => (
                <View key={`suggested-${item.id || item.key || item.name}-${index}`}>{renderSuggestionRow(item)}</View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: SEARCH_BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  input: { flex: 1, color: TEXT, fontSize: 15, paddingVertical: 0 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptySub: { color: MUTED, fontSize: 14, textAlign: "center", marginTop: 8 },
  userList: { paddingBottom: 16, paddingTop: 6 },
  defaultList: { flex: 1 },
  defaultListInner: { paddingBottom: 16, paddingTop: 4 },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6
  },
  sectionTitleSpaced: { marginTop: 8 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ROW_BORDER
  },
  userRowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  userMeta: { flex: 1, minWidth: 0 },
  userName: { color: TEXT, fontSize: 30 / 2, fontWeight: "700" },
  userSub: { color: MUTED, fontSize: 12.5, marginTop: 2, fontWeight: "500" },
  newDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: APP_LIME
  },
  followBtn: {
    minWidth: 88,
    height: 32,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  followBtnMuted: {
    backgroundColor: SEARCH_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ROW_BORDER
  },
  followBtnText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800"
  },
  followBtnTextMuted: {
    color: TEXT
  }
});
