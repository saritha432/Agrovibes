import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ProviderChromeHeader } from "./ProviderChrome";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";

const BG = "#303132";

export function ProviderListingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <View style={styles.body}>
        <Text style={styles.title}>Your listings</Text>
        <Text style={styles.sub}>Create a rental, service, store, or educator listing.</Text>
        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate("ProviderNewListing")}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={22} color="#000" />
          <Text style={styles.ctaText}>New Listing</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 100
  },
  title: { color: APP_LIME, fontSize: 22, fontWeight: "800" },
  sub: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  ctaText: { color: "#000", fontSize: 15, fontWeight: "800" }
});
