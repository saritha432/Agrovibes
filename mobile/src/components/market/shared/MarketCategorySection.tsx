import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { APP_LIME, APP_TEXT } from "../../../theme/appColors";

const MARKET_TILE_BG = "#303132";
import type { CategoryGridItem } from "../all/marketAllConfig";
import { MarketCardArt, MarketSvgIcon } from "./marketAssetUtils";

type MarketCategorySectionProps = {
  title: string;
  items: CategoryGridItem[];
  columns: 2 | 3 | 4;
  tileWidth?: number;
  tileHeight?: number;
  light?: boolean;
  onPress: (id: string) => void;
};

function CategoryTile({
  item,
  columns,
  light,
  singleRow,
  cardW,
  fixedTileW,
  fixedTileH,
  onPress
}: {
  item: CategoryGridItem;
  columns: 2 | 3 | 4;
  light?: boolean;
  singleRow: boolean;
  cardW: number;
  fixedTileW?: number;
  fixedTileH?: number;
  onPress: () => void;
}) {
  const [tileW, setTileW] = useState(0);
  const resolvedW = fixedTileW ?? cardW;
  const tileH = fixedTileH ?? Math.round(resolvedW * (columns === 2 ? 1.08 : 1.02));
  const artH = fixedTileH ? fixedTileH - 46 : Math.max(52, Math.round(tileH * 0.52));

  return (
    <Pressable
      style={[
        styles.tile,
        light ? styles.tileLight : null,
        fixedTileW
          ? { width: fixedTileW, height: fixedTileH ?? tileH }
          : singleRow
            ? [styles.tileFlex, { aspectRatio: columns === 2 ? 1.14 : 0.9 }]
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
          { height: singleRow && tileW > 0 ? Math.round(tileW * 0.52) : artH },
          item.artWidth && item.artHeight ? styles.artStripCentered : null
        ]}
      >
        {item.icon && tileW > 0 ? (
          <MarketCardArt
            image={item.icon}
            kind={item.artKind ?? "svg"}
            width={item.artWidth ?? tileW}
            height={item.artHeight ?? (singleRow && tileW > 0 ? Math.round(tileW * 0.52) : artH)}
            fit={item.artWidth && item.artHeight ? "contain" : "cover"}
          />
        ) : item.icon ? (
          <View style={styles.artFallback}>
            <MarketSvgIcon module={item.icon} size={32} active={false} fallbackIcon={item.fallbackIcon} />
          </View>
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
  const singleRow = items.length === columns;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, light ? styles.sectionTitleLight : null]}>{title}</Text>
      <View style={[styles.grid, singleRow ? styles.gridSingleRow : null]}>
        {items.map((item) => (
          <CategoryTile
            key={item.id}
            item={item}
            columns={columns}
            light={light}
            singleRow={singleRow}
            cardW={cardW}
            fixedTileW={tileWidth}
            fixedTileH={tileHeight}
            onPress={() => onPress(item.id)}
          />
        ))}
      </View>
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  gridSingleRow: {
    flexWrap: "nowrap",
    alignItems: "stretch"
  },
  tile: {
    backgroundColor: MARKET_TILE_BG,
    borderRadius: 12,
    paddingTop: 10,
    overflow: "hidden",
    justifyContent: "space-between"
  },
  tileFlex: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 0.88
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
