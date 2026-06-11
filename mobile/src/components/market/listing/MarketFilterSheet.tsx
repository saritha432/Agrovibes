import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_ON_LIME } from "../../../theme/appColors";
import {
  CATEGORY_TYPE_CARD_OPTIONS,
  CROP_FILTER_OPTIONS,
  filterHasValue,
  getFilterOptions,
  isOptionSelected,
  type FilterSelectionValue,
  usesCardFilterUi,
  usesMultiSelectFilter
} from "./marketFilterOptions";

const TILE_BG = "#303132";
const FILTER_ACTIVE_LEFT_BORDER = "#C9FF35";

type ViewMode = "list" | "grid";
const SHEET_FILTERS = [
  "Category Type",
  "Variety",
  "Season",
  "Crop",
  "Germination",
  "Price",
  "Seller Rating"
] as const;

function mergeSheetFilters(filters: string[]): string[] {
  const sheetSet = new Set<string>(SHEET_FILTERS);
  const ordered = SHEET_FILTERS.filter((f) => filters.includes(f));
  const rest = filters.filter((f) => !sheetSet.has(f));
  return [...ordered, ...rest];
}

type MarketFilterSheetProps = {
  visible: boolean;
  filters: string[];
  focusFilter: string;
  selectedByFilter: Record<string, FilterSelectionValue | undefined>;
  onClose: () => void;
  onApply: (selections: Record<string, FilterSelectionValue>) => void;
};

export function MarketFilterSheet({
  visible,
  filters,
  focusFilter,
  selectedByFilter,
  onClose,
  onApply
}: MarketFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sheetFilters = useMemo(() => mergeSheetFilters(filters), [filters]);
  const navW = useMemo(() => {
    const longest = sheetFilters.reduce((a, b) => (a.length >= b.length ? a : b), "");
    const textW = Math.ceil(longest.length * 7.2);
    return Math.min(132, Math.max(108, textW + 28));
  }, [sheetFilters]);
  const contentW = width - navW - 1;
  const [activeFilter, setActiveFilter] = useState(focusFilter);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [draft, setDraft] = useState<Record<string, FilterSelectionValue>>({});

  useEffect(() => {
    if (!visible) return;
    const initial: Record<string, FilterSelectionValue> = {};
    for (const [key, value] of Object.entries(selectedByFilter)) {
      if (filterHasValue(value)) initial[key] = value as FilterSelectionValue;
    }
    setDraft(initial);
    setActiveFilter(sheetFilters.includes(focusFilter) ? focusFilter : sheetFilters[0] ?? focusFilter);
  }, [visible, focusFilter, selectedByFilter, sheetFilters]);

  const cardW = contentW - 14 * 2;
  const gridChipW = Math.floor((contentW - 14 * 2 - 8) / 2);

  const selectSingleValue = (filter: string, value: string) => {
    setDraft((prev) => ({ ...prev, [filter]: value }));
  };

  const toggleMultiValue = (filter: string, value: string) => {
    setDraft((prev) => {
      const current = prev[filter];
      const selected = Array.isArray(current) ? current : current ? [current] : [];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];

      if (next.length === 0) {
        const { [filter]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [filter]: next };
    });
  };

  const clearAll = () => setDraft({});

  const apply = () => {
    onApply(draft);
    onClose();
  };

  const renderViewToggle = () => (
    <View style={styles.viewToggleRow}>
      <Pressable
        style={[styles.viewToggleBtn, viewMode === "list" ? styles.viewToggleBtnOn : null]}
        onPress={() => setViewMode("list")}
        accessibilityLabel="List view"
      >
        <Ionicons
          name="list"
          size={18}
          color={viewMode === "list" ? APP_LIME : "rgba(255,255,255,0.5)"}
        />
      </Pressable>
      <Pressable
        style={[styles.viewToggleBtn, viewMode === "grid" ? styles.viewToggleBtnOn : null]}
        onPress={() => setViewMode("grid")}
        accessibilityLabel="Grid view"
      >
        <Ionicons
          name="grid"
          size={16}
          color={viewMode === "grid" ? APP_LIME : "rgba(255,255,255,0.5)"}
        />
      </Pressable>
    </View>
  );

  const renderChip = (
    option: string,
    selected: boolean,
    onPress: () => void,
    chipWidth?: number
  ) => (
    <Pressable
      key={option}
      style={[
        styles.shopChip,
        chipWidth != null ? { width: chipWidth } : null,
        selected ? [styles.shopChipOn, chipWidth != null ? { width: chipWidth } : null] : null
      ]}
      onPress={onPress}
    >
      {selected ? <Ionicons name="checkmark" size={14} color={APP_LIME} style={styles.shopChipIcon} /> : null}
      <Text
        style={[styles.shopChipText, selected ? styles.shopChipTextOn : null]}
        numberOfLines={2}
      >
        {option}
      </Text>
    </Pressable>
  );

  const renderCardGrid = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardGrid}>
      {CATEGORY_TYPE_CARD_OPTIONS.map((option) => {
        const selected = isOptionSelected(draft[activeFilter], option.id);
        return (
          <Pressable
            key={option.id}
            style={[styles.typeCard, { width: cardW }, selected ? styles.typeCardOn : null]}
            onPress={() => selectSingleValue(activeFilter, option.id)}
          >
            <Text style={[styles.typeCardLabel, selected ? styles.typeCardLabelOn : null]}>
              {option.label}
            </Text>
            <View style={styles.typeCardArtWrap}>
              <Image source={option.image} style={styles.typeCardImage} resizeMode="contain" />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderCardList = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.chipWrap}>
      {CATEGORY_TYPE_CARD_OPTIONS.map((option) => {
        const selected = isOptionSelected(draft[activeFilter], option.id);
        return renderChip(option.label, selected, () => selectSingleValue(activeFilter, option.id));
      })}
    </ScrollView>
  );

  const renderCropOptions = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={viewMode === "grid" ? styles.chipGrid : styles.chipList}
    >
      {CROP_FILTER_OPTIONS.map((crop) => {
        const selected = isOptionSelected(draft[activeFilter], crop);
        return renderChip(
          crop,
          selected,
          () => toggleMultiValue(activeFilter, crop),
          viewMode === "grid" ? gridChipW : undefined
        );
      })}
    </ScrollView>
  );

  const renderRightPanel = () => {
    if (usesCardFilterUi(activeFilter)) {
      return viewMode === "grid" ? renderCardGrid() : renderCardList();
    }

    if (usesMultiSelectFilter(activeFilter)) {
      return renderCropOptions();
    }

    const options = getFilterOptions(activeFilter);
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={viewMode === "grid" ? styles.chipGrid : styles.chipList}
      >
        {options.map((option) => {
          const selected = isOptionSelected(draft[activeFilter], option);
          return renderChip(
            option,
            selected,
            () => selectSingleValue(activeFilter, option),
            viewMode === "grid" ? gridChipW : undefined
          );
        })}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filter</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={APP_LIME} />
            </Pressable>
          </View>
          <View style={styles.headerDivider} />

          <View style={styles.sheetBody}>
            <ScrollView
              style={[styles.navCol, { width: navW }]}
              contentContainerStyle={styles.navColContent}
              showsVerticalScrollIndicator={false}
            >
              {sheetFilters.map((label) => {
                const on = activeFilter === label;
                return (
                  <Pressable
                    key={label}
                    style={[styles.navItem, on ? styles.navItemOn : null]}
                    onPress={() => setActiveFilter(label)}
                  >
                    <Text style={[styles.navText, on ? styles.navTextOn : null]} numberOfLines={2}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.divider} />

            <View style={styles.contentCol}>
              {renderViewToggle()}
              {renderRightPanel()}
            </View>
          </View>

          <View style={styles.sheetFooter}>
            <Pressable style={styles.clearBtn} onPress={clearAll}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={apply}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.55)"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    height: "78%",
    backgroundColor: APP_BLACK,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden"
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    marginTop: 10,
    marginBottom: 6
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: APP_TEXT
  },
  headerDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: 0
  },
  sheetBody: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0
  },
  navCol: {
    paddingTop: 16
  },
  navColContent: {
    paddingLeft: 16,
    paddingRight: 6,
    gap: 20
  },
  navItem: {
    justifyContent: "center"
  },
  navItemOn: {},
  navText: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.55)",
    lineHeight: 18
  },
  navTextOn: {
    color: APP_TEXT,
    fontWeight: "500"
  },
  divider: {
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)"
  },
  contentCol: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    minWidth: 0
  },
  viewToggleRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
    marginBottom: 14
  },
  viewToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  viewToggleBtnOn: {
    backgroundColor: TILE_BG
  },
  cardGrid: {
    flexDirection: "column",
    gap: 10,
    paddingBottom: 16
  },
  typeCard: {
    backgroundColor: TILE_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 8,
    overflow: "hidden",
    minHeight: 130
  },
  typeCardOn: {
    borderColor: "rgba(201, 255, 53, 0.5)"
  },
  typeCardLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: APP_TEXT,
    marginBottom: 6
  },
  typeCardLabelOn: {
    color: APP_TEXT
  },
  typeCardArtWrap: {
    flex: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  typeCardImage: {
    width: "90%",
    height: 88
  },
  chipWrap: {
    flexDirection: "column",
    gap: 8,
    paddingBottom: 16
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 16
  },
  chipList: {
    flexDirection: "column",
    gap: 8,
    paddingBottom: 16
  },
  shopChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.22)",
    borderRightColor: "rgba(255, 255, 255, 0.22)",
    borderBottomColor: "rgba(255, 255, 255, 0.22)",
    borderLeftColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: TILE_BG
  },
  shopChipOn: {
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 5,
    borderTopColor: "rgba(255, 255, 255, 0.22)",
    borderRightColor: "rgba(255, 255, 255, 0.22)",
    borderBottomColor: "rgba(255, 255, 255, 0.22)",
    borderLeftColor: FILTER_ACTIVE_LEFT_BORDER,
    paddingLeft: 12,
    backgroundColor: "rgba(201, 255, 53, 0.14)"
  },
  shopChipIcon: {
    marginRight: 4
  },
  shopChipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
    color: APP_TEXT,
    textAlign: "center",
    flexShrink: 1
  },
  shopChipTextOn: {
    color: APP_LIME,
    fontWeight: "600"
  },
  sheetFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12
  },
  clearBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center"
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: APP_TEXT
  },
  applyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: APP_TEXT_ON_LIME
  }
});
