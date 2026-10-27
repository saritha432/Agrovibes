import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { LocationMapPicker } from "../../components/LocationMapPicker";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { useAndroidNestedStackBack } from "../../navigation/useAndroidScreenBack";
import { createRazorpayOrder, verifyRazorpayPayment } from "../../services/api";
import { addCustomerBooking } from "../../services/providerWorkflow";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { saveCustomerRentalBooking, uploadCustomerBookings } from "./customerRentalBookings";
import { BookingDateField } from "./BookingDateField";
import { catalogItemById } from "./rentalCatalog";

type PayMethod = "card" | "upi" | "netbanking";

const METHODS: Array<{ id: PayMethod; label: string; hint: string }> = [
  { id: "card", label: "Card", hint: "Debit or credit card" },
  { id: "upi", label: "UPI", hint: "Any UPI app" },
  { id: "netbanking", label: "Net banking", hint: "Bank transfer" }
];

function rupee(n: number) {
  return "\u20B9" + Math.round(n).toLocaleString("en-IN");
}

function checkoutHtml(keyId: string, orderId: string, amountPaise: number, method: PayMethod) {
  const key = JSON.stringify(keyId);
  const order = JSON.stringify(orderId);
  const payMethod = JSON.stringify(method);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;background:#262626;">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
(function(){
  var method = ${payMethod};
  var options = {
    key: ${key},
    amount: ${amountPaise},
    currency: "INR",
    order_id: ${order},
    name: "Cropvibe",
    description: "Rental booking",
    theme: { color: "#C9FF35" },
    config: {
      display: {
        blocks: {
          pay: {
            name: "Pay for this booking",
            instruments: [{ method: method }]
          }
        },
        sequence: ["block.pay"],
        preferences: { show_default_blocks: false }
      }
    },
    handler: function (response) {
      if (window.ReactNativeWebView) {
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
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ t: "dismiss" }));
      }
    }
  };
  var rzp = new Razorpay(options);
  rzp.on("payment.failed", function (resp) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        t: "fail",
        err: (resp.error && resp.error.description) || "Payment failed"
      }));
    }
  });
  rzp.open();
})();
</script></body></html>`;
}

export function RentalCartScreen() {
  useAndroidNestedStackBack();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "RentalCart">>();
  const { user, token } = useAuth();
  const item = route.params;
  const cover = catalogItemById(item.listingId);
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const rate = Math.max(0, Number(item.unitPrice) || 0);
  const listRate = Math.max(rate, Number(item.mrp) || 0);
  const subtotal = rate * quantity;
  const discount = Math.max(0, listRate * quantity - subtotal);
  const amountPaise = Math.round(subtotal * 100);
  const [place, setPlace] = useState(item.location);
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLng, setPlaceLng] = useState<number | null>(null);
  const [mapMode, setMapMode] = useState<"current" | "manual" | null>(null);
  const [method, setMethod] = useState<PayMethod>("upi");
  const [date, setDate] = useState("");
  const [phase, setPhase] = useState<"review" | "paying" | "done" | "error">("review");
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [keyId, setKeyId] = useState("");
  const [mock, setMock] = useState(false);

  const savePaidBooking = async (paymentId: string) => {
    const when = date.trim() || "As booked";
    const title = `${item.title} · ${item.option} × ${quantity}`;
    await saveCustomerRentalBooking({
      listingId: item.listingId,
      title,
      category: item.category,
      location: place,
      date: when,
      note: `Paid ${rupee(subtotal)} by ${method}. Ref ${paymentId}`
    });
    await addCustomerBooking({
      listingId: item.listingId,
      listingTitle: title,
      customerName: user?.fullName?.trim() || "Customer",
      customerPhone: user?.phone?.trim() || "",
      bookingDate: when,
      startTime: "",
      endTime: "",
      duration: item.option,
      pickupLocation: place,
      notes: `Paid ${rupee(subtotal)} by ${method}. Ref ${paymentId}`
    });
    await uploadCustomerBookings(token);
    setPhase("done");
  };

  const startPayment = async () => {
    if (date.trim().length < 4) {
      setError("Enter the date you need it.");
      return;
    }
    if (amountPaise < 100) {
      setError("This booking amount is too small to pay online.");
      return;
    }
    setError("");
    setPhase("paying");
    try {
      const created = await createRazorpayOrder({
        amountPaise,
        receipt: `rent_${item.listingId}`.slice(0, 40)
      });
      setMock(Boolean(created.mock));
      setKeyId(created.keyId);
      setOrderId(created.order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payment.");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (Platform.OS !== "web" || phase !== "paying" || mock || !orderId || !keyId) return;
    const page = globalThis as {
      Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void };
      document?: { getElementById: (id: string) => unknown; createElement: (tag: string) => { id: string; src: string; async: boolean; onload: () => void }; body?: { appendChild: (node: unknown) => void } };
    };
    const open = () => {
      if (!page.Razorpay) return;
      const checkout = new page.Razorpay({
        key: keyId,
        amount: amountPaise,
        currency: "INR",
        order_id: orderId,
        name: "Cropvibe",
        description: "Rental booking",
        theme: { color: "#C9FF35" },
        config: {
          display: {
            blocks: { pay: { name: "Pay for this booking", instruments: [{ method }] } },
            sequence: ["block.pay"],
            preferences: { show_default_blocks: false }
          }
        },
        handler(response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          void verifyRazorpayPayment(response)
            .then(() => savePaidBooking(response.razorpay_payment_id))
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Payment could not be confirmed.");
              setPhase("error");
            });
        },
        modal: { ondismiss: () => setPhase("review") }
      });
      checkout.on("payment.failed", (resp) => {
        setError(resp?.error?.description || "Payment failed");
        setPhase("error");
      });
      checkout.open();
    };
    if (page.document?.getElementById("rzp-checkout-sdk") && page.Razorpay) {
      open();
      return;
    }
    const script = page.document?.createElement("script");
    if (!script || !page.document?.body) return;
    script.id = "rzp-checkout-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = open;
    page.document.body.appendChild(script);
  }, [amountPaise, keyId, method, mock, orderId, phase]);

  const onGatewayMessage = async (raw: string) => {
    try {
      const message = JSON.parse(raw) as {
        t?: string;
        err?: string;
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
      };
      if (message.t === "dismiss") {
        setPhase("review");
        return;
      }
      if (message.t === "fail") {
        setError(message.err || "Payment failed");
        setPhase("error");
        return;
      }
      if (message.t === "ok" && message.razorpay_order_id && message.razorpay_payment_id && message.razorpay_signature) {
        await verifyRazorpayPayment({
          razorpay_order_id: message.razorpay_order_id,
          razorpay_payment_id: message.razorpay_payment_id,
          razorpay_signature: message.razorpay_signature
        });
        await savePaidBooking(message.razorpay_payment_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be confirmed.");
      setPhase("error");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={APP_TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>View Cart</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.split}>
          <View style={styles.pricePane}>
            <Text style={styles.paneTitle}>Pricing</Text>
            <PriceRow label="Rate" value={`${rupee(rate)}/${item.unitLabel}`} />
            <PriceRow label="Quantity" value={String(quantity)} />
            <PriceRow label="Option" value={item.option} />
            {discount > 0 ? <PriceRow label="Discount" value={`− ${rupee(discount)}`} /> : null}
            <View style={styles.rule} />
            <PriceRow label="To pay" value={rupee(subtotal)} strong />
          </View>
          <View style={styles.productPane}>
            {cover ? <Image source={cover.image} style={styles.photo} resizeMode="cover" /> : <View style={styles.photo} />}
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.productMeta}>{item.category}</Text>
            <Text style={styles.productMeta}>{place}</Text>
            <Text style={styles.productMeta}>
              {quantity} × {item.option}
            </Text>
          </View>
        </View>

        <Text style={styles.paneTitle}>Location</Text>
        <View style={styles.placeCard}>
          <Ionicons name="location-sharp" size={18} color={APP_LIME} />
          <Text style={styles.placeText}>{place}</Text>
        </View>
        <View style={styles.placeActions}>
          <Pressable style={styles.placeBtn} onPress={() => setMapMode("current")}>
            <Text style={styles.placeBtnText}>Current location</Text>
          </Pressable>
          <Pressable style={styles.placeBtn} onPress={() => setMapMode("manual")}>
            <Text style={styles.placeBtnText}>Add manually</Text>
          </Pressable>
        </View>

        <BookingDateField value={date} onChange={setDate} />

        <Text style={styles.paneTitle}>Payment</Text>
        {METHODS.map((choice) => {
          const on = method === choice.id;
          return (
            <Pressable key={choice.id} style={[styles.method, on ? styles.methodOn : null]} onPress={() => setMethod(choice.id)}>
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? APP_LIME : APP_TEXT_MUTED} />
              <View>
                <Text style={styles.methodLabel}>{choice.label}</Text>
                <Text style={styles.productMeta}>{choice.hint}</Text>
              </View>
            </Pressable>
          );
        })}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {phase === "done" ? (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={28} color={APP_LIME} />
            <Text style={styles.productTitle}>Payment received</Text>
            <Text style={styles.productMeta}>
              {item.title} is booked for {date.trim()} in {place}.
            </Text>
          </View>
        ) : null}

        {phase === "paying" && !orderId ? (
          <ActivityIndicator color={APP_LIME} style={{ marginTop: 16 }} />
        ) : null}

        {phase === "paying" && orderId && mock ? (
          <View style={styles.done}>
            <Text style={styles.productMeta}>
              Razorpay keys are not set on the server, so this stays in test mode. Card, UPI, and net banking open once the keys are added.
            </Text>
            <Pressable
              style={styles.payBtn}
              onPress={() => {
                void verifyRazorpayPayment({
                  razorpay_order_id: orderId,
                  razorpay_payment_id: `pay_mock_${Date.now()}`,
                  razorpay_signature: "mock"
                }).then(() => savePaidBooking("test"));
              }}
            >
              <Text style={styles.payText}>Complete test payment</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === "paying" && orderId && !mock && Platform.OS !== "web" ? (
          <View style={styles.gateway}>
            <WebView
              source={{ html: checkoutHtml(keyId, orderId, amountPaise, method) }}
              onMessage={(event) => void onGatewayMessage(event.nativeEvent.data)}
              originWhitelist={["*"]}
              javaScriptEnabled
              setSupportMultipleWindows={false}
            />
          </View>
        ) : null}

        {phase === "review" || phase === "error" ? (
          <Pressable style={styles.payBtn} onPress={() => void startPayment()}>
            <Text style={styles.payText}>Proceed to payment</Text>
            <Text style={styles.payHint}>{METHODS.find((choice) => choice.id === method)?.label}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <LocationMapPicker
        open={mapMode !== null}
        mode={mapMode || "auto"}
        label={place}
        lat={placeLat}
        lng={placeLng}
        onClose={() => setMapMode(null)}
        onSelect={(value) => {
          setPlace(value.label);
          setPlaceLat(value.lat);
          setPlaceLng(value.lng);
          setMapMode(null);
        }}
      />
    </SafeAreaView>
  );
}

function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceValue, strong ? styles.priceStrong : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "800" },
  body: { padding: 16, paddingBottom: 32 },
  split: { flexDirection: "row", gap: 10, marginBottom: 16 },
  pricePane: { flex: 1, backgroundColor: APP_SURFACE, borderRadius: 14, padding: 12 },
  productPane: { flex: 1.15, backgroundColor: APP_SURFACE, borderRadius: 14, padding: 10 },
  paneTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  priceRow: { marginBottom: 8 },
  priceLabel: { color: APP_TEXT_MUTED, fontSize: 11, fontWeight: "700" },
  priceValue: { color: APP_TEXT, fontSize: 13, fontWeight: "700", marginTop: 2 },
  priceStrong: { color: APP_LIME, fontSize: 18, fontWeight: "800" },
  rule: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 6 },
  photo: { width: "100%", height: 110, borderRadius: 10, backgroundColor: "#173024", marginBottom: 8 },
  productTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "800" },
  productMeta: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 3 },
  placeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: APP_SURFACE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  placeText: { color: APP_TEXT, fontSize: 14, fontWeight: "700", flex: 1 },
  placeActions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  placeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.45)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  placeBtnText: { color: APP_LIME, fontSize: 13, fontWeight: "800" },
  input: {
    backgroundColor: APP_SURFACE,
    color: APP_TEXT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: APP_SURFACE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent"
  },
  methodOn: { borderColor: APP_LIME },
  methodLabel: { color: APP_TEXT, fontSize: 14, fontWeight: "800" },
  error: { color: "#ffb4b4", marginTop: 8 },
  payBtn: {
    marginTop: 14,
    backgroundColor: APP_LIME,
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 12
  },
  payText: { color: APP_TEXT_ON_LIME, fontSize: 16, fontWeight: "800" },
  payHint: { color: APP_TEXT_ON_LIME, fontSize: 12, fontWeight: "600" },
  done: { marginTop: 14, backgroundColor: APP_SURFACE, borderRadius: 14, padding: 14 },
  gateway: { height: 460, marginTop: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#111" }
});
