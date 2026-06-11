import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { APP_BLACK, APP_LIME, APP_TEXT_ON_LIME } from "../../../../theme/appColors";

const LIGHT_CARD_BG = "#EDEDED";
const WELCOME_ART = require("../../../../../assets/market/freshproduce.png");

type WelcomeKisanBannerProps = {
  onPress: () => void;
  /** Full width inside listing grid — no side margins. */
  fullBleed?: boolean;
  width?: number;
};

function CardGrid() {
  return (
    <View style={styles.gridOverlay} pointerEvents="none">
      {Array.from({ length: 4 }).map((_, row) => (
        <View key={`r-${row}`} style={styles.gridRow}>
          {Array.from({ length: 10 }).map((__, col) => (
            <View key={`c-${col}`} style={styles.gridCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function WelcomeKisanBanner({ onPress, fullBleed, width: widthProp }: WelcomeKisanBannerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = widthProp ?? (fullBleed ? windowWidth : windowWidth - 32);
  const artW = Math.round(cardWidth * 0.38);
  const artH = Math.round(artW * 1.05);

  return (
    <View style={[styles.wrap, fullBleed ? styles.wrapBleed : null, { width: cardWidth }]}>
      <View style={styles.card}>
        <CardGrid />
        <LinearGradient
          colors={["rgba(201, 255, 53, 0.28)", "transparent"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.2, y: 0.9 }}
          style={styles.glow}
          pointerEvents="none"
        />
        <View style={styles.content}>
          <View style={styles.textCol}>
            <Text style={styles.welcomeLine}>Welcome</Text>
            <Text style={styles.brandLine}>Kisan Bazaar</Text>
            <Text style={styles.subtitle}>The Farmer&apos;s Marketplace</Text>
            <Pressable style={styles.btn} onPress={onPress} accessibilityRole="button">
              <Text style={styles.btnText}>Shop Now!</Text>
            </Pressable>
          </View>
          <View style={styles.artWrap}>
            <Image source={WELCOME_ART} style={{ width: artW, height: artH }} resizeMode="contain" />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    alignSelf: "center"
  },
  wrapBleed: {
    marginTop: 16,
    marginHorizontal: 0
  },
  card: {
    borderRadius: 19.76,
    backgroundColor: LIGHT_CARD_BG,
    overflow: "hidden",
    minHeight: 148
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35
  },
  gridRow: {
    flex: 1,
    flexDirection: "row"
  },
  gridCell: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.06)"
  },
  glow: {
    ...StyleSheet.absoluteFillObject
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 18,
    paddingTop: 18,
    paddingBottom: 12,
    paddingRight: 8
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 6
  },
  welcomeLine: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: APP_BLACK
  },
  brandLine: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: APP_LIME
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "500",
    color: "#3a3a3a"
  },
  btn: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: APP_LIME,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
    color: APP_TEXT_ON_LIME
  },
  artWrap: {
    alignSelf: "flex-end"
  }
});
