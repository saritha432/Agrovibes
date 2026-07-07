import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, ActivityIndicator } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { useAuth } from "../auth/AuthContext";
import { fetchSavedHomePosts, type HomePost } from "../services/api";
import { PostsReelViewerModal } from "../components/PostsReelViewerModal";
import { ReelGridTile } from "../components/ReelGridTile";

const CARD = "#303132";
const CARD_ALT = "#383b3f";
const DIVIDER = "rgba(255,255,255,0.08)";

type SavedTab = "All" | "Collection" | "Drops" | "Post";

const TABS: Array<{ key: SavedTab; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { key: "All", icon: "layers-outline", label: "All" },
  { key: "Collection", icon: "file-tray-stacked-outline", label: "Collection" },
  { key: "Drops", icon: "play-box-outline", label: "Drops" },
  { key: "Post", icon: "images-outline", label: "Post" }
];

export function SavedSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<SavedTab>("Post");
  const [savedPosts, setSavedPosts] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const loadSaved = async () => {
        if (!token) {
          setSavedPosts([]);
          return;
        }
        setLoading(true);
        try {
          const data = await fetchSavedHomePosts(token);
          if (!mounted) return;
          setSavedPosts(data.posts || []);
        } catch {
          if (!mounted) return;
          setSavedPosts([]);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      void loadSaved();
      return () => {
        mounted = false;
      };
    }, [token])
  );

  const tileSize = useMemo(() => Math.floor((width - 2) / 3), [width]);

  const filteredSaved = useMemo(() => {
    if (activeTab === "Drops") return savedPosts.filter((post) => !!post.videoUrl);
    if (activeTab === "Post") return savedPosts.filter((post) => !post.videoUrl);
    if (activeTab === "Collection") return savedPosts.filter((post) => !!post.imageUrl || (post.imageUrls?.length ?? 0) > 0);
    return savedPosts;
  }, [activeTab, savedPosts]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={APP_LIME} />
        </Pressable>
        <Text style={styles.title}>Saved</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.tabsWrap}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="button"
            >
              <Ionicons name={tab.icon} size={17} color={active ? APP_LIME : APP_TEXT} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.gridWrap} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={APP_LIME} />
          </View>
        ) : null}
        {!loading && filteredSaved.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No saved {activeTab === "Drops" ? "drops" : "posts"} yet.</Text>
          </View>
        ) : null}
        <View style={styles.grid}>
          {filteredSaved.map((item, index) => (
            <ReelGridTile
              key={index}
              post={item}
              width={tileSize}
              height={tileSize}
              backgroundColor={index % 2 === 0 ? CARD : CARD_ALT}
              onPress={() => setViewer({ posts: filteredSaved, initialIndex: index })}
            />
          ))}
        </View>
      </ScrollView>
      <PostsReelViewerModal
        visible={!!viewer}
        posts={viewer?.posts ?? []}
        initialIndex={viewer?.initialIndex ?? 0}
        onClose={() => setViewer(null)}
        onPostsChange={(nextPosts) =>
          setSavedPosts((prev) => {
            const updates = new Map(nextPosts.map((p) => [p.id, p]));
            return prev.map((p) => updates.get(p.id) ?? p);
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: APP_TEXT,
    fontSize: 19,
    fontWeight: "700"
  },
  tabsWrap: {
    flexDirection: "row",
    backgroundColor: "#2c2f33",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: DIVIDER,
    height: 48
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1
  },
  tabBtnActive: {
    backgroundColor: "#31353a"
  },
  tabLabel: {
    color: APP_TEXT,
    fontSize: 11
  },
  tabLabelActive: {
    color: APP_LIME,
    fontWeight: "700"
  },
  gridWrap: {
    paddingBottom: 24
  },
  loadingWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24
  },
  emptyText: {
    color: APP_TEXT_MUTED,
    fontSize: 13
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%"
  }
});
