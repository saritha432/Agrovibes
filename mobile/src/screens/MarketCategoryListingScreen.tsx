import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildCategoryListingRows } from "../components/market/listing/buildCategoryListingRows";
import { MarketCategoryFilterBar } from "../components/market/listing/MarketCategoryFilterBar";
import { MarketFilterSheet } from "../components/market/listing/MarketFilterSheet";
import { MarketListingInlineAd } from "../components/market/listing/MarketListingInlineAd";
import type { FilterSelectionValue } from "../components/market/listing/marketFilterOptions";
import { WelcomeKisanBanner } from "../components/market/all/sections/WelcomeKisanBanner";
import {
  getMarketCategoryListingConfig,
  type MarketListingProduct,
  type MarketSubCategory
} from "../components/market/listing/marketCategoryListingConfig";
import type { MarketStackParamList } from "../navigation/MarketStackNavigator";
import {
  APP_BLACK,
  APP_LIME,
  APP_SURFACE,
  APP_TEXT,
  APP_TEXT_MUTED,
  APP_TEXT_ON_LIME
} from "../theme/appColors";

type Nav = NativeStackNavigationProp<MarketStackParamList, "MarketCategory">;
type Route = RouteProp<MarketStackParamList, "MarketCategory">;

const SIDE_CARD_W = 74;
const SIDE_CARD_H = 88;
const SIDEBAR_W = 16 + SIDE_CARD_W + 10;
const SIDE_ACTIVE_BORDER = "#C9FF35B2";
const TILE_BG = "#303132";
const BACK_ICON = require("../../assets/market/back-icon.png");

function rupee(n: number) {
  return "\u20B9" + Math.round(n).toLocaleString("en-IN");
}

function SidebarSubCategoryItem({
  sub,
  active,
  onPress
}: {
  sub: MarketSubCategory;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.sideItemPress} onPress={onPress}>
      <View style={[styles.sideCard, active ? styles.sideCardActive : null]}>
        <Text style={[styles.sideLabel, active ? styles.sideLabelActive : null]} numberOfLines={1}>
          {sub.label}
        </Text>
        <View style={styles.sideArtWrap}>
          {sub.icon ? (
            <Image source={sub.icon} style={styles.sideArt} resizeMode="contain" />
          ) : (
            <Ionicons
              name={sub.fallbackIcon ?? "ellipse-outline"}
              size={32}
              color={active ? APP_LIME : APP_TEXT_MUTED}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ProductCard({ product }: { product: MarketListingProduct }) {
  const [weight, setWeight] = useState(product.weights[0]);

  return (
    <View style={styles.productCard}>
      <View style={styles.productMedia}>
        <View style={styles.productMediaPlaceholder} />
        <Pressable style={styles.addBtn} accessibilityLabel="Add to cart">
          <Ionicons name="add" size={22} color={APP_TEXT_ON_LIME} />
        </Pressable>
      </View>

      <View style={styles.ratingRow}>
        <Ionicons name="star" size={12} color={APP_LIME} />
        <Text style={styles.ratingText}>
          {product.rating} | {product.reviewLabel}
        </Text>
        <Text style={styles.etaDot}>{"\u2022"}</Text>
        <Text style={styles.etaText}>{product.eta}</Text>
      </View>

      <Text style={styles.productTitle} numberOfLines={1}>
        {product.title}
      </Text>
      <Text style={styles.productSubtitle} numberOfLines={1}>
        {product.subtitle}
      </Text>

      {product.germination ? (
        <View style={styles.germTag}>
          <Text style={styles.germTagText}>{product.germination}</Text>
        </View>
      ) : null}

      <View style={styles.weightRow}>
        {product.weights.map((w) => {
          const on = w === weight;
          return (
            <Pressable
              key={w}
              style={[styles.weightPill, on ? styles.weightPillOn : null]}
              onPress={() => setWeight(w)}
            >
              <Text style={[styles.weightText, on ? styles.weightTextOn : null]}>{w}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.priceBlock}>
        <Text style={styles.discountLabel}>{product.discountPct}% OFF</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{rupee(product.price)}</Text>
          <Text style={styles.mrp}>{rupee(product.mrp)}</Text>
        </View>
        <Text style={styles.unitPrice}>{rupee(product.unitPrice)}/Unit</Text>
      </View>
    </View>
  );
}

export function MarketCategoryListingScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const config = useMemo(
    () => getMarketCategoryListingConfig(route.params.categoryId),
    [route.params.categoryId]
  );
  const [activeSub, setActiveSub] = useState(config.subCategories[0]?.id ?? "all");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filterSheetFocus, setFilterSheetFocus] = useState(config.filters[0] ?? "Category Type");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, FilterSelectionValue>>({});
  const mainWidth = windowWidth - SIDEBAR_W;
  const gridPad = 8;
  const gridGap = 8;
  const cardWidth = Math.floor((mainWidth - gridPad * 2 - gridGap) / 2);

  useEffect(() => {
    setActiveSub(config.subCategories[0]?.id ?? "all");
    setFilterSheetOpen(false);
    setFilterSheetFocus(config.filters[0] ?? "Category Type");
    setSelectedFilters({});
  }, [config.categoryId, config.subCategories, config.filters]);

  const openFilterSheet = (focusFilter?: string) => {
    setFilterSheetFocus(focusFilter ?? config.filters[0] ?? "Category Type");
    setFilterSheetOpen(true);
  };

  const products = useMemo(
    () => config.products.filter((p) => p.subCategoryId === activeSub),
    [config.products, activeSub]
  );

  const listingRows = useMemo(
    () => buildCategoryListingRows(products, config.inlineAdsEvery),
    [products, config.inlineAdsEvery]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Image source={BACK_ICON} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {config.title}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.sidebar}>
          {config.subCategories.map((sub) => (
            <SidebarSubCategoryItem
              key={sub.id}
              sub={sub}
              active={activeSub === sub.id}
              onPress={() => setActiveSub(sub.id)}
            />
          ))}
        </View>

        <View style={styles.main}>
          <MarketCategoryFilterBar
            filters={config.filters}
            selectedByFilter={selectedFilters}
            onOpenSheet={openFilterSheet}
          />

          <MarketFilterSheet
            visible={filterSheetOpen}
            filters={config.filters}
            focusFilter={filterSheetFocus}
            selectedByFilter={selectedFilters}
            onClose={() => setFilterSheetOpen(false)}
            onApply={setSelectedFilters}
          />

          <FlatList
            data={listingRows}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 16 }]}
            renderItem={({ item }) => {
              if (item.type === "ad") {
                return (
                  <MarketListingInlineAd
                    adIndex={item.adIndex}
                    width={mainWidth - 16}
                  />
                );
              }

              return (
                <View style={[styles.gridRow, { width: mainWidth - gridPad * 2 }]}>
                  <View style={[styles.cardSlot, { width: cardWidth }]}>
                    <ProductCard product={item.left} />
                  </View>
                  {item.right ? (
                    <View style={[styles.cardSlot, { width: cardWidth }]}>
                      <ProductCard product={item.right} />
                    </View>
                  ) : null}
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No products in this sub-category yet.</Text>
            }
            ListFooterComponent={
              config.showWelcomeFooter ? (
                <WelcomeKisanBanner
                  fullBleed
                  width={mainWidth - 16}
                  onPress={() => navigation.navigate("MarketListings")}
                />
              ) : null
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BLACK
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  backIcon: {
    width: 34,
    height: 34
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: APP_TEXT
  },
  body: {
    flex: 1,
    flexDirection: "row"
  },
  sidebar: {
    width: SIDEBAR_W,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
    paddingLeft: 16,
    gap: 10
  },
  sideItemPress: {
    width: SIDE_CARD_W
  },
  sideCard: {
    width: SIDE_CARD_W,
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 4
  },
  sideCardActive: {
    height: SIDE_CARD_H,
    backgroundColor: TILE_BG,
    borderRadius: 8.38,
    borderBottomWidth: 4,
    borderBottomColor: SIDE_ACTIVE_BORDER
  },
  sideLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "600",
    color: APP_TEXT,
    textAlign: "center"
  },
  sideLabelActive: {
    color: APP_LIME
  },
  sideArtWrap: {
    flex: 1,
    width: "100%",
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0
  },
  sideArt: {
    width: 62,
    height: 48
  },
  main: {
    flex: 1,
    minWidth: 0
  },
  grid: {
    paddingHorizontal: 8
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
    flexShrink: 0
  },
  cardSlot: {
    flexGrow: 0,
    flexShrink: 0
  },
  productCard: {
    width: "100%",
    backgroundColor: TILE_BG,
    borderRadius: 12,
    padding: 10
  },
  productMedia: {
    height: 110,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    marginBottom: 8
  },
  productMediaPlaceholder: {
    flex: 1,
    backgroundColor: APP_SURFACE,
    borderRadius: 10
  },
  addBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4
  },
  ratingText: {
    fontSize: 10,
    fontWeight: "600",
    color: APP_TEXT
  },
  etaDot: {
    color: APP_TEXT_MUTED,
    fontSize: 10
  },
  etaText: {
    fontSize: 10,
    fontWeight: "600",
    color: APP_TEXT_MUTED
  },
  productTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: APP_TEXT
  },
  productSubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: APP_TEXT_MUTED
  },
  germTag: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: APP_LIME,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  germTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: APP_TEXT_ON_LIME
  },
  weightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8
  },
  weightPill: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  weightPillOn: {
    backgroundColor: "rgba(201, 255, 53, 0.15)",
    borderColor: APP_LIME
  },
  weightText: {
    fontSize: 9,
    fontWeight: "600",
    color: APP_TEXT_MUTED
  },
  weightTextOn: {
    color: APP_LIME
  },
  priceBlock: {
    marginTop: 8
  },
  discountLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: APP_TEXT
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 2
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
    fontSize: 9,
    color: APP_TEXT_MUTED
  },
  emptyText: {
    padding: 24,
    textAlign: "center",
    color: APP_TEXT_MUTED,
    fontSize: 13
  }
});
