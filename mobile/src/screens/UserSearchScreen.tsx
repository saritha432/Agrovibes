import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { PostsReelViewerModal } from "../components/PostsReelViewerModal";
import { UserAvatar } from "../components/UserAvatar";
import { formatDisplayName } from "../localization/feedDisplay";
import { useLanguage } from "../localization/LanguageContext";
import { navigateToMyProfile, navigateToPublicProfile } from "../navigation/navigationRef";
import { fetchHomePosts, fetchUsers, type HomePost } from "../services/api";
import { getLocalFollowNetworkByIdentity } from "../social/localFollowStore";
import { APP_LIME } from "../theme/appColors";
import { isReelPost, reelGridStillUri, reelGridTileBackground } from "../utils/reelGrid";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";
import { ResizeMode, Video } from "expo-av";

const GRID_GAP = 2;
const GRID_PAD = 2;
const BG = "#121212";
const SEARCH_BG = "#303132";
const ROW_BORDER = "#2a2a2a";
const MUTED = "#9e9e9e";
const TEXT = "#ffffff";

const EXPLORE_ASSETS = {
  search: require("../../assets/searchY-icon.svg"),
  video: require("../../assets/video-icon.svg")
} as const;

type SearchUser = {
  id?: number;
  key?: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
};

function tileBackground(index: number) {
  return reelGridTileBackground(index, 3);
}

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function UserSearchScreen() {
  const { width } = useWindowDimensions();
  const { t, language } = useLanguage();
  const { token, user } = useAuth();

  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [reelViewer, setReelViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);

  const gridTileSize = (width - GRID_PAD * 2 - GRID_GAP * 2) / 3;
  const reelTileHeight = Math.round(gridTileSize * (16 / 9));

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

  const loadExploreReels = useCallback(async () => {
    setLoadingReels(true);
    try {
      const data = await fetchHomePosts(token);
      setPosts((data.posts || []).filter(isReelPost));
    } catch {
      setPosts([]);
    } finally {
      setLoadingReels(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadExploreReels();
    }, [loadExploreReels])
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

  const exploreReels = useMemo(() => posts, [posts]);

  const openReelViewer = useCallback(
    (post: HomePost) => {
      const index = exploreReels.findIndex((p) => p.id === post.id);
      setReelViewer({ posts: exploreReels, initialIndex: index >= 0 ? index : 0 });
    },
    [exploreReels]
  );

  const openUserProfile = useCallback(
    (person: SearchUser) => {
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

  const renderGridItem = useCallback(
    ({ item, index }: { item: HomePost; index: number }) => {
      const stillUri = reelGridStillUri(item);
      const tileBg = tileBackground(index);
      const tileStyle = [
        styles.gridTile,
        { width: gridTileSize, height: reelTileHeight, backgroundColor: tileBg }
      ];

      return (
        <Pressable style={tileStyle} onPress={() => openReelViewer(item)}>
          {stillUri ? (
            <Image source={{ uri: stillUri }} style={styles.gridImage} resizeMode="cover" />
          ) : item.videoUrl ? (
            <Video
              style={styles.gridImage}
              source={{ uri: videoPlaybackUrl(item.videoUrl) }}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isLooping
              isMuted
              useNativeControls={false}
            />
          ) : null}
          <View style={styles.gridVideoBadge} pointerEvents="none">
            <Image source={EXPLORE_ASSETS.video} style={styles.gridVideoIcon} resizeMode="contain" />
          </View>
        </Pressable>
      );
    },
    [gridTileSize, openReelViewer, reelTileHeight]
  );

  const renderUserRow = useCallback(
    ({ item }: { item: SearchUser }) => {
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
              {handle || displayName}
            </Text>
            {handle ? (
              <Text style={styles.userSub} numberOfLines={1}>
                {displayName}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={MUTED} />
        </Pressable>
      );
    },
    [language, openUserProfile, t]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.searchWrap}>
        <Image source={EXPLORE_ASSETS.search} style={styles.searchIcon} resizeMode="contain" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchUsers")}
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
            data={users}
            keyExtractor={(item) => `${item.key || item.id || item.name}`}
            renderItem={renderUserRow}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.userList}
          />
        )
      ) : loadingReels ? (
        <View style={styles.centered}>
          <ActivityIndicator color={APP_LIME} />
        </View>
      ) : exploreReels.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>{t("emptyReelsTitle")}</Text>
          <Text style={styles.emptySub}>{t("emptyReelsSub")}</Text>
        </View>
      ) : (
        <FlatList
          data={exploreReels}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          renderItem={renderGridItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={styles.gridRow}
        />
      )}

      <PostsReelViewerModal
        visible={!!reelViewer}
        posts={reelViewer?.posts ?? []}
        initialIndex={reelViewer?.initialIndex ?? 0}
        onClose={() => setReelViewer(null)}
        onPostsChange={(nextPosts) => {
          setPosts(nextPosts);
          setReelViewer((current) => {
            if (!current) return current;
            if (!nextPosts.length) return null;
            return {
              posts: nextPosts,
              initialIndex: Math.min(current.initialIndex, nextPosts.length - 1)
            };
          });
        }}
      />
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
  searchIcon: { width: 20, height: 20 },
  input: { flex: 1, color: TEXT, fontSize: 15, paddingVertical: 0 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptySub: { color: MUTED, fontSize: 14, textAlign: "center", marginTop: 8 },
  userList: { paddingBottom: 16 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ROW_BORDER
  },
  userMeta: { flex: 1, minWidth: 0 },
  userName: { color: TEXT, fontSize: 15, fontWeight: "700" },
  userSub: { color: MUTED, fontSize: 13, marginTop: 2, fontWeight: "500" },
  gridList: { paddingHorizontal: GRID_PAD, paddingBottom: 16 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridTile: {
    overflow: "hidden",
    position: "relative"
  },
  gridImage: { width: "100%", height: "100%" },
  gridVideoBadge: {
    position: "absolute",
    top: 8,
    right: 8
  },
  gridVideoIcon: {
    width: 20,
    height: 20
  }
});
