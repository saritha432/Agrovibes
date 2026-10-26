import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";
import type { BookableRental } from "./rentalCategories";

export function RentalListingCard({ listing, onCheck }: { listing: BookableRental; onCheck: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onCheck} accessibilityRole="button" accessibilityLabel={`Check ${listing.title}`}>
      <View style={styles.icon}>
        <Ionicons name="construct-outline" size={20} color={APP_LIME} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.meta}>{listing.category}</Text>
      </View>
      <View style={styles.check}>
        <Text style={styles.checkText}>Check</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: APP_SURFACE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(201,255,53,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  body: { flex: 1 },
  title: { color: APP_TEXT, fontSize: 16, fontWeight: "800" },
  meta: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 2 },
  check: {
    backgroundColor: APP_LIME,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  checkText: { color: APP_BLACK, fontSize: 12, fontWeight: "800" }
});
