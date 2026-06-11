import React from "react";
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { APP_LIME, APP_TEXT, APP_TEXT_ON_LIME } from "../../../../theme/appColors";

const MARKET_TILE_BG = "#303132";
const FARM_ILLUSTRATION = require("../../../../../assets/market/farm-illustration.png");

function FarmIllustration({ width }: { width: number }) {
  const artHeight = Math.round(width * (210 / 429));

  return (
    <View style={{ width, height: artHeight }} pointerEvents="none">
      <Image source={FARM_ILLUSTRATION} style={{ width, height: artHeight }} resizeMode="cover" />
    </View>
  );
}

export function MarketHeroSection({ onPress }: { onPress: () => void }) {
  const { width: windowWidth } = useWindowDimensions();

  return (
    <View style={[styles.hero, { width: windowWidth }]}>
      <View style={styles.heroHeader}>
        <View style={styles.heroTextBlock}>
          <Text style={styles.heroTitleLine}>Khet Se</Text>
          <Text style={styles.heroTitleAccentLine}>Ghar Tak</Text>
          <Text style={styles.heroSubtitle}>Bhoomi. Bazaar. Barakath.</Text>
        </View>
        <Pressable style={styles.shopBtn} onPress={onPress} accessibilityRole="button">
          <Text style={styles.shopBtnText}>Shop Now</Text>
        </Pressable>
      </View>
      <FarmIllustration width={windowWidth} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignSelf: "center",
    backgroundColor: MARKET_TILE_BG,
    overflow: "hidden",
    paddingBottom: 4
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0
  },
  heroTitleLine: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    color: APP_TEXT
  },
  heroTitleAccentLine: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    color: APP_LIME
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
    color: APP_TEXT
  },
  shopBtn: {
    marginTop: 2,
    backgroundColor: APP_LIME,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  shopBtnText: {
    color: APP_TEXT_ON_LIME,
    fontWeight: "700",
    fontSize: 13
  }
});
