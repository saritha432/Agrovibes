import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { RentalText as Text, rentalType } from "./rentalTypography";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CartQtyControl } from "../../cart/CartQtyControl";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { navigateToRentalCart, navigateToRentalCategory } from "../../navigation/navigationRef";
import { useAndroidNestedStackBack } from "../../navigation/useAndroidScreenBack";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { useRentalCart } from "./RentalCartContext";
import { RENTAL_CATEGORIES, rentalCategoryById } from "./rentalCategories";
import { catalogForCategory, RENTAL_CATALOG_SUBS, type RentalCatalogItem, type RentalCatalogSub } from "./rentalCatalog";
import { RENTAL_CART_MAX_QTY } from "./rentalCart";

const BACK_ICON = require("../../../assets/market/back-icon.png");
const SIDE_CARD_W = 74;
const SIDE_CARD_H = 88;
const SIDEBAR_W = 16 + SIDE_CARD_W + 10;
const TILE_BG = "#303132";

function rupee(n: number) {
  return "\u20B9" + Math.round(n).toLocaleString("en-IN");
}

function unitPrice(item: RentalCatalogItem) {
  return `${rupee(Math.max(1, Math.round(item.price / 10)))}/${item.unitLabel}`;
}

export function RentalCategoryScreen() {
  useAndroidNestedStackBack();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "RentalCategory">>();
  const insets = useSafeAreaInsets();
  const { itemCount, subtotal, addItem, getQuantity } = useRentalCart();
  const location = route.params?.location || "Telangana";
  const category = rentalCategoryById(route.params?.categoryId || "");
  const { width } = useWindowDimensions();
  const subs = category ? RENTAL_CATALOG_SUBS[category.id] ?? [] : [];
  const [activeSub, setActiveSub] = useState(subs[0]?.id ?? "");
  const [selected, setSelected] = useState<RentalCatalogItem | null>(null);
  const [option, setOption] = useState("");

  useEffect(() => {
    setActiveSub(subs[0]?.id ?? "");
    setSelected(null);
  }, [category?.id]);

  const items = useMemo(() => {
    if (!category) return [];
    return catalogForCategory(category.id).filter((item) => item.subCategoryId === activeSub);
  }, [activeSub, category]);

  const mainWidth = width - SIDEBAR_W;
  const cardWidth = Math.floor((mainWidth - 16 - 8) / 2);
  const rows = useMemo(() => {
    const pairs: { id: string; left: RentalCatalogItem; right?: RentalCatalogItem }[] = [];
    for (let index = 0; index < items.length; index += 2) {
      pairs.push({ id: items[index].id, left: items[index], right: items[index + 1] });
    }
    return pairs;
  }, [items]);

  const openItem = (item: RentalCatalogItem, chosenOption?: string) => {
    setSelected(item);
    setOption(chosenOption || item.options[0] || item.unitLabel);
  };

  const goToCart = () => {
    if (selected) {
      const chosen = option || selected.options[0] || selected.unitLabel;
      if (getQuantity(selected.id, chosen) <= 0) {
        addItem(selected, category?.title || selected.title, chosen);
      }
      setSelected(null);
    }
    navigateToRentalCart(location);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Back">
          <Image source={BACK_ICON} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {category ? category.title : "All rentals"}
        </Text>
        <Pressable style={styles.cartBtn} onPress={() => navigateToRentalCart(location)} accessibilityLabel="Cart">
          <Ionicons name="cart-outline" size={24} color={APP_TEXT} />
          {itemCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {!category ? (
        <ScrollView contentContainerStyle={styles.allList}>
          {RENTAL_CATEGORIES.map((item) => {
            const cover = RENTAL_CATALOG_SUBS[item.id]?.[0];
            return (
              <Pressable key={item.id} style={styles.allRow} onPress={() => navigateToRentalCategory(item.id, location)}>
                {cover ? <Image source={cover.image} style={styles.allImage} resizeMode="cover" /> : null}
                <View style={styles.allText}>
                  <Text style={styles.allTitle}>{item.title}</Text>
                  <Text style={styles.allBlurb}>{item.blurb}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.body}>
          <ScrollView style={styles.sidebar} showsVerticalScrollIndicator={false}>
            {subs.map((sub) => (
              <SideItem key={sub.id} sub={sub} active={sub.id === activeSub} onPress={() => setActiveSub(sub.id)} />
            ))}
          </ScrollView>
          <ScrollView
            contentContainerStyle={[styles.grid, { paddingBottom: itemCount > 0 ? 96 : 28 }]}
            showsVerticalScrollIndicator={false}
          >
            <RentalBanner
              title={category.title}
              location={location}
              image={subs.find((sub) => sub.id === activeSub)?.image ?? subs[0]?.image}
              width={mainWidth - 16}
              onPress={() => {
                if (items[0]) openItem(items[0]);
              }}
            />
            {rows.map((row) => (
              <View key={row.id} style={styles.gridRow}>
                <View style={{ width: cardWidth }}>
                  <RentalCard
                    item={row.left}
                    categoryTitle={category.title}
                    onOpen={(chosen) => openItem(row.left, chosen)}
                  />
                </View>
                {row.right ? (
                  <View style={{ width: cardWidth }}>
                    <RentalCard
                      item={row.right}
                      categoryTitle={category.title}
                      onOpen={(chosen) => {
                        if (row.right) openItem(row.right, chosen);
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <RentalSheet
        item={selected}
        location={location}
        categoryTitle={category?.title ?? ""}
        option={option}
        onClose={() => setSelected(null)}
        onOption={setOption}
        onBook={goToCart}
      />
      {itemCount > 0 ? (
        <Pressable
          style={[styles.viewCartBar, { marginBottom: Math.max(insets.bottom, 12) }]}
          onPress={() => navigateToRentalCart(location)}
          accessibilityLabel="View Cart"
        >
          <View>
            <Text style={styles.viewCartCount}>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </Text>
            <Text style={styles.viewCartTotal}>{rupee(subtotal)}</Text>
          </View>
          <View style={styles.viewCartCta}>
            <Text style={styles.viewCartCtaText}>View Cart</Text>
            <Ionicons name="chevron-forward" size={16} color={APP_TEXT_ON_LIME} />
          </View>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function SideItem({ sub, active, onPress }: { sub: RentalCatalogSub; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.sidePress} onPress={onPress}>
      <View style={[styles.sideCard, active ? styles.sideCardOn : null]}>
        <Text style={[styles.sideLabel, active ? styles.sideLabelOn : null]} numberOfLines={1}>
          {sub.label}
        </Text>
        <Image source={sub.image} style={styles.sideImage} resizeMode="contain" />
      </View>
    </Pressable>
  );
}

function RentalBanner({
  title,
  location,
  image,
  width,
  onPress
}: {
  title: string;
  location: string;
  image?: RentalCatalogSub["image"];
  width: number;
  onPress: () => void;
}) {
  return (
    <View style={[styles.banner, { width }]}>
      <LinearGradient
        colors={["rgba(201, 255, 53, 0.28)", "transparent"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bannerText}>
        <Text style={styles.bannerWelcome}>Welcome</Text>
        <Text style={styles.bannerTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.bannerSub}>Book it in {location}</Text>
        <Pressable style={styles.bannerBtn} onPress={onPress}>
          <Text style={styles.bannerBtnText}>Book now</Text>
        </Pressable>
      </View>
      {image ? <Image source={image} style={styles.bannerArt} resizeMode="contain" /> : null}
    </View>
  );
}

function RentalCard({
  item,
  categoryTitle,
  onOpen
}: {
  item: RentalCatalogItem;
  categoryTitle: string;
  onOpen: (option: string) => void;
}) {
  const { addItem, getQuantity, setQuantity } = useRentalCart();
  const [choice, setChoice] = useState(item.options[0] ?? "");
  const qty = getQuantity(item.id, choice);

  return (
    <Pressable style={styles.card} onPress={() => onOpen(choice)}>
      <View style={styles.media}>
        <Image source={item.image} style={styles.mediaImage} resizeMode="cover" />
        <CartQtyControl
          variant="lime"
          overlay
          quantity={qty}
          increaseDisabled={qty >= RENTAL_CART_MAX_QTY}
          onAdd={() => addItem(item, categoryTitle, choice)}
          onIncrease={() => addItem(item, categoryTitle, choice)}
          onDecrease={() => setQuantity(item.id, choice, qty - 1, item, categoryTitle)}
        />
      </View>
      <View style={styles.ratingRow}>
        <Ionicons name="star" size={12} color={APP_LIME} />
        <Text style={styles.ratingText}>
          {item.rating} | {item.reviewLabel}
        </Text>
        <Text style={styles.etaDot}>{"\u2022"}</Text>
        <Text style={styles.eta}>{item.eta}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {item.subtitle}
      </Text>
      {item.tag ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{item.tag}</Text>
        </View>
      ) : null}
      <View style={styles.pillRow}>
        {item.options.map((value) => {
          const on = value === choice;
          return (
            <Pressable key={value} style={[styles.pill, on ? styles.pillOn : null]} onPress={() => setChoice(value)}>
              <Text style={[styles.pillText, on ? styles.pillTextOn : null]}>{value}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.priceBlock}>
        {item.discountPct > 0 ? <Text style={styles.discount}>{item.discountPct}% OFF</Text> : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{rupee(item.price)}</Text>
          {item.mrp > item.price ? <Text style={styles.mrp}>{rupee(item.mrp)}</Text> : null}
        </View>
        <Text style={styles.unit}>{unitPrice(item)}</Text>
      </View>
    </Pressable>
  );
}

function RentalSheet({
  item,
  location,
  categoryTitle,
  option,
  onClose,
  onOption,
  onBook
}: {
  item: RentalCatalogItem | null;
  location: string;
  categoryTitle: string;
  option: string;
  onClose: () => void;
  onOption: (value: string) => void;
  onBook: () => void;
}) {
  const { addItem, getQuantity, setQuantity } = useRentalCart();
  const count = item ? getQuantity(item.id, option || item.options[0] || item.unitLabel) : 0;
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        {item ? (
          <View style={styles.sheet}>
            <Image source={item.image} style={styles.sheetImage} resizeMode="cover" />
            <View style={styles.sheetTools}>
              <Pressable style={styles.sheetIconBtn} onPress={onClose} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={22} color={APP_TEXT} />
              </Pressable>
              <Pressable style={styles.sheetIconBtn} onPress={onBook} accessibilityLabel="Book">
                <Ionicons name="calendar-outline" size={18} color={APP_TEXT} />
              </Pressable>
            </View>
            <View style={styles.sheetBody}>
              <Text style={styles.sheetTitle}>{item.title}</Text>
              <Text style={styles.sheetSub}>{item.subtitle}</Text>
              <Text style={styles.sheetMeta}>
                {categoryTitle} · {location}
              </Text>
              {item.tag ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.tag}</Text>
                </View>
              ) : null}
              <View style={styles.sheetOptionRow}>
                {item.options.map((value) => {
                  const on = value === option;
                  return (
                    <Pressable key={value} style={[styles.pill, on ? styles.pillOn : null]} onPress={() => onOption(value)}>
                      <Text style={[styles.pillText, on ? styles.pillTextOn : null]}>{value}</Text>
                    </Pressable>
                  );
                })}
                <View style={styles.sheetPriceSide}>
                  {item.discountPct > 0 ? <Text style={styles.discount}>{item.discountPct}% OFF</Text> : null}
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{rupee(item.price)}</Text>
                    {item.mrp > item.price ? <Text style={styles.mrp}>{rupee(item.mrp)}</Text> : null}
                  </View>
                  <Text style={styles.unit}>{unitPrice(item)}</Text>
                </View>
                {item ? (
                  <CartQtyControl
                    variant="lime"
                    addAppearance="label"
                    quantity={count}
                    increaseDisabled={count >= RENTAL_CART_MAX_QTY}
                    onAdd={() => addItem(item, categoryTitle, option)}
                    onIncrease={() => addItem(item, categoryTitle, option)}
                    onDecrease={() => setQuantity(item.id, option, count - 1, item, categoryTitle)}
                    style={styles.sheetQty}
                  />
                ) : null}
              </View>
              <View style={styles.offerRow}>
                <Ionicons name="pricetag" size={16} color={APP_LIME} />
                <Text style={styles.offerText}>Payment offers</Text>
                <Text style={styles.offerValue}>{item.discountPct > 0 ? `${rupee(item.mrp - item.price)} OFF` : "Available"}</Text>
              </View>
              <Pressable style={styles.bookBtn} onPress={onBook}>
                <Text style={styles.bookText}>View Cart</Text>
                <Text style={styles.bookCount}>
                  {Math.max(count, 1)} {Math.max(count, 1) === 1 ? item.unitLabel.toLowerCase() : `${item.unitLabel.toLowerCase()}s`}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  backIcon: { width: 28, height: 28 },
  headerTitle: { color: APP_TEXT, flex: 1, ...rentalType(16, "700") },
  cartBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  cartBadge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  cartBadgeText: { color: APP_TEXT_ON_LIME, ...rentalType(10, "800") },
  allList: { padding: 16, paddingBottom: 32 },
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: APP_SURFACE,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10
  },
  allImage: { width: 64, height: 64, borderRadius: 10 },
  allText: { flex: 1 },
  allTitle: { color: APP_TEXT, ...rentalType(15, "800") },
  allBlurb: { color: APP_TEXT_MUTED, marginTop: 2, ...rentalType(12, "400", { lineHeight: 17 }) },
  body: { flex: 1, flexDirection: "row" },
  sidebar: { width: SIDEBAR_W, paddingLeft: 16, paddingTop: 8 },
  sidePress: { width: SIDE_CARD_W, marginBottom: 10 },
  sideCard: { width: SIDE_CARD_W, alignItems: "center", paddingTop: 6, paddingHorizontal: 4, minHeight: 72 },
  sideCardOn: {
    height: SIDE_CARD_H,
    backgroundColor: TILE_BG,
    borderRadius: 8,
    borderBottomWidth: 4,
    borderBottomColor: "#C9FF35B2"
  },
  sideLabel: { color: APP_TEXT, textAlign: "center", ...rentalType(11, "700") },
  sideLabelOn: { color: APP_LIME },
  sideImage: { width: 58, height: 46, marginTop: 4 },
  grid: { paddingHorizontal: 8, paddingBottom: 28 },
  gridRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  banner: {
    minHeight: 132,
    borderRadius: 18,
    backgroundColor: "#EDEDED",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingLeft: 14
  },
  bannerText: { flex: 1, zIndex: 1 },
  bannerWelcome: { color: APP_BLACK, ...rentalType(13, "600") },
  bannerTitle: { color: APP_BLACK, marginTop: 2, ...rentalType(18, "800") },
  bannerSub: { color: "#3a3a3a", marginTop: 2, ...rentalType(11, "400") },
  bannerBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: APP_LIME,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  bannerBtnText: { color: APP_TEXT_ON_LIME, ...rentalType(12, "800") },
  bannerArt: { width: 110, height: 120 },
  card: { backgroundColor: TILE_BG, borderRadius: 12, padding: 8 },
  media: { height: 110, borderRadius: 10, overflow: "hidden", marginBottom: 8, backgroundColor: "#173024" },
  mediaImage: { width: "100%", height: "100%" },
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
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: APP_TEXT, fontSize: 10, fontWeight: "700" },
  etaDot: { color: APP_TEXT_MUTED, fontSize: 10 },
  eta: { color: APP_TEXT_MUTED, fontSize: 10, fontWeight: "600" },
  cardTitle: { color: APP_TEXT, marginTop: 4, ...rentalType(13, "800") },
  cardSub: { color: APP_TEXT_MUTED, marginTop: 2, ...rentalType(10, "400") },
  tag: { alignSelf: "flex-start", marginTop: 6, backgroundColor: APP_LIME, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { color: APP_TEXT_ON_LIME, fontSize: 9, fontWeight: "800" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  pill: { borderRadius: 6, borderWidth: 1, borderColor: "rgba(201,255,53,0.35)", paddingHorizontal: 7, paddingVertical: 4 },
  pillOn: { backgroundColor: "rgba(201,255,53,0.16)", borderColor: APP_LIME },
  pillText: { color: APP_TEXT_MUTED, fontSize: 9, fontWeight: "700" },
  pillTextOn: { color: APP_LIME },
  priceBlock: { marginTop: 8 },
  discount: { color: APP_TEXT, fontSize: 10, fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  price: { color: APP_LIME, ...rentalType(16, "800") },
  mrp: { color: APP_TEXT_MUTED, fontSize: 11, textDecorationLine: "line-through" },
  unit: { color: APP_TEXT_MUTED, fontSize: 9, marginTop: 2 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  sheet: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden", maxHeight: "92%" },
  sheetImage: { width: "100%", height: 220, backgroundColor: "#102117" },
  sheetTools: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sheetIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  sheetBody: { padding: 16, paddingBottom: 22 },
  sheetTitle: { color: APP_TEXT, ...rentalType(22, "800") },
  sheetSub: { color: APP_TEXT_MUTED, fontSize: 13, marginTop: 4 },
  sheetMeta: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 2 },
  sheetOptionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 },
  sheetPriceSide: { minWidth: 100 },
  stepper: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#2a2a2a",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  stepGlyph: { color: APP_LIME, fontSize: 18, fontWeight: "800" },
  stepCount: { color: APP_TEXT, fontSize: 14, fontWeight: "800", minWidth: 12, textAlign: "center" },
  sheetQty: { marginLeft: "auto" },
  sheetAdd: { marginLeft: "auto", backgroundColor: APP_LIME, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  sheetAddText: { color: APP_TEXT_ON_LIME, fontWeight: "800" },
  viewCartBar: {
    marginHorizontal: 12,
    backgroundColor: APP_LIME,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  viewCartCount: { color: APP_TEXT_ON_LIME, fontSize: 12, fontWeight: "700" },
  viewCartTotal: { color: APP_TEXT_ON_LIME, fontSize: 16, fontWeight: "800", marginTop: 2 },
  viewCartCta: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewCartCtaText: { color: APP_TEXT_ON_LIME, fontSize: 15, fontWeight: "800" },
  offerRow: {
    marginTop: 16,
    backgroundColor: "#242424",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  offerText: { color: APP_TEXT, fontSize: 13, fontWeight: "700", flex: 1 },
  offerValue: { color: APP_LIME, fontSize: 13, fontWeight: "800" },
  bookBtn: { marginTop: 14, backgroundColor: APP_LIME, borderRadius: 24, alignItems: "center", paddingVertical: 10 },
  bookText: { color: APP_TEXT_ON_LIME, fontSize: 16, fontWeight: "800" },
  bookCount: { color: APP_TEXT_ON_LIME, fontSize: 12, fontWeight: "600" }
});
