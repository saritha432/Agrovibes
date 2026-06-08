import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  APP_BLACK,
  APP_LIME,
  APP_SURFACE,
  APP_TEXT,
  APP_TEXT_MUTED
} from "../../../theme/appColors";
import type { ProductRailItem } from "../all/marketAllConfig";

type MarketProductRailProps = {
  title: string;
  titleAccent: string;
  subtitle: string;
  products: ProductRailItem[];
  onPress: (id: string) => void;
};

const CARD_W = 156;

export function MarketProductRail({ title, titleAccent, subtitle, products, onPress }: MarketProductRailProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {title} <Text style={styles.headerAccent}>{titleAccent}</Text>
        </Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {products.map((product) => (
          <Pressable key={product.id} style={styles.card} onPress={() => onPress(product.id)}>
            <View style={styles.imageBox}>
              <Ionicons name="image-outline" size={28} color={APP_TEXT_MUTED} />
              <Pressable style={styles.addBtn} hitSlop={6}>
                <Ionicons name="add" size={16} color={APP_BLACK} />
              </Pressable>
            </View>
            <Text style={styles.productTitle} numberOfLines={2}>
              {product.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {product.eta}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{product.price.toLocaleString("en-IN")}</Text>
              <Text style={styles.mrp}>MRP ₹{product.mrp.toLocaleString("en-IN")}</Text>
            </View>
            <Text style={styles.discount}>{product.discountPct}% OFF</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    backgroundColor: APP_SURFACE,
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 14,
    overflow: "hidden"
  },
  header: {
    paddingHorizontal: 14,
    marginBottom: 12
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: APP_TEXT
  },
  headerAccent: {
    color: APP_LIME
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: APP_TEXT_MUTED
  },
  row: {
    paddingHorizontal: 14,
    gap: 10
  },
  card: {
    width: CARD_W,
    backgroundColor: APP_BLACK,
    borderRadius: 12,
    padding: 10
  },
  imageBox: {
    height: 88,
    borderRadius: 8,
    backgroundColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  addBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  productTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: APP_TEXT,
    minHeight: 28
  },
  meta: {
    marginTop: 4,
    fontSize: 10,
    color: APP_TEXT_MUTED
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap"
  },
  price: {
    fontSize: 13,
    fontWeight: "700",
    color: APP_TEXT
  },
  mrp: {
    fontSize: 10,
    color: APP_TEXT_MUTED,
    textDecorationLine: "line-through"
  },
  discount: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: APP_LIME
  }
});
