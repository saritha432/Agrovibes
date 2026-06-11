import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { APP_LIME, APP_TEXT } from "../../../theme/appColors";
import { formatFilterChipLabel, filterHasValue, type FilterSelectionValue } from "./marketFilterOptions";

const FILTER_CHIP_BORDER = "rgba(255, 255, 255, 0.22)";
const TILE_BG = "#303132";
const FILTER_ICON = require("../../../../assets/market/filter-icon.png");

type MarketCategoryFilterBarProps = {
  filters: string[];
  selectedByFilter: Record<string, FilterSelectionValue | undefined>;
  onOpenSheet: (focusFilter?: string) => void;
};

export function MarketCategoryFilterBar({
  filters,
  selectedByFilter,
  onOpenSheet
}: MarketCategoryFilterBarProps) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          style={styles.filterIconBtn}
          accessibilityLabel="Open filters"
          onPress={() => onOpenSheet()}
        >
          <Image source={FILTER_ICON} style={styles.filterIcon} resizeMode="contain" />
        </Pressable>
        {filters.map((label) => {
          const selectedValue = selectedByFilter[label];
          const isActive = filterHasValue(selectedValue);
          const chipLabel = formatFilterChipLabel(label, selectedValue);

          return (
            <Pressable
              key={label}
              style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
              accessibilityLabel={`Filter by ${label}`}
              onPress={() => onOpenSheet(label)}
            >
              <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]}>
                {chipLabel}
              </Text>
              <Ionicons name="chevron-down" size={12} color={isActive ? APP_LIME : APP_TEXT} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 2
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  filterIconBtn: {
    width: 40,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FILTER_CHIP_BORDER,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  filterIcon: {
    width: 18,
    height: 18
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FILTER_CHIP_BORDER,
    backgroundColor: "transparent",
    flexShrink: 0
  },
  filterChipActive: {
    backgroundColor: TILE_BG,
    borderColor: "rgba(201, 255, 53, 0.35)"
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: APP_TEXT
  },
  filterChipTextActive: {
    color: APP_LIME,
    fontWeight: "600"
  }
});
