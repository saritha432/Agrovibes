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

export function YourActivitySharesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HomePost[]>([]);
  const [viewer, setViewer] = useState<{ posts: HomePost[]; initialIndex: number } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const load = async () => {
        if (!token) return;
        setLoading(true);
        try {
          const data = await fetchHomePosts(token);
          if (mounted) setItems(data.posts || []);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, [token])
  );

  const tileSize = useMemo(() => Math.floor((width - 2) / 3), [width]);
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={APP_LIME} /></Pressable>
        <Text style={styles.topTitle}>Shares</Text>
        <Pressable style={styles.selectBtn}><Text style={styles.selectBtnText}>Select</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersBarContent} style={styles.filtersBar}>
        <FilterChip label="Newest to oldest" onPress={() => {}} />
        <FilterChip label="All dates" onPress={() => {}} />
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={APP_LIME} style={{ marginTop: 16 }} /> : null}
        <View style={styles.grid}>
          {items.map((item, index) => (
            <ReelGridTile key={item.id} post={item} width={tileSize} height={tileSize} backgroundColor={index % 2 === 0 ? CARD : CARD_ALT} onPress={() => setViewer({ posts: items, initialIndex: index })} />
          ))}
        </View>
      </ScrollView>
      <PostsReelViewerModal visible={!!viewer} posts={viewer?.posts ?? []} initialIndex={viewer?.initialIndex ?? 0} onClose={() => setViewer(null)} onPostsChange={() => {}} />
    </SafeAreaView>
  );
}

function FilterChip({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.filterChip} onPress={onPress}><Text style={styles.filterChipText}>{label}</Text><Ionicons name="chevron-down" size={14} color={APP_TEXT_MUTED} /></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  topBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: APP_LIME, fontSize: 18, fontWeight: "700" },
  selectBtn: { minWidth: 52, height: 26, borderRadius: 6, backgroundColor: "rgba(201,255,53,0.15)", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  selectBtnText: { color: APP_LIME, fontSize: 11, fontWeight: "700" },
  filtersBar: { backgroundColor: "#2b2d31", borderTopWidth: 1, borderBottomWidth: 1, borderColor: DIVIDER, height: 48, maxHeight: 48 },
  filtersBarContent: { gap: 8, paddingHorizontal: 8, paddingVertical: 7, alignItems: "center" },
  filterChip: { minWidth: 124, minHeight: 30, borderRadius: 6, backgroundColor: CHIP_BG, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  filterChipText: { color: APP_TEXT, fontSize: 12 },
  content: { paddingBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", width: "100%" }
});
