import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { APP_LIME, APP_TEXT } from "../../../theme/appColors";
import type { CategoryGridItem } from "../all/marketAllConfig";
import { MarketCardArt } from "./marketAssetUtils";

const MARKET_TILE_BG = "#303132";

type MarketCategorySectionProps = {
  title: string;
  items: CategoryGridItem[];
  columns: 2 | 3 | 4;
  tileWidth?: number;
  tileHeight?: number;
  light?: boolean;
  onPress: (id: string) => void;
};

function chunkItems<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

function CategoryTile({
  item,
  columns,
  light,
  cardW,
  fixedTileW,
  fixedTileH,
  onPress
}: {
  item: CategoryGridItem;
  columns: 2 | 3 | 4;
  light?: boolean;
  cardW: number;
  fixedTileW?: number;
  fixedTileH?: number;
  onPress: () => void;
}) {
  const [tileW, setTileW] = useState(fixedTileW ?? 0);
  const resolvedW = fixedTileW ?? cardW;
  const tileH = fixedTileH ?? Math.round(resolvedW * (columns === 2 ? 1.08 : 1.02));
  const artH = fixedTileH ? fixedTileH - 46 : Math.max(52, Math.round(tileH * 0.52));
  const artW = item.artWidth ?? (fixedTileW ?? (tileW > 0 ? tileW : resolvedW));

  return (
    <Pressable
      style={[
        styles.tile,
        light ? styles.tileLight : null,
        fixedTileW
          ? { width: fixedTileW, height: fixedTileH ?? tileH }
          : { width: cardW, height: tileH }
      ]}
      onPress={onPress}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== tileW) setTileW(w);
      }}
    >
      <Text style={[styles.label, light ? styles.labelLight : null]} numberOfLines={2}>
        {item.label}
      </Text>
      <View
        style={[
          styles.artStrip,
          { height: artH },
          item.artWidth && item.artHeight ? styles.artStripCentered : null
        ]}
      >
        {item.icon ? (
          <MarketCardArt
            image={item.icon}
            kind={item.artKind ?? "png"}
            width={artW}
            height={item.artHeight ?? artH}
            fit={item.artWidth && item.artHeight ? "contain" : "cover"}
            fallbackIcon={item.fallbackIcon}
          />
        ) : (
          <View style={styles.artFallback}>
            <Ionicons
              name={item.fallbackIcon ?? "grid-outline"}
              size={28}
              color={light ? "#3d6b12" : APP_LIME}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function MarketCategorySection({
  title,
  items,
  columns,
  tileWidth,
  tileHeight,
  light,
  onPress
}: MarketCategorySectionProps) {
  const { width } = useWindowDimensions();
  const gap = 8;
  const shellPad = 14;
  const outerPad = 16;
  const usable = width - outerPad * 2 - shellPad * 2;
  const cardW = Math.floor((usable - gap * (columns - 1)) / columns);
  const rows = chunkItems(items, columns);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, light ? styles.sectionTitleLight : null]}>{title}</Text>
      {rows.map((rowItems, rowIndex) => {
        const tileW = tileWidth ?? cardW;
        const rowContentW = rowItems.length * tileW + gap * Math.max(0, rowItems.length - 1);

        return (
          <ScrollView
            key={`row-${rowIndex}`}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={[styles.rowScroll, rowIndex < rows.length - 1 ? styles.gridRowSpaced : null]}
            contentContainerStyle={[styles.gridRow, { minWidth: rowContentW }]}
          >
            {rowItems.map((item) => (
              <CategoryTile
                key={item.id}
                item={item}
                columns={columns}
                light={light}
                cardW={cardW}
                fixedTileW={tileWidth}
                fixedTileH={tileHeight}
                onPress={() => onPress(item.id)}
              />
            ))}
          </ScrollView>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 18
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: "700",
    color: APP_TEXT,
    letterSpacing: 0.1
  },
  sectionTitleLight: {
    color: "#1a1a1a"
  },
  rowScroll: {
    width: "100%",
    overflow: "hidden"
  },
  gridRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
    alignItems: "flex-start"
  },
  gridRowSpaced: {
    marginBottom: 8
  },
  tile: {
    backgroundColor: MARKET_TILE_BG,
    borderRadius: 12,
    paddingTop: 10,
    overflow: "hidden",
    justifyContent: "space-between",
    flexShrink: 0
  },
  tileLight: {
    backgroundColor: MARKET_TILE_BG
  },
  label: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "600",
    color: APP_TEXT,
    textAlign: "center",
    paddingHorizontal: 6,
    minHeight: 28
  },
  labelLight: {
    color: APP_TEXT
  },
  artStrip: {
    width: "100%",
    overflow: "hidden",
    alignSelf: "flex-end"
  },
  artStripCentered: {
    alignItems: "center",
    justifyContent: "center"
  },
  artFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.15)"
  }
});
