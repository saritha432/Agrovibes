import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { PostsReelViewerModal } from "../components/PostsReelViewerModal";
import { ReelGridTile } from "../components/ReelGridTile";
import { useReelGridAutoplay } from "../hooks/useReelGridAutoplay";
import { UserAvatar } from "../components/UserAvatar";
import { formatDisplayName } from "../localization/feedDisplay";
import { useLanguage } from "../localization/LanguageContext";
import type { AppLanguage } from "../localization/LanguageContext";
import { navigateToMyProfile, navigateToPublicProfile } from "../navigation/navigationRef";
import {
  fetchHomePosts,
  fetchUsers,
  sendFollowRequest,
  type FollowStatus,
  type HomePost
} from "../services/api";
import { isReelPost, reelGridTileBackground } from "../utils/reelGrid";
import { hydrateReelPreviews } from "../utils/reelPreviewThumb";
import { getLocalFollowNetworkByIdentity } from "../social/localFollowStore";
import { APP_LIME } from "../theme/appColors";

const EXPLORE_REELS_LIMIT = 60;
const BG = "#121212";
const SEARCH_BG = "#303132";
const ROW_BORDER = "#2a2a2a";
const MUTED = "#9e9e9e";
const TEXT = "#ffffff";
const SEARCH_ICON = APP_LIME;
const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const RECENT_USERS_KEY = "discover.recentUsers.v1";
const RECENT_SEARCHES_KEY = "discover.recentSearches.v1";
const MAX_RECENT_USERS = 12;
const MAX_RECENT_SEARCHES = 10;

type SearchUser = {
  id?: number;
  key?: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  viewerStatus?: FollowStatus;
  reverseStatus?: FollowStatus;
};

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function userRowKey(person: SearchUser) {
  return String(person.id || person.key || normalizeName(person.name));
}

function personMatchesQuery(person: SearchUser, needle: string) {
  const q = normalizeName(needle);
  if (!q) return false;
  const name = normalizeName(person.name);
  const username = normalizeName(String(person.username || "").replace(/^@+/, ""));
  return name.includes(q) || (username.length > 0 && username.includes(q));
}

function personSearchScore(person: SearchUser, needle: string) {
  const q = normalizeName(needle);
  if (!q) return 99;
  const name = normalizeName(person.name);
  const username = normalizeName(String(person.username || "").replace(/^@+/, ""));
  if (username.startsWith(q)) return 0;
  if (name.startsWith(q)) return 1;
  if (username.includes(q)) return 2;
  if (name.includes(q)) return 3;
  return 99;
}

function sortUsersForSearch(list: SearchUser[], needle: string) {
  return [...list].sort((a, b) => {
    const scoreDiff = personSearchScore(a, needle) - personSearchScore(b, needle);
    if (scoreDiff !== 0) return scoreDiff;
    const aLabel = String(a.username || a.name || "");
    const bLabel = String(b.username || b.name || "");
    return aLabel.localeCompare(bLabel);
  });
}

function buildSearchUserList(
  remoteUsers: Array<{
    id: number;
    fullName: string;
    username?: string | null;
    avatarUrl?: string | null;
    viewerStatus?: FollowStatus;
    reverseStatus?: FollowStatus;
  }>,
  self?: { id?: number; fullName?: string | null; username?: string | null } | null
) {
  const list: SearchUser[] = [];
  const seen = new Set<string>();
  const selfId = Number(self?.id) || 0;
  const selfName = normalizeName(self?.fullName || self?.username || "");

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
      avatarUrl: remoteUser.avatarUrl,
      viewerStatus: remoteUser.viewerStatus,
      reverseStatus: remoteUser.reverseStatus
    });
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function accountPrimaryLabel(person: SearchUser, language: AppLanguage, t: (key: string) => string) {
  const username = String(person.username || "").replace(/^@+/, "").trim();
  if (username) return username;
  return formatDisplayName(person.name, language, t);
}

function accountSecondaryLabel(person: SearchUser, language: AppLanguage, t: (key: string) => string) {
  const username = String(person.username || "").replace(/^@+/, "").trim();
  if (username) return formatDisplayName(person.name, language, t);
  return "Farmer";
}
function dedupeUsers(list: SearchUser[]) {
  const seen = new Set<string>();
  const out: SearchUser[] = [];
  for (const person of list) {
    const key = userRowKey(person);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(person);
  }
  return out;
}

function HighlightedQueryText({
  text,
  query,
  style,
  highlightStyle
}: {
  text: string;
  query: string;
  style?: object;
  highlightStyle?: object;
}) {
  const source = String(text || "");
  const needle = query.trim();
  if (!needle) {
    return (
      <Text style={style} numberOfLines={1}>
        {source}
      </Text>
    );
  }
  const lower = source.toLowerCase();
  const qLower = needle.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx < 0) {
    return (
      <Text style={style} numberOfLines={1}>
        {source}
      </Text>
    );
  }
  return (
    <Text style={style} numberOfLines={1}>
      {source.slice(0, idx)}
      <Text style={highlightStyle}>{source.slice(idx, idx + needle.length)}</Text>
      {source.slice(idx + needle.length)}
    </Text>
  );
}

export function UserSearchScreen() {
  const { t, language } = useLanguage();
  const { token, user } = useAuth();
  const { width } = useWindowDimensions();
  const searchInputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<SearchUser[]>([]);
  const [userDirectory, setUserDirectory] = useState<SearchUser[]>([]);
  const [recentUsers, setRecentUsers] = useState<SearchUser[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [explorePosts, setExplorePosts] = useState<HomePost[]>([]);
  const [previewUriByPostId, setPreviewUriByPostId] = useState<Record<number, string>>({});
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [exploreViewer, setExploreViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);
  const [followBusyById, setFollowBusyById] = useState<Record<number, boolean>>({});

  const trimmedQuery = query.trim();
  const isTyping = query.length > 0;
  const showTypeahead = isTyping;
  const { playingPostId, markVideoFailed } = useReelGridAutoplay(explorePosts, {
    enabled: !showTypeahead && explorePosts.length > 0,
    intervalMs: 8000
  });

  const gridTileSize = (width - GRID_GAP * 2) / GRID_COLUMNS;
  const reelTileHeight = Math.round(gridTileSize * (16 / 9));

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
                avatarUrl: remoteUser.avatarUrl,
                viewerStatus: remoteUser.viewerStatus,
                reverseStatus: remoteUser.reverseStatus
              });
            }
            setUsers(sortUsersForSearch(list, needle));
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
        setUsers(sortUsersForSearch(list, needle));
      } catch {
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    },
    [token, user?.email, user?.fullName, user?.id, user?.username]
  );

  const loadSuggestedUsers = useCallback(async () => {
    const identity = { name: user?.fullName || "", key: user?.email || String(user?.id || "") };
    const selfName = normalizeName(user?.fullName || user?.username || "");
    try {
      if (token) {
        try {
          const { users: remoteUsers } = await fetchUsers(token, { limit: 150 });
          const directory = buildSearchUserList(remoteUsers, user);
          setUserDirectory(directory);
          setSuggestedUsers(directory.slice(0, 20));
          return;
        } catch {
          /* fall through to local network */
        }
      }
      const list: SearchUser[] = [];
      const seen = new Set<string>();
      const { followers, following } = await getLocalFollowNetworkByIdentity(identity);
      for (const person of [...following, ...followers]) {
        const key = normalizeName(person.name);
        if (!key || key === selfName || seen.has(key)) continue;
        seen.add(key);
        list.push({ name: person.name, key: person.key });
      }
      const directory = list.sort((a, b) => a.name.localeCompare(b.name));
      setUserDirectory(directory);
      setSuggestedUsers(directory.slice(0, 20));
    } catch {
      setUserDirectory([]);
      setSuggestedUsers([]);
    }
  }, [token, user]);

  const loadExplorePosts = useCallback(async () => {
    setLoadingExplore(true);
    try {
      const { posts } = await fetchHomePosts(token);
      const reels = posts
        .filter((post) => isReelPost(post))
        .sort((a, b) => {
          const aTime = Date.parse(String(a.createdAt || "")) || 0;
          const bTime = Date.parse(String(b.createdAt || "")) || 0;
          return bTime - aTime || b.id - a.id;
        })
        .slice(0, EXPLORE_REELS_LIMIT);
      setExplorePosts(reels);
    } catch {
      setExplorePosts([]);
    } finally {
      setLoadingExplore(false);
    }
  }, [token]);

  const explorePreviewKey = useMemo(
    () => explorePosts.map((post) => post.id).join(","),
    [explorePosts]
  );

  useEffect(() => {
    let cancelled = false;
    const batch = explorePosts;
    if (!batch.length) return;
    void hydrateReelPreviews(
      batch,
      (postId, uri) => {
        if (cancelled) return;
        setPreviewUriByPostId((prev) => (prev[postId] === uri ? prev : { ...prev, [postId]: uri }));
      },
      { maxConcurrent: 4, isCancelled: () => cancelled }
    );
    return () => {
      cancelled = true;
    };
  }, [explorePreviewKey, explorePosts]);

  const persistRecentUsers = useCallback(async (list: SearchUser[]) => {
    try {
      await AsyncStorage.setItem(RECENT_USERS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }, []);

  const persistRecentSearches = useCallback(async (list: string[]) => {
    try {
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }, []);

  const loadPersistedSearchState = useCallback(async () => {
    try {
      const [usersRaw, searchesRaw] = await Promise.all([
        AsyncStorage.getItem(RECENT_USERS_KEY),
        AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      ]);
      if (usersRaw) {
        const parsed = JSON.parse(usersRaw) as SearchUser[];
        if (Array.isArray(parsed)) setRecentUsers(parsed.slice(0, MAX_RECENT_USERS));
      }
      if (searchesRaw) {
        const parsed = JSON.parse(searchesRaw) as string[];
        if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const addRecentSearch = useCallback(
    (term: string) => {
      const needle = term.trim();
      if (!needle) return;
      setRecentSearches((prev) => {
        const next = [needle, ...prev.filter((item) => item.toLowerCase() !== needle.toLowerCase())].slice(
          0,
          MAX_RECENT_SEARCHES
        );
        void persistRecentSearches(next);
        return next;
      });
    },
    [persistRecentSearches]
  );

  useFocusEffect(
    useCallback(() => {
      void loadSuggestedUsers();
      void loadExplorePosts();
      void loadPersistedSearchState();
    }, [loadExplorePosts, loadPersistedSearchState, loadSuggestedUsers])
  );

  const exploreAuthors = useMemo(() => {
    const map = new Map<string, SearchUser>();
    for (const post of explorePosts) {
      const name = String(post.userName || "").trim();
      if (!name) continue;
      const id = Number(post.userId) || 0;
      const key = id > 0 ? String(id) : normalizeName(name);
      if (map.has(key)) continue;
      map.set(key, {
        id: id > 0 ? id : undefined,
        key,
        name
      });
    }
    return [...map.values()];
  }, [explorePosts]);

  const searchResults = useMemo(() => {
    if (!trimmedQuery) return [];
    const localMatches = dedupeUsers([...recentUsers, ...userDirectory, ...suggestedUsers, ...exploreAuthors]).filter(
      (person) => personMatchesQuery(person, trimmedQuery)
    );
    const remoteMatches = users.filter((person) => personMatchesQuery(person, trimmedQuery));
    return sortUsersForSearch(dedupeUsers([...localMatches, ...remoteMatches]), trimmedQuery);
  }, [exploreAuthors, recentUsers, suggestedUsers, trimmedQuery, userDirectory, users]);

  useEffect(() => {
    if (!trimmedQuery) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }
    const handle = setTimeout(() => {
      void loadUsers(trimmedQuery);
    }, 180);
    return () => clearTimeout(handle);
  }, [loadUsers, trimmedQuery]);

  const openUserProfile = useCallback(
    (person: SearchUser) => {
      setRecentUsers((prev) => {
        const id = userRowKey(person);
        const deduped = prev.filter((u) => userRowKey(u) !== id);
        const next = [person, ...deduped].slice(0, MAX_RECENT_USERS);
        void persistRecentUsers(next);
        return next;
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
    [persistRecentUsers, user?.id]
  );

  const followStatusLabel = useCallback(
    (person: SearchUser) => {
      const status = person.viewerStatus;
      if (status === "accepted") return t("following");
      if (status === "pending") return t("requested");
      if (followBusyById[Number(person.id) || 0]) return t("followBusy");
      return t("follow");
    },
    [followBusyById, t]
  );

  const toggleFollowUser = useCallback(
    async (person: SearchUser) => {
      const targetId = Number(person.id);
      if (!token || !Number.isFinite(targetId) || targetId <= 0) return;
      if (person.viewerStatus === "accepted" || person.viewerStatus === "pending") return;
      setFollowBusyById((prev) => ({ ...prev, [targetId]: true }));
      try {
        const data = await sendFollowRequest(token, targetId);
        const nextStatus = data.follow?.status === "accepted" ? "accepted" : "pending";
        const patch = (list: SearchUser[]) =>
          list.map((row) => (row.id === targetId ? { ...row, viewerStatus: nextStatus as FollowStatus } : row));
        setUsers(patch);
        setSuggestedUsers(patch);
        setUserDirectory(patch);
      } catch {
        /* ignore */
      } finally {
        setFollowBusyById((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }
    },
    [token]
  );

  const renderAccountMeta = useCallback(
    (person: SearchUser, highlightQuery?: string) => {
      const primary = accountPrimaryLabel(person, language, t);
      const secondary = accountSecondaryLabel(person, language, t);
      const highlight = highlightQuery?.replace(/^@+/, "") || "";

      return (
        <View style={styles.userMeta}>
          {highlight ? (
            <HighlightedQueryText
              text={primary}
              query={highlight}
              style={styles.userPrimary}
              highlightStyle={styles.userPrimaryMatch}
            />
          ) : (
            <Text style={styles.userPrimary} numberOfLines={1}>
              {primary}
            </Text>
          )}
          {highlight ? (
            <HighlightedQueryText
              text={secondary}
              query={highlight}
              style={styles.userSecondary}
              highlightStyle={styles.userSecondaryMatch}
            />
          ) : (
            <Text style={styles.userSecondary} numberOfLines={1}>
              {secondary}
            </Text>
          )}
        </View>
      );
    },
    [language, t]
  );

  const renderUserRow = useCallback(
    ({ item, highlightQuery }: { item: SearchUser; highlightQuery?: string }) => {
      const hasFollowAction = !!item.id && item.id !== Number(user?.id);
      const isFollowing = item.viewerStatus === "accepted";
      const isRequested = item.viewerStatus === "pending";

      return (
        <View style={styles.userRow}>
          <Pressable style={styles.userRowMain} onPress={() => openUserProfile(item)}>
            <UserAvatar
              uri={item.avatarUrl}
              name={item.name}
              size={44}
              borderRadius={22}
              fallbackBackgroundColor={SEARCH_BG}
              initialsColor={MUTED}
            />
            {renderAccountMeta(item, highlightQuery)}
          </Pressable>
          {hasFollowAction ? (
            <Pressable
              style={[styles.followBtn, isFollowing || isRequested ? styles.followBtnMuted : null]}
              onPress={() => void toggleFollowUser(item)}
              disabled={isFollowing || isRequested || !!followBusyById[Number(item.id)]}
            >
              <Text style={[styles.followBtnText, isFollowing || isRequested ? styles.followBtnTextMuted : null]}>
                {followStatusLabel(item)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    },
    [followBusyById, followStatusLabel, openUserProfile, renderAccountMeta, toggleFollowUser, user?.id]
  );

  const openExplorePost = useCallback(
    (post: HomePost) => {
      const index = explorePosts.findIndex((item) => item.id === post.id);
      setExploreViewer({ posts: explorePosts, initialIndex: index >= 0 ? index : 0 });
    },
    [explorePosts]
  );

  const renderExploreTile = useCallback(
    ({ item: post, index }: { item: HomePost; index: number }) => (
      <ReelGridTile
        post={post}
        width={gridTileSize}
        height={reelTileHeight}
        backgroundColor={reelGridTileBackground(index, GRID_COLUMNS)}
        previewUri={previewUriByPostId[post.id]}
        isPlaying={playingPostId === post.id}
        onPress={() => openExplorePost(post)}
        onVideoError={markVideoFailed}
      />
    ),
    [gridTileSize, markVideoFailed, openExplorePost, playingPostId, previewUriByPostId, reelTileHeight]
  );

  const renderTypeaheadPanel = () => (
    <ScrollView
      style={styles.typeaheadList}
      contentContainerStyle={styles.typeaheadListInner}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
      <Pressable
        style={styles.searchForRow}
        onPress={() => {
          addRecentSearch(trimmedQuery);
          void loadUsers(trimmedQuery);
        }}
      >
        <View style={styles.searchForIconWrap}>
          <Ionicons name="search" size={16} color={SEARCH_ICON} />
        </View>
        <Text style={styles.searchForText} numberOfLines={1}>
          {trimmedQuery}
        </Text>
      </Pressable>

      {searchResults.length > 0 ? (
        searchResults.map((item, index) => (
          <View key={`search-${userRowKey(item)}-${index}`}>
            {renderUserRow({ item, highlightQuery: trimmedQuery })}
          </View>
        ))
      ) : loadingUsers ? (
        <View style={styles.inlineLoading}>
          <ActivityIndicator color={APP_LIME} />
        </View>
      ) : (
        <View style={styles.inlineEmpty}>
          <Text style={styles.emptyTitle}>{t("noUsersFound")}</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.searchHeaderRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={SEARCH_ICON} />
          <TextInput
            ref={searchInputRef}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setSearchFocused(true);
            }}
            onFocus={() => setSearchFocused(true)}
            placeholder={t("search")}
            placeholderTextColor={MUTED}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (trimmedQuery) addRecentSearch(trimmedQuery);
            }}
          />
          {query.length > 0 ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                setQuery("");
                setUsers([]);
                searchInputRef.current?.focus();
              }}
            >
              <Ionicons name="close-circle" size={18} color={MUTED} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {loadingExplore && !showTypeahead ? (
          <View style={styles.centered}>
            <ActivityIndicator color={APP_LIME} />
          </View>
        ) : (
          <FlatList
            data={explorePosts}
            keyExtractor={(item) => String(item.id)}
            numColumns={GRID_COLUMNS}
            renderItem={renderExploreTile}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={explorePosts.length ? styles.gridList : styles.gridListEmpty}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!showTypeahead}
            initialNumToRender={12}
            maxToRenderPerBatch={9}
            windowSize={5}
            removeClippedSubviews={Platform.OS === "android"}
            extraData={`${playingPostId}-${Object.keys(previewUriByPostId).length}`}
            ListEmptyComponent={
              !loadingExplore ? (
                <View style={styles.exploreEmpty}>
                  <Ionicons name="film-outline" size={40} color={MUTED} />
                  <Text style={styles.emptyTitle}>No reels yet</Text>
                </View>
              ) : null
            }
          />
        )}

        {showTypeahead ? <View style={styles.typeaheadOverlay}>{renderTypeaheadPanel()}</View> : null}
      </View>

      <PostsReelViewerModal
        visible={!!exploreViewer}
        posts={exploreViewer?.posts ?? []}
        initialIndex={exploreViewer?.initialIndex ?? 0}
        onClose={() => setExploreViewer(null)}
        onPostsChange={(nextPosts) => {
          setExplorePosts(nextPosts);
          setExploreViewer((viewer) => {
            if (!viewer) return viewer;
            if (!nextPosts.length) return null;
            return {
              posts: nextPosts,
              initialIndex: Math.min(viewer.initialIndex, nextPosts.length - 1)
            };
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  searchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6
  },
  searchWrap: {
    flex: 1,
    backgroundColor: SEARCH_BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  body: {
    flex: 1,
    position: "relative"
  },
  typeaheadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG
  },
  typeaheadList: { flex: 1 },
  typeaheadListInner: { paddingBottom: 24, paddingTop: 2 },
  input: { flex: 1, color: TEXT, fontSize: 16, paddingVertical: 0 },
  searchForRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  searchForIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SEARCH_BG,
    alignItems: "center",
    justifyContent: "center"
  },
  searchForText: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    fontWeight: "600"
  },
  recentSearchIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SEARCH_BG,
    alignItems: "center",
    justifyContent: "center"
  },
  recentSearchText: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    fontWeight: "500"
  },
  inlineLoading: {
    paddingVertical: 28,
    alignItems: "center"
  },
  inlineEmpty: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 16,
    alignItems: "center"
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptySub: { color: MUTED, fontSize: 14, textAlign: "center", marginTop: 8 },
  defaultList: { flex: 1 },
  defaultListInner: { paddingBottom: 24, paddingTop: 2 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4
  },
  sectionTitleInline: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700"
  },
  sectionAction: {
    color: APP_LIME,
    fontSize: 14,
    fontWeight: "600"
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4
  },
  sectionTitleSpaced: { marginTop: 6 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10
  },
  userRowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  rowActionBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  userMeta: { flex: 1, minWidth: 0 },
  userPrimary: { color: TEXT, fontSize: 15, fontWeight: "700" },
  userPrimaryMatch: { color: APP_LIME, fontWeight: "800" },
  userSecondary: { color: MUTED, fontSize: 14, marginTop: 1, fontWeight: "400" },
  userSecondaryMatch: { color: TEXT, fontWeight: "600" },
  followBtn: {
    minWidth: 96,
    height: 32,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  followBtnMuted: {
    backgroundColor: SEARCH_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ROW_BORDER
  },
  followBtnText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700"
  },
  followBtnTextMuted: {
    color: TEXT
  },
  gridList: { paddingBottom: 16 },
  gridListEmpty: { flexGrow: 1, paddingBottom: 16 },
  exploreEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 10
  },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridTile: { overflow: "hidden", position: "relative" },
  gridImage: { width: "100%", height: "100%" },
  gridPlaceholder: { backgroundColor: SEARCH_BG },
  gridPlayBadge: {
    position: "absolute",
    top: 8,
    right: 8
  },
  gridVideoIcon: { width: 20, height: 20 }
});
