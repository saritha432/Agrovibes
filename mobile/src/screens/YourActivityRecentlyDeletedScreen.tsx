import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT } from "../theme/appColors";
import { useAuth } from "../auth/AuthContext";
import {
  fetchRecentlyDeletedHomePosts,
  permanentlyDeleteHomePost,
  restoreHomePost,
  type HomePost
} from "../services/api";
import { ReelGridTile } from "../components/ReelGridTile";

const DIVIDER = "rgba(255,255,255,0.08)";
const CARD = "#303132";
const CARD_ALT = "#383b3f";

type Tab = "all" | "calendar";

function daysLeft(expiresAt?: string | null) {
  const ms = Date.parse(String(expiresAt || ""));
  if (!Number.isFinite(ms)) return "";
  const diffDays = Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
  return `${Math.max(0, diffDays)}d`;
}

export function YourActivityRecentlyDeletedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HomePost[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

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
          const data = await fetchRecentlyDeletedHomePosts(token);
          if (mounted) setItems(data.posts || []);
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
    }, [token])
  );

  const tileSize = useMemo(() => Math.floor((width - 2) / 3), [width]);
  const filtered = useMemo(() => {
    if (tab === "all") return items;
    if (!selectedDate) return [];
    return items.filter((p) => {
      const d = new Date(String(p.deletedAt || p.createdAt || ""));
      if (!Number.isFinite(d.getTime())) return false;
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return ymd === selectedDate;
    });
  }, [items, selectedDate, tab]);

  const dateOptions = useMemo(() => {
    const uniq = new Set<string>();
    items.forEach((p) => {
      const d = new Date(String(p.deletedAt || p.createdAt || ""));
      if (!Number.isFinite(d.getTime())) return;
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      uniq.add(ymd);
    });
    return Array.from(uniq).sort((a, b) => Date.parse(b) - Date.parse(a));
  }, [items]);

  const toggleSelect = (postId: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });

  const restoreSelected = async () => {
    if (!token || !selectedIds.size) return;
    setBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => restoreHomePost(token, id)));
      setItems((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch {
      Alert.alert("Restore failed", "Could not restore selected posts. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedPermanently = async () => {
    if (!token || !selectedIds.size) return;
    Alert.alert("Delete permanently?", "Selected posts will be removed forever.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await Promise.all(Array.from(selectedIds).map((id) => permanentlyDeleteHomePost(token, id)));
              setItems((prev) => prev.filter((p) => !selectedIds.has(p.id)));
              setSelectedIds(new Set());
              setSelectMode(false);
            } catch {
              Alert.alert("Delete failed", "Could not permanently delete selected posts.");
            } finally {
              setBusy(false);
            }
          })();
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Recently Deleted</Text>
        <Pressable
          style={styles.selectBtn}
          onPress={() => {
            setSelectMode((v) => !v);
            if (selectMode) setSelectedIds(new Set());
          }}
        >
          <Text style={styles.selectBtnText}>{selectMode ? "Done" : "Select"}</Text>
        </Pressable>
      </View>

      <View style={styles.tabsWrap}>
        <Pressable style={styles.tabBtn} onPress={() => setTab("all")}>
          <Ionicons name="sparkles-outline" size={16} color={tab === "all" ? APP_LIME : APP_TEXT} />
          <Text style={[styles.tabText, tab === "all" ? styles.tabTextActive : null]}>All</Text>
        </Pressable>
        <Pressable
          style={styles.tabBtn}
          onPress={() => {
            setTab("calendar");
            setShowDatePicker(true);
          }}
        >
          <Ionicons name="calendar-outline" size={16} color={tab === "calendar" ? APP_LIME : APP_TEXT} />
          <Text style={[styles.tabText, tab === "calendar" ? styles.tabTextActive : null]}>
            {selectedDate ? selectedDate : "Calendar"}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={APP_LIME} />
          </View>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No recently deleted posts.</Text>
          </View>
        ) : null}
        <View style={styles.grid}>
          {filtered.map((item, index) => {
            const selected = selectedIds.has(item.id);
            return (
              <Pressable key={item.id} onPress={() => selectMode && toggleSelect(item.id)}>
                <ReelGridTile
                  post={item}
                  width={tileSize}
                  height={tileSize}
                  backgroundColor={index % 2 === 0 ? CARD : CARD_ALT}
                  onPress={() => {
                    if (selectMode) toggleSelect(item.id);
                  }}
                />
                <View style={styles.daysBadge}>
                  <Text style={styles.daysText}>{daysLeft(item.expiresAt)}</Text>
                </View>
                {selectMode ? (
                  <View style={[styles.selectDot, selected ? styles.selectDotOn : null]}>
                    {selected ? <Ionicons name="checkmark" size={12} color={APP_BLACK} /> : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {selectMode ? (
        <View style={styles.bottomActions}>
          <Pressable style={[styles.actionBtn, busy ? styles.actionBtnDisabled : null]} disabled={busy || selectedIds.size === 0} onPress={restoreSelected}>
            <Text style={styles.actionBtnText}>Restore</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtnDanger, busy ? styles.actionBtnDisabled : null]}
            disabled={busy || selectedIds.size === 0}
            onPress={deleteSelectedPermanently}
          >
            <Text style={styles.actionBtnDangerText}>Delete Permanently</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select date</Text>
              <Pressable onPress={() => setShowDatePicker(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={APP_TEXT} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {dateOptions.map((d) => (
                <Pressable
                  key={d}
                  style={[styles.pickerOption, selectedDate === d ? styles.pickerOptionActive : null]}
                  onPress={() => {
                    setSelectedDate(d);
                    setTab("calendar");
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{d}</Text>
                </Pressable>
              ))}
              {!dateOptions.length ? <Text style={styles.pickerEmpty}>No deleted dates found.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  topBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "700" },
  selectBtn: {
    minWidth: 52,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(201,255,53,0.15)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  selectBtnText: { color: APP_LIME, fontSize: 11, fontWeight: "700" },
  tabsWrap: {
    minHeight: 52,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: DIVIDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 26
  },
  tabBtn: { alignItems: "center", justifyContent: "center", gap: 4, minWidth: 54 },
  tabText: { color: APP_TEXT, fontSize: 12, opacity: 0.8 },
  tabTextActive: { color: APP_LIME, opacity: 1, fontWeight: "700" },
  content: { paddingBottom: 24 },
  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 26 },
  emptyText: { color: APP_TEXT, opacity: 0.7, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", width: "100%" },
  daysBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  daysText: { color: APP_LIME, fontSize: 10, fontWeight: "700" },
  selectDot: {
    position: "absolute",
    left: 6,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  selectDotOn: { backgroundColor: APP_LIME, borderColor: APP_LIME },
  bottomActions: {
    borderTopWidth: 1,
    borderColor: DIVIDER,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12
  },
  actionBtn: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: APP_LIME, alignItems: "center", justifyContent: "center" },
  actionBtnText: { color: APP_BLACK, fontSize: 13, fontWeight: "700" },
  actionBtnDanger: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: "#5b2222", alignItems: "center", justifyContent: "center" },
  actionBtnDangerText: { color: "#ffd1d1", fontSize: 13, fontWeight: "700" },
  actionBtnDisabled: { opacity: 0.45 },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: 18 },
  pickerCard: { backgroundColor: "#1f2328", borderRadius: 14, borderWidth: 1, borderColor: DIVIDER, maxHeight: "70%" },
  pickerHeader: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12
  },
  pickerTitle: { color: APP_TEXT, fontSize: 14, fontWeight: "700" },
  pickerList: { paddingVertical: 8 },
  pickerOption: { minHeight: 42, paddingHorizontal: 12, alignItems: "flex-start", justifyContent: "center" },
  pickerOptionActive: { backgroundColor: "rgba(201,255,53,0.14)" },
  pickerOptionText: { color: APP_TEXT, fontSize: 13, fontWeight: "600" },
  pickerEmpty: { color: APP_TEXT, opacity: 0.72, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12 }
});
