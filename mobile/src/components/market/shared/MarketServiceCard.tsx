import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import type { MarketServiceCard as MarketServiceCardData } from "../all/marketAllConfig";
import { MarketCategorySection } from "./MarketCategorySection";

const MARKET_CARD_DARK = "#2c2c2c";

type MarketServiceCardProps = {
  card: MarketServiceCardData;
  onPress: (id: string) => void;
};

export function MarketServiceCard({ card, onPress }: MarketServiceCardProps) {
  const light = card.variant === "gradient" || Boolean(card.backgroundColor);

  const body = card.sections.map((section) => (
    <MarketCategorySection
      key={section.title}
      title={section.title}
      items={section.items}
      columns={section.columns}
      tileWidth={section.tileWidth}
      tileHeight={section.tileHeight}
      light={light}
      onPress={onPress}
    />
  ));

  if (card.backgroundColor) {
    return (
      <View style={[styles.shellLight, { backgroundColor: card.backgroundColor }]}>
        {body}
      </View>
    );
  }

  if (card.variant === "gradient") {
    return (
      <LinearGradient
        colors={["#d4f56a", "#eef9c8", "#f5fae8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.shellGradient}
      >
        {body}
      </LinearGradient>
    );
  }

  return <View style={styles.shellDark}>{body}</View>;
}

const shellBase = {
  marginHorizontal: 16,
  marginTop: 16,
  borderRadius: 16,
  paddingHorizontal: 14,
  paddingTop: 16,
  paddingBottom: 4,
  overflow: "hidden" as const
};

const styles = StyleSheet.create({
  shellDark: {
    ...shellBase,
    backgroundColor: MARKET_CARD_DARK,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.08)"
  },
  shellLight: {
    ...shellBase,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)"
  },
  shellGradient: {
    ...shellBase,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.25)"
  }
});
