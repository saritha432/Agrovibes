import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import {
  GOV_SCHEME_CATEGORIES,
  GOV_SCHEMES,
  formatSchemeDeadline,
  isSchemeLikelyRelevant,
  searchGovSchemes,
  type GovScheme,
  type GovSchemeCategory
} from "../../data/govSchemes";
import { useLanguage } from "../../localization/LanguageContext";
import { useAndroidScreenBack } from "../../navigation/useAndroidScreenBack";
import { APP_DARK_BG, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { SchemeDetailView } from "./SchemeDetailScreen";
import { readSavedSchemeIds } from "./schemeStore";

type TabId = "relevant" | "browse" | "mine";

export function SchemesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabId>("relevant");
  const [filter, setFilter] = useState<GovSchemeCategory | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<GovScheme | null>(null);

  const onBack = useCallback(() => {
    if (selected) {
      setSelected(null);
      return true;
    }
    navigation.goBack();
    return true;
  }, [navigation, selected]);

  useAndroidScreenBack(onBack);

  useEffect(() => {
    void readSavedSchemeIds().then(setSavedIds);
  }, [selected]);

  const rows = useMemo(() => {
    let list = GOV_SCHEMES;
    if (tab === "relevant") {
      list = list.filter((row) => isSchemeLikelyRelevant(row, user?.locationLabel));
    } else if (tab === "mine") {
      const saved = new Set(savedIds);
      list = list.filter((row) => saved.has(row.id));
    }
    if (filter !== "all") list = list.filter((row) => row.category === filter);
    return searchGovSchemes(query, list);
  }, [filter, query, savedIds, tab, user?.locationLabel]);

  const openDetails = useCallback((scheme: GovScheme) => {
    setSelected(scheme);
  }, []);

  if (selected) {
    return <SchemeDetailView scheme={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.searchRow}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </Pressable>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={APP_TEXT_MUTED} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("schemesSearchPlaceholder")}
            placeholderTextColor={APP_TEXT_MUTED}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
        <Pressable
          style={styles.filterBtn}
          onPress={() => setFilterOpen(true)}
          accessibilityLabel={t("schemesFilter")}
        >
          <Ionicons name="funnel-outline" size={18} color={APP_TEXT} />
        </Pressable>
      </View>

      <Text style={styles.title}>{t("schemesTitle")}</Text>
      <Text style={styles.disclaimer}>{t("schemesDisclaimer")}</Text>

      <View style={styles.tabs}>
        {(
          [
            ["relevant", t("schemesTabRelevant")],
            ["browse", t("schemesTabBrowse")],
            ["mine", t("schemesTabMine")]
          ] as const
        ).map(([id, label]) => {
          const active = tab === id;
          return (
            <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, active ? styles.tabActive : null]}>
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {rows.length === 0 ? (
          <Text style={styles.empty}>
            {tab === "mine" && !query.trim() ? t("schemesSavedEmpty") : t("schemesEmpty")}
          </Text>
        ) : (
          rows.map((scheme) => (
            <Pressable key={scheme.id} style={styles.card} onPress={() => openDetails(scheme)}>
              <View style={styles.cardHead}>
                <Text style={styles.cardName}>{scheme.name}</Text>
                {isSchemeLikelyRelevant(scheme, user?.locationLabel) ? (
                  <View style={styles.badge}>
                    <Ionicons name="sparkles-outline" size={12} color={APP_TEXT_ON_LIME} />
                    <Text style={styles.badgeText}>{t("schemesLikelyRelevant")}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardSummary}>{scheme.summary}</Text>
              <Text style={styles.cardMeta}>{formatSchemeDeadline(scheme)}</Text>
              <View style={styles.viewBtn}>
                <Text style={styles.viewText}>{t("schemesViewDetails")}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t("schemesFilter")}</Text>
            {GOV_SCHEME_CATEGORIES.map((cat) => {
              const active = filter === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.filterRow, active ? styles.filterRowActive : null]}
                  onPress={() => {
                    setFilter(cat.id);
                    setFilterOpen(false);
                  }}
                >
                  <Text style={[styles.filterRowText, active ? styles.filterRowTextActive : null]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APP_DARK_BG },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 8
  },
  backBtn: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  searchWrap: {
    flex: 1,
    backgroundColor: APP_SURFACE,
    borderRadius: 22,
    paddingHorizontal: 14,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: { flex: 1, color: APP_TEXT, fontSize: 15, paddingVertical: 10 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_SURFACE,
    alignItems: "center",
    justifyContent: "center"
  },
  title: { fontSize: 26, fontWeight: "800", color: APP_TEXT, paddingHorizontal: 16, marginTop: 6 },
  disclaimer: { color: APP_TEXT_MUTED, fontSize: 13, lineHeight: 18, paddingHorizontal: 16, marginTop: 6, marginBottom: 12 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: APP_SURFACE },
  tabActive: { backgroundColor: APP_LIME },
  tabText: { color: APP_TEXT_MUTED, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: APP_TEXT_ON_LIME },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  empty: { color: APP_TEXT_MUTED, fontSize: 14, paddingTop: 24, textAlign: "center" },
  card: { backgroundColor: APP_SURFACE, borderRadius: 16, padding: 16 },
  cardHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  cardName: { fontSize: 17, fontWeight: "800", color: APP_TEXT, flexShrink: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: APP_LIME,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  badgeText: { color: APP_TEXT_ON_LIME, fontSize: 11, fontWeight: "700" },
  cardSummary: { color: APP_TEXT_MUTED, fontSize: 14, lineHeight: 20 },
  cardMeta: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 10 },
  viewBtn: { alignSelf: "flex-end", marginTop: 10 },
  viewText: { color: APP_LIME, fontWeight: "700", fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: APP_SURFACE,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 28
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: APP_TEXT, marginBottom: 8 },
  filterRow: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  filterRowActive: { backgroundColor: APP_DARK_BG },
  filterRowText: { color: APP_TEXT, fontSize: 15 },
  filterRowTextActive: { fontWeight: "700", color: APP_LIME }
});
