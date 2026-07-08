import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const DIVIDER = "rgba(255,255,255,0.08)";
const CHIP_BG = "#2e3237";

export function YourActivityHighlightsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={APP_LIME} /></Pressable>
        <Text style={styles.topTitle}>Highlights</Text>
        <Pressable style={styles.selectBtn}><Text style={styles.selectBtnText}>Select</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersBarContent} style={styles.filtersBar}>
        <FilterChip label="Newest to oldest" />
        <FilterChip label="All dates" />
      </ScrollView>
      <View style={styles.emptyWrap}><Text style={styles.emptyText}>No highlights yet.</Text></View>
    </SafeAreaView>
  );
}

function FilterChip({ label }: { label: string }) {
  return <View style={styles.filterChip}><Text style={styles.filterChipText}>{label}</Text><Ionicons name="chevron-down" size={14} color={APP_TEXT_MUTED} /></View>;
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
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: APP_TEXT, opacity: 0.72 }
});
