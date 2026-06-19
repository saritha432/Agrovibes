import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
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
import { fetchHomePosts, type HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { useLanguage } from "../localization/LanguageContext";
import { isReelPost, postMatchesExploreQuery, reelGridStillUri, reelGridTileBackground } from "../utils/reelGrid";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";
import { ResizeMode, Video } from "expo-av";

const GRID_GAP = 2;
const GRID_PAD = 2;
const BG = "#121212";
const SEARCH_BG = "#303132";
const MUTED = "#9e9e9e";
const TEXT = "#ffffff";

const EXPLORE_ASSETS = {
  search: require("../../assets/searchY-icon.svg"),
  video: require("../../assets/video-icon.svg")
} as const;

function tileBackground(index: number) {
  return reelGridTileBackground(index, 3);
}

export function UserSearchScreen() {
  const { width } = useWindowDimensions();
  const { t } = useLanguage();
  const { token } = useAuth();

  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [reelViewer, setReelViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);

  const gridTileSize = (width - GRID_PAD * 2 - GRID_GAP * 2) / 3;
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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.searchWrap}>
        <Image source={EXPLORE_ASSETS.search} style={styles.searchIcon} resizeMode="contain" />
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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={APP_LIME} />
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
