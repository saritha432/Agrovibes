import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";

type MarketSectionTitleProps = {
  title: string;
  accent?: string;
  subtitle?: string;
  light?: boolean;
};

export function MarketSectionTitle({ title, accent, subtitle, light }: MarketSectionTitleProps) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, light ? styles.titleLight : null]}>
        {title}
        {accent ? <Text style={styles.accent}> {accent}</Text> : null}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, light ? styles.subtitleLight : null]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: APP_TEXT
  },
  titleLight: {
    color: "#1a1a1a"
  },
  accent: {
    color: APP_LIME
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: APP_TEXT_MUTED
  },
  subtitleLight: {
    color: "#4a4a4a"
  }
});
