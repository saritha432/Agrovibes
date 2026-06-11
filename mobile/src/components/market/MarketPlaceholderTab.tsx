import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

type MarketPlaceholderTabProps = {
  tabLabel: string;
  onBrowse: () => void;
};

export function MarketPlaceholderTab({ tabLabel, onBrowse }: MarketPlaceholderTabProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{tabLabel}</Text>
      <Text style={styles.subtitle}>Browse listings in this category.</Text>
      <Pressable style={styles.btn} onPress={onBrowse}>
        <Text style={styles.btnText}>View listings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: APP_TEXT
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: APP_TEXT_MUTED,
    textAlign: "center"
  },
  btn: {
    marginTop: 20,
    backgroundColor: APP_SURFACE,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.2)"
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: APP_LIME
  }
});
