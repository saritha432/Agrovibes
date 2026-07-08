import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { useAuth } from "../auth/AuthContext";
import { fetchHomePosts, type HomePost } from "../services/api";
import { ReelGridTile } from "../components/ReelGridTile";
import { PostsReelViewerModal } from "../components/PostsReelViewerModal";

const CARD = "#303132";
const CARD_ALT = "#383b3f";
const DIVIDER = "rgba(255,255,255,0.08)";
const CHIP_BG = "#2e3237";
const DATE_OPTIONS = ["all", "week", "month", "year"] as const;
type DateFilter = (typeof DATE_OPTIONS)[number];

function dismissedPostsStorageKey(userId: string | number | undefined) {
  if (userId != null && String(userId).trim() !== "") return `agrovibes.feed.dismissedPosts.v1.${userId}`;
  return "agrovibes.feed.dismissedPosts.v1.anon";
}

export function YourActivityInterestedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HomePost[]>([]);
  const [sortByNewest, setSortByNewest] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [viewer, setViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);
  const [selectMode, setSelectMode] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const load = async () => {
        if (!token) {
          setItems([]);
          return;
        }
        setLoading(true);
        try {
          const [feed, dismissedRaw] = await Promise.all([fetchHomePosts(token), AsyncStorage.getItem(dismissedPostsStorageKey(user?.id))]);
          if (!mounted) return;
          const dismissedIds = new Set<number>(
            (() => {
              try {
                const parsed = JSON.parse(dismissedRaw || "[]") as Array<number | string>;
                return (Array.isArray(parsed) ? parsed : []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
              } catch {
                return [];
              }
            })()
          );
          setItems((feed.posts || []).filter((p) => !dismissedIds.has(p.id)));
        } catch {
          if (mounted) setItems([]);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, [token, user?.id])
  );

  const tileSize = useMemo(() => Math.floor((width - 2) / 3), [width]);
  const filtered = useMemo(() => {
    const now = Date.now();
    const dateFiltered = items.filter((post) => {
      if (dateFilter === "all") return true;
      const ms = Date.parse(String(post.createdAt || ""));
      if (!Number.isFinite(ms)) return false;
      const age = now - ms;
      if (dateFilter === "week") return age <= 7 * 24 * 60 * 60 * 1000;
      if (dateFilter === "month") return age <= 30 * 24 * 60 * 60 * 1000;
      return age <= 365 * 24 * 60 * 60 * 1000;
    });
    return [...dateFiltered].sort((a, b) => {
      const at = Date.parse(String(a.createdAt || "")) || 0;
      const bt = Date.parse(String(b.createdAt || "")) || 0;
      return sortByNewest ? bt - at : at - bt;
    });
  }, [dateFilter, items, sortByNewest]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={APP_LIME} /></Pressable>
        <Text style={styles.topTitle}>Interested</Text>
        <Pressable style={styles.selectBtn} onPress={() => setSelectMode((v) => !v)}><Text style={styles.selectBtnText}>{selectMode ? "Done" : "Select"}</Text></Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersBarContent} style={styles.filtersBar}>
        <FilterChip label={sortByNewest ? "Newest to oldest" : "Oldest to newest"} onPress={() => setSortByNewest((v) => !v)} />
        <FilterChip
          label={dateFilter === "all" ? "All dates" : dateFilter === "week" ? "Past week" : dateFilter === "month" ? "Past month" : "Past year"}
          onPress={() => setDateFilter(DATE_OPTIONS[(DATE_OPTIONS.indexOf(dateFilter) + 1) % DATE_OPTIONS.length])}
        />
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <View style={styles.loadingWrap}><ActivityIndicator color={APP_LIME} /></View> : null}
        {!loading && filtered.length === 0 ? <View style={styles.emptyWrap}><Text style={styles.emptyText}>No interested content found.</Text></View> : null}
        <View style={styles.grid}>
          {filtered.map((item, index) => (
            <ReelGridTile key={item.id} post={item} width={tileSize} height={tileSize} backgroundColor={index % 2 === 0 ? CARD : CARD_ALT} onPress={() => !selectMode && setViewer({ posts: filtered, initialIndex: index })} />
          ))}
        </View>
      </ScrollView>

      <PostsReelViewerModal visible={!!viewer} posts={viewer?.posts ?? []} initialIndex={viewer?.initialIndex ?? 0} onClose={() => setViewer(null)} onPostsChange={() => {}} />
    </SafeAreaView>
  );
}

function FilterChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.filterChip} onPress={onPress}>
      <Text style={styles.filterChipText} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={APP_TEXT_MUTED} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  topBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "700" },
  selectBtn: { minWidth: 52, height: 26, borderRadius: 6, backgroundColor: "rgba(201,255,53,0.15)", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  selectBtnText: { color: APP_LIME, fontSize: 11, fontWeight: "700" },
  filtersBar: { backgroundColor: "#2b2d31", borderTopWidth: 1, borderBottomWidth: 1, borderColor: DIVIDER, height: 48, maxHeight: 48 },
  filtersBarContent: { gap: 8, paddingHorizontal: 8, paddingVertical: 7, alignItems: "center" },
  filterChip: { minWidth: 124, minHeight: 30, borderRadius: 6, backgroundColor: CHIP_BG, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  filterChipText: { color: APP_TEXT, fontSize: 12 },
  content: { paddingBottom: 24 },
  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 26 },
  emptyText: { color: APP_TEXT, opacity: 0.7, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", width: "100%" }
});
