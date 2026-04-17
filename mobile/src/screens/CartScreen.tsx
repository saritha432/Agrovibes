import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CheckoutBill, MarketStackParamList } from "../navigation/MarketStackNavigator";
import { useCart } from "../cart/CartContext";

const TEAL = "#0d9488";
const TEAL_STEPPER = "#0f766e";
const CTA_GREEN = "#2d6a4f";
const MUSTARD = "#ffb703";
const MUSTARD_SOFT = "#fff8e6";
const BG = "#fdf7f2";
const BORDER = "#e8e2d9";

const AGRO_WALLET_BALANCE = 2450;

type Nav = NativeStackNavigationProp<MarketStackParamList, "Cart">;

function rupee(n: number) {
  return "\u20B9" + Math.round(n).toLocaleString("en-IN");
}

function applyCouponCode(raw: string, subtotal: number): { discount: number; label: string } | null {
  const c = raw.trim().toUpperCase();
  if (!c) return null;
  if (c === "AGRO10") {
    const d = Math.min(500, Math.round(subtotal * 0.1));
    return d > 0 ? { discount: d, label: "AGRO10 (10% off, max 500)" } : null;
  }
  if (c === "SAVE100") {
    return subtotal >= 100 ? { discount: 100, label: "SAVE100 (100 off)" } : null;
  }
  if (c === "FIRST50") {
    return subtotal >= 200 ? { discount: 50, label: "FIRST50 (50 off)" } : null;
  }
  return null;
}

function buildBill(
  itemsSubtotal: number,
  couponDiscount: number,
  useWallet: boolean
): CheckoutBill {
  const discount = couponDiscount;
  const afterCoupon = Math.max(0, itemsSubtotal - discount);
  const delivery = afterCoupon === 0 ? 0 : afterCoupon >= 499 ? 0 : 40;
  const platformFee = Math.round(0.02 * afterCoupon);
  const gstOnFee = Math.round(0.18 * platformFee);
  const preWallet = afterCoupon + delivery + platformFee + gstOnFee;
  const walletApplied = useWallet ? Math.min(AGRO_WALLET_BALANCE, preWallet) : 0;
  const total = Math.max(0, preWallet - walletApplied);
  return {
    subtotal: itemsSubtotal,
    discount,
    afterCoupon,
    delivery,
    platformFee,
    gstOnFee,
    walletApplied,
    total
  };
}

function payablePaiseFromTotal(totalRupees: number): number {
  if (totalRupees <= 0) return 0;
  const raw = Math.round(totalRupees * 100);
  return Math.max(100, raw);
}

export function CartScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { items, itemCount, setQuantity, removeLine } = useCart();

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ discount: number; label: string } | null>(null);
  const [couponHint, setCouponHint] = useState("");
  const [useWallet, setUseWallet] = useState(false);

  const subtotal = useMemo(() => items.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [items]);

  const bill = useMemo(
    () => buildBill(subtotal, appliedCoupon?.discount ?? 0, useWallet),
    [subtotal, appliedCoupon, useWallet]
  );

  const tryApplyCoupon = () => {
    const res = applyCouponCode(couponInput, subtotal);
    if (res) {
      setAppliedCoupon(res);
      setCouponHint("");
    } else {
      setCouponHint("Invalid code or cart too small. Try AGRO10, SAVE100, FIRST50.");
    }
  };

  const proceed = () => {
    if (items.length === 0) return;
    const amountPaise = payablePaiseFromTotal(bill.total);
    const receipt = `cart_${Date.now()}`;
    navigation.navigate("Checkout", {
      amountPaise,
      receipt,
      bill,
      appliedCouponLabel: appliedCoupon?.label ?? ""
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={styles.locationRow}>
          <View style={styles.logoDot} />
          <View style={styles.locationChip}>
            <Ionicons name="location-outline" size={14} color="#1f2c29" />
            <Text style={styles.locationText}>Nashik, MH</Text>
            <Ionicons name="chevron-down" size={14} color="#1f2c29" />
          </View>
        </View>
        <View style={styles.topIcons}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="search-outline" size={18} color="#1f2c29" />
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={18} color="#1f2c29" />
            <View style={styles.notifDot} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate("MarketplaceHome")}>
            <Ionicons name="cart-outline" size={18} color="#1f2c29" />
            {itemCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="person-outline" size={18} color="#1f2c29" />
          </Pressable>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backWrap} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color="#1f2c29" />
        </Pressable>
        <Text style={styles.pageTitle}>My Cart</Text>
        <View style={styles.itemsPill}>
          <Text style={styles.itemsPillText}>{itemCount} items</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cart-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySub}>Add products from Agri Market</Text>
            <Pressable style={styles.shopBtn} onPress={() => navigation.navigate("MarketplaceHome")}>
              <Text style={styles.shopBtnText}>Browse market</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {items.map((line) => {
              const lineTotal = line.unitPrice * line.quantity;
              return (
                <View key={line.listingId} style={styles.lineCard}>
                  <View style={styles.lineThumb}>
                    <Ionicons name="leaf-outline" size={28} color={TEAL} />
                  </View>
                  <View style={styles.lineBody}>
                    <Text style={styles.lineName} numberOfLines={2}>
                      {line.cropName}
                    </Text>
                    <Text style={styles.lineVendor}>{line.vendor}</Text>
                    <Text style={styles.lineUnitPrice}>
                      {rupee(line.unitPrice)} {line.unitLabel}
                    </Text>
                    <View style={styles.lineBottom}>
                      <View style={styles.qtyPill}>
                        <Pressable
                          style={styles.qtyPillSide}
                          onPress={() => setQuantity(line.listingId, line.quantity - 1)}
                          hitSlop={6}
                        >
                          <Text style={styles.qtyPillGlyph}>−</Text>
                        </Pressable>
                        <Text style={styles.qtyPillCount}>{line.quantity}</Text>
                        <Pressable
                          style={styles.qtyPillSide}
                          onPress={() => setQuantity(line.listingId, line.quantity + 1)}
                          hitSlop={6}
                        >
                          <Text style={styles.qtyPillGlyph}>+</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.lineTotal}>{rupee(lineTotal)}</Text>
                    </View>
                    <Pressable style={styles.removeBtn} onPress={() => removeLine(line.listingId)} hitSlop={8}>
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Apply coupon</Text>
              <View style={styles.couponRow}>
                <TextInput
                  value={couponInput}
                  onChangeText={setCouponInput}
                  placeholder="Enter coupon code"
                  placeholderTextColor="#94a3b8"
                  style={styles.couponInput}
                  autoCapitalize="characters"
                />
                <Pressable style={styles.applyBtn} onPress={tryApplyCoupon}>
                  <Text style={styles.applyBtnText}>Apply</Text>
                </Pressable>
              </View>
              {couponHint ? <Text style={styles.couponErr}>{couponHint}</Text> : null}
              {appliedCoupon ? (
                <Text style={styles.couponOk}>Applied: {appliedCoupon.label}</Text>
              ) : (
                <Text style={styles.couponHintSmall}>Try AGRO10, SAVE100, or FIRST50</Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.walletRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletTitle}>AgroWallet</Text>
                  <Text style={styles.walletSub}>{rupee(AGRO_WALLET_BALANCE)} available</Text>
                </View>
                <Switch
                  value={useWallet}
                  onValueChange={setUseWallet}
                  trackColor={{ false: "#e2e8f0", true: "#99f6e4" }}
                  thumbColor={useWallet ? TEAL : "#f4f4f5"}
                />
              </View>
            </View>

            <View style={styles.escrow}>
              <Ionicons name="shield-checkmark" size={22} color="#b45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.escrowTitle}>Escrow protection</Text>
                <Text style={styles.escrowText}>
                  Your payment is held securely until delivery is confirmed. 100% refund if the order is not fulfilled.
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Order summary</Text>
              <SummaryRow label="Subtotal" value={rupee(bill.subtotal)} />
              {bill.discount > 0 ? <SummaryRow label="Discount" value={`− ${rupee(bill.discount)}`} highlight /> : null}
              <SummaryRow label="Delivery charges" value={bill.delivery === 0 ? "FREE" : rupee(bill.delivery)} />
              <SummaryRow label="Platform fee (2%)" value={rupee(bill.platformFee)} />
              <SummaryRow label="GST (18% on fee)" value={rupee(bill.gstOnFee)} />
              {bill.walletApplied > 0 ? (
                <SummaryRow label="AgroWallet" value={`− ${rupee(bill.walletApplied)}`} highlight />
              ) : null}
              <View style={styles.summaryDivider} />
              <SummaryRow label="Total" value={rupee(bill.total)} bold />
            </View>
          </>
        )}
      </ScrollView>

      {items.length > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={styles.checkoutCta} onPress={proceed}>
            <Text style={styles.checkoutCtaText}>Proceed to checkout</Text>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  highlight
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold, highlight && styles.summaryHi]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: MUSTARD },
  locationChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontWeight: "700", color: "#1f2c29", fontSize: 13 },
  topIcons: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center"
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444"
  },
  cartBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  cartBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
    gap: 10
  },
  backWrap: { padding: 4 },
  pageTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: "#1f2c29" },
  itemsPill: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  itemsPillText: { color: "#047857", fontWeight: "800", fontSize: 12 },
  scroll: { paddingHorizontal: 12 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#334155" },
  emptySub: { color: "#64748b", fontWeight: "600" },
  shopBtn: { marginTop: 16, backgroundColor: CTA_GREEN, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  shopBtnText: { color: "#fff", fontWeight: "800" },
  lineCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
    gap: 12
  },
  lineThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center"
  },
  lineBody: { flex: 1 },
  lineName: { fontWeight: "800", color: "#1f2c29", fontSize: 15 },
  lineVendor: { marginTop: 2, color: "#64748b", fontWeight: "600", fontSize: 12 },
  lineUnitPrice: { marginTop: 4, color: "#1f2c29", fontWeight: "700", fontSize: 13 },
  lineBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10
  },
  qtyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL_STEPPER,
    borderRadius: 999,
    minHeight: 36,
    paddingHorizontal: 2,
    minWidth: 108
  },
  qtyPillSide: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6
  },
  qtyPillGlyph: { color: "#fff", fontSize: 18, fontWeight: "700" },
  qtyPillCount: { color: "#fff", fontSize: 14, fontWeight: "900", minWidth: 28, textAlign: "center" },
  lineTotal: { fontWeight: "900", color: "#1f2c29", fontSize: 16 },
  removeBtn: { marginTop: 8, alignSelf: "flex-start" },
  removeText: { color: "#b91c1c", fontWeight: "700", fontSize: 13 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12
  },
  cardTitle: { fontWeight: "900", color: "#1f2c29", marginBottom: 10, fontSize: 15 },
  couponRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1f2c29",
    backgroundColor: "#fafafa"
  },
  applyBtn: {
    backgroundColor: CTA_GREEN,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12
  },
  applyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  couponErr: { marginTop: 8, color: "#b91c1c", fontWeight: "600", fontSize: 12 },
  couponOk: { marginTop: 8, color: CTA_GREEN, fontWeight: "700", fontSize: 12 },
  couponHintSmall: { marginTop: 8, color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  walletRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  walletTitle: { fontWeight: "900", color: "#1f2c29", fontSize: 15 },
  walletSub: { marginTop: 4, color: "#64748b", fontWeight: "600", fontSize: 13 },
  escrow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: MUSTARD_SOFT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 14,
    marginBottom: 12
  },
  escrowTitle: { fontWeight: "900", color: "#92400e", fontSize: 14 },
  escrowText: { marginTop: 4, color: "#78350f", fontWeight: "600", fontSize: 12, lineHeight: 18 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { color: "#64748b", fontWeight: "600", fontSize: 14 },
  summaryValue: { color: "#1f2c29", fontWeight: "700", fontSize: 14 },
  summaryBold: { fontWeight: "900", color: "#1f2c29", fontSize: 16 },
  summaryHi: { color: CTA_GREEN },
  summaryDivider: { height: 1, backgroundColor: BORDER, marginVertical: 10 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: BORDER
  },
  checkoutCta: {
    backgroundColor: CTA_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  checkoutCtaText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
