import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { PostsReelViewerModal } from "../components/PostsReelViewerModal";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fetchHomePosts, type HomePost } from "../services/api";
import { socialDiscoveryTheme as T } from "../theme/socialDiscoveryTheme";
import { useLanguage } from "../localization/LanguageContext";
import { isReelPost, postMatchesExploreQuery, reelGridStillUri } from "../utils/reelGrid";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";
import { ResizeMode, Video } from "expo-av";

const GRID_GAP = 2;
const GRID_PAD = 2;

export function UserSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const { t } = useLanguage();
  const { token } = useAuth();

  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [reelViewer, setReelViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);

  const gridTileSize = (width - GRID_PAD * 2 - GRID_GAP * 2) / 3;
  const reelTileHeight = Math.round(gridTileSize * (16 / 9));

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("search") });
  }, [navigation, t]);

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

  const loadExploreReels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHomePosts(token);
      setPosts((data.posts || []).filter(isReelPost));
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadExploreReels();
    }, [loadExploreReels])
  );

  const trimmedQuery = query.trim();
  const visibleReels = useMemo(
    () => posts.filter((post) => postMatchesExploreQuery(post, trimmedQuery)),
    [posts, trimmedQuery]
  );

  const openReelViewer = useCallback(
    (post: HomePost) => {
      const index = visibleReels.findIndex((p) => p.id === post.id);
      setReelViewer({ posts: visibleReels, initialIndex: index >= 0 ? index : 0 });
    },
    [visibleReels]
  );

  const renderGridItem = useCallback(
    ({ item }: { item: HomePost }) => {
      const stillUri = reelGridStillUri(item);
      const tileStyle = [styles.gridTile, { width: gridTileSize, height: reelTileHeight }];

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
          ) : (
            <View style={[styles.gridImage, styles.gridPlaceholder]} />
          )}
          <View style={styles.gridPlayBadge} pointerEvents="none">
            <Ionicons name="play" size={12} color="#111" />
          </View>
        </Pressable>
      );
    },
    [gridTileSize, openReelViewer, reelTileHeight]
  );

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <Image source={require("../../assets/search.png")} style={styles.searchIcon} resizeMode="contain" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("search")}
          placeholderTextColor={T.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable hitSlop={8} onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={T.muted} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={T.accent} />
        </View>
      ) : visibleReels.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>{trimmedQuery ? t("emptyNothingTitle") : t("emptyReelsTitle")}</Text>
          {!trimmedQuery ? <Text style={styles.emptySub}>{t("emptyReelsSub")}</Text> : null}
        </View>
      ) : (
        <FlatList
          data={visibleReels}
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
  searchIcon: { width: 18, height: 18, tintColor: T.muted },
  input: { flex: 1, color: T.text, fontSize: 15, paddingVertical: 0 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: T.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptySub: { color: T.muted, fontSize: 14, textAlign: "center", marginTop: 8 },
  gridList: { paddingHorizontal: GRID_PAD, paddingBottom: 16 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridTile: {
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    position: "relative"
  },
  gridImage: { width: "100%", height: "100%" },
  gridPlaceholder: { backgroundColor: "#262626" },
  gridPlayBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center"
  }
});
