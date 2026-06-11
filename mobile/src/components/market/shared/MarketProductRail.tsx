import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";
import type { ProductRailItem } from "../all/marketAllConfig";

type MarketProductRailProps = {
  title: string;
  titleAccent: string;
  subtitle: string;
  products: ProductRailItem[];
  onPress: (id: string) => void;
};

const MARKET_TILE_BG = "#303132";
const IMAGE_SIZE = 100;
const CARD_W = 118;

function formatReviews(count: string | number): string {
  if (typeof count === "string") return `[${count}]`;
  if (count >= 1000) return `[${(count / 1000).toFixed(1)}k]`;
  return `[${count}]`;
}

function ProductRailCard({ product, onPress }: { product: ProductRailItem; onPress: () => void }) {
  const [sizeIndex, setSizeIndex] = useState(0);
  const sizes = product.sizes?.length ? product.sizes : ["500 ml"];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageBox}>
        <Ionicons name="image-outline" size={28} color={APP_TEXT_MUTED} />
        <Pressable style={styles.addBtn} hitSlop={6} onPress={(e) => e.stopPropagation()}>
          <Ionicons name="add" size={18} color={APP_BLACK} />
        </Pressable>
      </View>

      <View style={styles.ratingRow}>
        <Ionicons name="star" size={10} color={APP_LIME} />
        <Text style={styles.ratingValue}>{product.rating?.toFixed(1) ?? "3.2"}</Text>
        <Text style={styles.ratingMeta}>
          {formatReviews(product.reviewCount ?? "24.6k")} {product.deliveryMinutes ?? "10 MIN"}
        </Text>
      </View>

      <Text style={styles.productTitle} numberOfLines={2}>
        {product.title}
      </Text>

      {product.tag ? (
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{product.tag}</Text>
        </View>
      ) : null}

      <View style={styles.sizeRow}>
        {sizes.map((size, idx) => (
          <Pressable
            key={`${product.id}-${size}`}
            hitSlop={4}
            onPress={(e) => {
              e.stopPropagation();
              setSizeIndex(idx);
            }}
          >
            <Text style={[styles.sizeChip, idx === sizeIndex ? styles.sizeChipActive : null]}>{size}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.discountLabel}>{product.discountPct}% OFF</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>₹{product.price.toLocaleString("en-IN")}</Text>
        <Text style={styles.mrp}>₹{product.mrp.toLocaleString("en-IN")}</Text>
      </View>
      {product.unitPrice ? <Text style={styles.unitPrice}>{product.unitPrice}</Text> : null}
    </Pressable>
  );
}

/** Figma promo strip — full artboard width × 123px tall. */
const PROMO_BAND_WIDTH = 430;
const PROMO_BAND_HEIGHT = 123;

export function MarketProductRail({ title, titleAccent, subtitle, products, onPress }: MarketProductRailProps) {
  return (
    <View style={styles.section}>
      <View style={styles.headerBand}>
        <Text style={styles.headerTitle}>
          {title} {titleAccent}
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
          <ProductRailCard key={product.id} product={product} onPress={() => onPress(product.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 22
  },
  headerBand: {
    width: PROMO_BAND_WIDTH,
    maxWidth: "100%",
    height: PROMO_BAND_HEIGHT,
    alignSelf: "center",
    backgroundColor: MARKET_TILE_BG,
    opacity: 1,
    justifyContent: "center",
    paddingHorizontal: 16
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: APP_LIME,
    letterSpacing: 0.1
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "500",
    color: APP_TEXT
  },
  row: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12
  },
  card: {
    width: CARD_W
  },
  imageBox: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 10,
    backgroundColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  addBtn: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 4
  },
  ratingValue: {
    fontSize: 10,
    fontWeight: "700",
    color: APP_LIME
  },
  ratingMeta: {
    fontSize: 10,
    color: APP_TEXT_MUTED,
    marginLeft: 2
  },
  productTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    color: APP_TEXT,
    minHeight: 30
  },
  tagPill: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#3a3a3a",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  tagText: {
    fontSize: 9,
    fontWeight: "600",
    color: APP_TEXT
  },
  sizeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 6
  },
  sizeChip: {
    fontSize: 10,
    fontWeight: "600",
    color: APP_TEXT_MUTED
  },
  sizeChipActive: {
    color: APP_LIME
  },
  discountLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: APP_TEXT,
    marginBottom: 2
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6
  },
  price: {
    fontSize: 16,
    fontWeight: "800",
    color: APP_LIME
  },
  mrp: {
    fontSize: 11,
    color: APP_TEXT_MUTED,
    textDecorationLine: "line-through"
  },
  unitPrice: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "500",
    color: APP_TEXT
  }
});
