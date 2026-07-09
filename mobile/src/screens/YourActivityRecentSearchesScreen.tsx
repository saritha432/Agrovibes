import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { RECENT_SEARCHES_STORAGE_KEY } from "../utils/searchHistorySettings";

const DIVIDER = "rgba(255,255,255,0.08)";
const CHIP_BG = "#2e3237";

type SearchEntry = { query: string; at?: string };
type SortBy = "newest" | "oldest";
type DateFilter = "all" | "week" | "month" | "year";
const DATE_OPTIONS: DateFilter[] = ["all", "week", "month", "year"];

export function YourActivityRecentSearchesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<SearchEntry[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const load = async () => {
        try {
          const raw = await AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
          if (!mounted) return;
          if (!raw) {
            setItems([]);
            return;
          }
          const parsed = JSON.parse(raw) as Array<{ query?: string; at?: string } | string>;
          const normalized = (Array.isArray(parsed) ? parsed : [])
            .map((entry) => (typeof entry === "string" ? { query: entry } : { query: String(entry?.query || ""), at: entry?.at }))
            .filter((entry) => entry.query.trim().length > 0);
          setItems(normalized);
        } catch {
          if (mounted) setItems([]);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const dateFiltered = items.filter((item) => {
      if (dateFilter === "all" || !item.at) return true;
      const ms = Date.parse(item.at);
      if (!Number.isFinite(ms)) return true;
      const age = now - ms;
      if (dateFilter === "week") return age <= 7 * 24 * 60 * 60 * 1000;
      if (dateFilter === "month") return age <= 30 * 24 * 60 * 60 * 1000;
      return age <= 365 * 24 * 60 * 60 * 1000;
    });
    return [...dateFiltered].sort((a, b) => {
      const at = Date.parse(String(a.at || "")) || 0;
      const bt = Date.parse(String(b.at || "")) || 0;
      return sortBy === "newest" ? bt - at : at - bt;
    });
  }, [dateFilter, items, sortBy]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Recent Searchs</Text>
        <Pressable style={styles.plusBtn}>
          <Ionicons name="add-circle-outline" size={20} color="rgba(255,255,255,0.24)" />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersBarContent} style={styles.filtersBar}>
        <FilterChip label={sortBy === "newest" ? "Newest to oldest" : "Oldest to newest"} onPress={() => setSortBy((v) => (v === "newest" ? "oldest" : "newest"))} />
        <FilterChip
          label={dateFilter === "all" ? "All dates" : dateFilter === "week" ? "Past week" : dateFilter === "month" ? "Past month" : "Past year"}
          onPress={() => setDateFilter(DATE_OPTIONS[(DATE_OPTIONS.indexOf(dateFilter) + 1) % DATE_OPTIONS.length])}
        />
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No recent searches found.</Text>
          </View>
        ) : (
          filtered.map((entry, index) => (
            <View key={`${entry.query}-${entry.at || index}`} style={styles.row}>
              <Ionicons name="search-outline" size={18} color={APP_LIME} />
              <Text style={styles.rowText}>{entry.query}</Text>
            </View>
          ))
        )}
      </ScrollView>
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
  plusBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  filtersBar: { backgroundColor: "#2b2d31", borderTopWidth: 1, borderBottomWidth: 1, borderColor: DIVIDER, height: 48, maxHeight: 48 },
  filtersBarContent: { gap: 8, paddingHorizontal: 8, paddingVertical: 7, alignItems: "center" },
  filterChip: { minWidth: 124, minHeight: 30, borderRadius: 6, backgroundColor: CHIP_BG, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  filterChipText: { color: APP_TEXT, fontSize: 12 },
  content: { paddingBottom: 24 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 26 },
  emptyText: { color: APP_TEXT, opacity: 0.7, fontSize: 13 },
  row: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    paddingHorizontal: 14
  },
  rowText: { color: APP_TEXT, fontSize: 15, fontWeight: "500" }
});
