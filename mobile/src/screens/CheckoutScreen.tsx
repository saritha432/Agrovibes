import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MarketStackParamList } from "../navigation/MarketStackNavigator";
import { createRazorpayOrder, verifyRazorpayPayment } from "../services/api";
import { useCart } from "../cart/CartContext";

const CTA_GREEN = "#2d6a4f";
const BG = "#fdf7f2";
const BORDER = "#e8e2d9";

type Nav = NativeStackNavigationProp<MarketStackParamList, "Checkout">;
type RRoute = RouteProp<MarketStackParamList, "Checkout">;

function rupee(n: number) {
  return "\u20B9" + Math.round(n).toLocaleString("en-IN");
}

function buildRazorpayHtml(keyId: string, orderId: string, amountPaise: number) {
  const k = JSON.stringify(keyId);
  const oid = JSON.stringify(orderId);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;background:#fdf7f2;">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
(function(){
  var options = {
    key: ${k},
    amount: ${amountPaise},
    currency: "INR",
    order_id: ${oid},
    name: "Agrovibes",
    description: "Agri market order",
    theme: { color: "${CTA_GREEN}" },
    handler: function (response) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          t: "ok",
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        }));
      }
    },
    modal: {
      ondismiss: function () {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ t: "dismiss" }));
        }
      }
    }
  };
  var rzp = new Razorpay(options);
  rzp.on("payment.failed", function (resp) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        t: "fail",
        err: (resp.error && resp.error.description) || "Payment failed"
      }));
    }
  });
  rzp.open();
})();
</script>
</body></html>`;
}

export function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RRoute>();
  const { clearCart } = useCart();
  const { amountPaise, receipt, bill, appliedCouponLabel } = route.params;

  const [phase, setPhase] = useState<"loading" | "pay" | "done" | "error">(
    amountPaise <= 0 ? "pay" : "loading"
  );
  const [error, setError] = useState("");
  const [keyId, setKeyId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [isMock, setIsMock] = useState(false);
  const webOpened = useRef(false);
  const payingRef = useRef(false);

  const finishSuccess = useCallback(async () => {
    setPhase("done");
    clearCart();
    Alert.alert("Order placed", "Thank you! Your payment was successful.", [
      { text: "OK", onPress: () => navigation.popToTop() }
    ]);
  }, [clearCart, navigation]);

  const verifyAndFinish = useCallback(
    async (body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
      try {
        await verifyRazorpayPayment(body);
        await finishSuccess();
      } catch (e: any) {
        setError(e?.message || "Verification failed");
        setPhase("error");
      }
    },
    [finishSuccess]
  );

  useEffect(() => {
    if (amountPaise <= 0) {
      setPhase("pay");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await createRazorpayOrder({ amountPaise, receipt });
        if (cancelled) return;
        setIsMock(Boolean((res as any).mock));
        setKeyId(res.keyId);
        setOrderId(res.order.id);
        setPhase("pay");
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Could not start payment");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amountPaise, receipt]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (phase !== "pay" || amountPaise <= 0) return;
    if (!keyId || !orderId || webOpened.current) return;
    if (isMock) return;
    webOpened.current = true;
    const w = globalThis as any;
    const start = () => {
      const Rzp = w.Razorpay;
      if (!Rzp) return;
      payingRef.current = true;
      const rzp = new Rzp({
        key: keyId,
        amount: amountPaise,
        currency: "INR",
        order_id: orderId,
        name: "Agrovibes",
        description: "Agri market order",
        theme: { color: CTA_GREEN },
        handler(response: any) {
          payingRef.current = false;
          verifyAndFinish({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });
        },
        modal: {
          ondismiss() {
            payingRef.current = false;
          }
        }
      });
      rzp.on("payment.failed", (resp: any) => {
        payingRef.current = false;
        setError(resp?.error?.description || "Payment failed");
        setPhase("error");
      });
      rzp.open();
    };
    const existing = w.document?.getElementById?.("rzp-checkout-sdk");
    if (existing && w.Razorpay) {
      start();
      return;
    }
    const script = w.document?.createElement?.("script");
    if (!script) return;
    script.id = "rzp-checkout-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = start;
    w.document?.body?.appendChild?.(script);
  }, [phase, amountPaise, keyId, orderId, isMock, verifyAndFinish]);

  const onWebViewMessage = async (raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.t === "ok") {
        await verifyAndFinish({
          razorpay_order_id: msg.razorpay_order_id,
          razorpay_payment_id: msg.razorpay_payment_id,
          razorpay_signature: msg.razorpay_signature
        });
      } else if (msg.t === "fail") {
        setError(msg.err || "Payment failed");
        setPhase("error");
      } else if (msg.t === "dismiss") {
        /* user closed sheet */
      }
    } catch {
      /* ignore */
    }
  };

  const mockPay = async () => {
    if (!orderId) return;
    await verifyAndFinish({
      razorpay_order_id: orderId,
      razorpay_payment_id: `pay_mock_${Date.now()}`,
      razorpay_signature: "mock"
    });
  };

  const walletOnlyConfirm = async () => {
    await finishSuccess();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1f2c29" />
        </Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {phase === "loading" ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={CTA_GREEN} />
            <Text style={styles.hint}>Preparing secure payment…</Text>
          </View>
        ) : null}

        {phase === "error" ? (
          <View style={styles.card}>
            <Text style={styles.errTitle}>Payment could not start</Text>
            <Text style={styles.errBody}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => navigation.goBack()}>
              <Text style={styles.retryText}>Back to cart</Text>
            </Pressable>
          </View>
        ) : null}

        {(phase === "pay" || phase === "done") && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bill details</Text>
              <Row label="Subtotal" value={rupee(bill.subtotal)} />
              {bill.discount > 0 ? <Row label="Coupon discount" value={`− ${rupee(bill.discount)}`} accent /> : null}
              <Row label="Delivery" value={bill.delivery === 0 ? "FREE" : rupee(bill.delivery)} />
              <Row label="Platform fee (2%)" value={rupee(bill.platformFee)} />
              <Row label="GST (18% on fee)" value={rupee(bill.gstOnFee)} />
              {bill.walletApplied > 0 ? <Row label="AgroWallet" value={`− ${rupee(bill.walletApplied)}`} accent /> : null}
              {appliedCouponLabel ? (
                <Text style={styles.couponNote}>Coupon: {appliedCouponLabel}</Text>
              ) : null}
              <View style={styles.divider} />
              <Row label="To pay" value={rupee(bill.total)} bold />
            </View>

            {amountPaise <= 0 ? (
              <Pressable style={styles.cta} onPress={walletOnlyConfirm}>
                <Text style={styles.ctaText}>Confirm order</Text>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              </Pressable>
            ) : isMock ? (
              <View style={styles.mockBox}>
                <Text style={styles.mockTitle}>Test mode</Text>
                <Text style={styles.mockText}>
                  Razorpay keys are not set on the server. Use the button below to simulate a successful payment (development only).
                </Text>
                <Pressable style={styles.cta} onPress={mockPay}>
                  <Text style={styles.ctaText}>Simulate successful payment</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </Pressable>
              </View>
            ) : Platform.OS === "web" ? (
              <Text style={styles.webHint}>Complete payment in the Razorpay window. If it did not open, refresh and try again.</Text>
            ) : (
              <View style={styles.webWrap}>
                <WebView
                  source={{ html: buildRazorpayHtml(keyId, orderId, amountPaise) }}
                  onMessage={(e) => onWebViewMessage(e.nativeEvent.data)}
                  style={styles.webview}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  setSupportMultipleWindows={false}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowBold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold, accent && styles.rowAccent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center"
  },
  title: { fontSize: 18, fontWeight: "800", color: "#1f2c29" },
  scroll: { paddingHorizontal: 12, paddingTop: 8 },
  centerBox: { paddingVertical: 40, alignItems: "center", gap: 12 },
  hint: { color: "#64748b", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 16
  },
  cardTitle: { fontWeight: "900", color: "#1f2c29", marginBottom: 12, fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  rowLabel: { color: "#64748b", fontWeight: "600", fontSize: 14 },
  rowValue: { color: "#1f2c29", fontWeight: "700", fontSize: 14 },
  rowBold: { fontWeight: "900", color: "#1f2c29", fontSize: 16 },
  rowAccent: { color: CTA_GREEN },
  couponNote: { marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: "600" },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 12 },
  cta: {
    backgroundColor: CTA_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  ctaText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  mockBox: { gap: 12, marginBottom: 16 },
  mockTitle: { fontWeight: "900", color: "#b45309", fontSize: 15 },
  mockText: { color: "#64748b", lineHeight: 20, fontWeight: "600" },
  webWrap: { height: 420, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: BORDER },
  webview: { flex: 1, backgroundColor: "transparent" },
  webHint: { textAlign: "center", color: "#64748b", fontWeight: "600", padding: 16 },
  errTitle: { fontWeight: "900", color: "#b91c1c", fontSize: 16 },
  errBody: { marginTop: 8, color: "#64748b", fontWeight: "600", lineHeight: 20 },
  retry: {
    marginTop: 16,
    alignSelf: "flex-start",
    backgroundColor: CTA_GREEN,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12
  },
  retryText: { color: "#fff", fontWeight: "800" }
});
