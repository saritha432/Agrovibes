import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { APP_BLACK, APP_LIME, APP_TEXT } from "../../../theme/appColors";
import { getActiveMarketAds, type MarketAd } from "../marketAdsConfig";

const BANNER_W = 326;
const BANNER_H = 142;
const BANNER_RADIUS = 19.76;
const LIGHT_CARD_BG = "#EDEDED";
const DARK_CARD_BG = "#303132";

function CardGrid({ light }: { light?: boolean }) {
  return (
    <View style={[styles.gridOverlay, light ? styles.gridOverlayLight : styles.gridOverlayDark]} pointerEvents="none">
      {Array.from({ length: 4 }).map((_, row) => (
        <View key={`r-${row}`} style={styles.gridRow}>
          {Array.from({ length: 8 }).map((__, col) => (
            <View
              key={`c-${col}`}
              style={[styles.gridCell, light ? styles.gridCellLight : styles.gridCellDark]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function AdStripCopy({ ad, variant }: { ad: MarketAd; variant: "light" | "dark" }) {
  const isDark = variant === "dark";
  return (
    <View style={styles.cardInner}>
      <Text style={isDark ? styles.darkTitleLine : styles.lightTitleLine}>{ad.title}</Text>
      {ad.titleAccent ? (
        <Text style={isDark ? styles.darkTitleAccentLine : styles.lightTitleAccentLine}>{ad.titleAccent}</Text>
      ) : null}
      <Text style={isDark ? styles.darkSubtitle : styles.lightSubtitle} numberOfLines={1}>
        {ad.subtitle}
      </Text>
    </View>
  );
}

type MarketListingInlineAdProps = {
  adIndex: number;
  width: number;
  onPress?: () => void;
};

export function MarketListingInlineAd({ adIndex, width, onPress }: MarketListingInlineAdProps) {
  const ads = useMemo(() => getActiveMarketAds(), []);
  const ad = ads[adIndex % Math.max(ads.length, 1)];
  const variant = adIndex % 2 === 0 ? "light" : "dark";
  const height = Math.round((width / BANNER_W) * BANNER_H);

  if (!ad) return null;

  const cardStyle = [styles.card, variant === "light" ? styles.cardLight : styles.cardDark, { width, height, borderRadius: BANNER_RADIUS }];

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.wrap}>
      <View style={cardStyle}>
        <CardGrid light={variant === "light"} />
        {variant === "light" ? (
          <>
            <LinearGradient
              colors={["rgba(201, 255, 53, 0.32)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 0.9 }}
              style={styles.lightGlowTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["transparent", "rgba(201, 255, 53, 0.26)"]}
              start={{ x: 0.4, y: 0.2 }}
              end={{ x: 1, y: 1 }}
              style={styles.lightGlowBottom}
              pointerEvents="none"
            />
          </>
        ) : (
          <LinearGradient
            colors={["transparent", "rgba(74, 100, 30, 0.5)", "rgba(201, 255, 53, 0.2)"]}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 1, y: 0.8 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        )}
        <AdStripCopy ad={ad} variant={variant} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8
  },
  card: {
    overflow: "hidden",
    opacity: 1
  },
  cardLight: {
    backgroundColor: LIGHT_CARD_BG
  },
  cardDark: {
    backgroundColor: DARK_CARD_BG
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 14,
    justifyContent: "center"
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  gridOverlayLight: {
    opacity: 0.4
  },
  gridOverlayDark: {
    opacity: 0.22
  },
  gridRow: {
    flex: 1,
    flexDirection: "row"
  },
  gridCell: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth
  },
  gridCellLight: {
    borderColor: "rgba(0, 0, 0, 0.07)"
  },
  gridCellDark: {
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  lightGlowTop: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "58%",
    height: "72%"
  },
  lightGlowBottom: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "52%",
    height: "58%"
  },
  lightTitleLine: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: APP_BLACK
  },
  lightTitleAccentLine: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: APP_BLACK
  },
  lightSubtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: APP_BLACK
  },
  darkTitleLine: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: APP_TEXT
  },
  darkTitleAccentLine: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: APP_LIME
  },
  darkSubtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: APP_TEXT
  }
});
