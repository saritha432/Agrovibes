import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { RentalText as Text, rentalType } from "./rentalTypography";
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
import { useUserLocation } from "../../location/UserLocationContext";
import { useRentalCart } from "./RentalCartContext";
import { RENTAL_CART_MAX_QTY, rentalLineKey, type RentalCartLine } from "./rentalCart";

type PayMethod = "card" | "upi" | "netbanking";

const METHODS: Array<{ id: PayMethod; label: string; hint: string }> = [
  { id: "card", label: "Card", hint: "Debit or credit card" },
  { id: "upi", label: "UPI", hint: "Any UPI app" },
  { id: "netbanking", label: "Net banking", hint: "Bank transfer" }
];

function rupee(n: number) {
  return "\u20B9" + Math.round(n).toLocaleString("en-IN");
}

function lineKey(line: RentalCartLine) {
  return rentalLineKey(line.listingId, line.option);
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
  const { lines, setQuantity, clearCart, refreshFromServer } = useRentalCart();
  const { label: savedLabel, lat: savedLat, lng: savedLng, saveLocation } = useUserLocation();
  const routePlace = route.params?.location && route.params.location !== "Add location" ? route.params.location : "";
  const [place, setPlace] = useState(routePlace || savedLabel);
  const [placeLat, setPlaceLat] = useState<number | null>(savedLat);
  const [placeLng, setPlaceLng] = useState<number | null>(savedLng);
  const [mapMode, setMapMode] = useState<"current" | "manual" | null>(null);
  const [method, setMethod] = useState<PayMethod>("upi");
  const [date, setDate] = useState("");
  const [phase, setPhase] = useState<"review" | "paying" | "done" | "error">("review");
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [keyId, setKeyId] = useState("");
  const [mock, setMock] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshFromServer();
    }, [refreshFromServer])
  );

  useEffect(() => {
    if ((!place || place === "Add location") && savedLabel && savedLabel !== "Add location") {
      setPlace(savedLabel);
      setPlaceLat(savedLat);
      setPlaceLng(savedLng);
    }
  }, [place, savedLabel, savedLat, savedLng]);

  const itemTotal = lines.reduce((sum, line) => sum + line.mrp * line.quantity, 0);
  const toPay = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = Math.max(0, itemTotal - toPay);
  const amountPaise = Math.round(toPay * 100);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const changeQty = (line: RentalCartLine, nextQty: number) => {
    setQuantity(line.listingId, line.option, nextQty);
  };

  const savePaidBooking = async (paymentId: string) => {
    const when = date.trim() || "As booked";
    for (const line of lines) {
      const title = `${line.title} · ${line.option} × ${line.quantity}`;
      const paid = line.unitPrice * line.quantity;
      await saveCustomerRentalBooking({
        listingId: line.listingId,
        title,
        category: line.category,
        location: place,
        date: when,
        note: `Paid ${rupee(paid)} by ${method}. Ref ${paymentId}`
      });
      await addCustomerBooking({
        listingId: line.listingId,
        listingTitle: title,
        customerName: user?.fullName?.trim() || "Customer",
        customerPhone: user?.phone?.trim() || "",
        bookingDate: when,
        startTime: "",
        endTime: "",
        duration: line.option,
        pickupLocation: place,
        notes: `Paid ${rupee(paid)} by ${method}. Ref ${paymentId}`
      });
    }
    await uploadCustomerBookings(token);
    await clearCart();
    setPhase("done");
  };

  const startPayment = async () => {
    if (!lines.length) {
      setError("Your cart is empty.");
      return;
    }
    if (place.trim().length < 3 || place === "Add location") {
      setError("Add the place where you need this.");
      return;
    }
    if (date.trim().length < 4) {
      setError("Choose the date you need it.");
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
        receipt: `rent_${lines[0].listingId}`.slice(0, 40)
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
      Razorpay?: new (options: Record<string, unknown>) => {
        open: () => void;
        on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
      };
      document?: {
        getElementById: (id: string) => unknown;
        createElement: (tag: string) => { id: string; src: string; async: boolean; onload: () => void };
        body?: { appendChild: (node: unknown) => void };
      };
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
        <Text style={styles.headerTitle}>Cart</Text>
        <Text style={styles.headerCount}>{itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.paneTitle}>Deliver to</Text>
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

        <Text style={styles.paneTitle}>Your items</Text>
        {lines.length === 0 ? <Text style={styles.empty}>Your cart is empty. Add a rental, then open the cart again.</Text> : null}
        {lines.map((line) => {
          const cover = catalogItemById(line.listingId);
          return (
            <View key={lineKey(line)} style={styles.item}>
              {cover ? <Image source={cover.image} style={styles.photo} resizeMode="cover" /> : <View style={styles.photo} />}
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {line.title}
                </Text>
                <Text style={styles.itemMeta}>
                  {line.category} · {line.option}
                </Text>
                <View style={styles.itemFoot}>
                  <View>
                    <Text style={styles.itemPrice}>{rupee(line.unitPrice * line.quantity)}</Text>
                    {line.mrp > line.unitPrice ? <Text style={styles.itemMrp}>{rupee(line.mrp * line.quantity)}</Text> : null}
                  </View>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => changeQty(line, line.quantity - 1)} hitSlop={8} accessibilityLabel="Decrease">
                      <Text style={styles.stepGlyph}>−</Text>
                    </Pressable>
                    <Text style={styles.stepCount}>{line.quantity}</Text>
                    <Pressable
                      onPress={() => changeQty(line, Math.min(RENTAL_CART_MAX_QTY, line.quantity + 1))}
                      hitSlop={8}
                      accessibilityLabel="Increase"
                      disabled={line.quantity >= RENTAL_CART_MAX_QTY}
                    >
                      <Text style={styles.stepGlyph}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        {lines.length > 0 ? (
          <View style={styles.bill}>
            <Text style={styles.paneTitle}>Bill details</Text>
            <BillRow label="Item total" value={rupee(itemTotal)} />
            {discount > 0 ? <BillRow label="Discount" value={`− ${rupee(discount)}`} /> : null}
            <View style={styles.rule} />
            <BillRow label="To pay" value={rupee(toPay)} strong />
          </View>
        ) : null}

        <BookingDateField value={date} onChange={setDate} />

        <Text style={styles.paneTitle}>Payment</Text>
        {METHODS.map((choice) => {
          const on = method === choice.id;
          return (
            <Pressable key={choice.id} style={[styles.method, on ? styles.methodOn : null]} onPress={() => setMethod(choice.id)}>
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? APP_LIME : APP_TEXT_MUTED} />
              <View>
                <Text style={styles.methodLabel}>{choice.label}</Text>
                <Text style={styles.itemMeta}>{choice.hint}</Text>
              </View>
            </Pressable>
          );
        })}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {phase === "done" ? (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={28} color={APP_LIME} />
            <Text style={styles.itemTitle}>Payment received</Text>
            <Text style={styles.itemMeta}>
              Booked for {date.trim()} in {place}.
            </Text>
          </View>
        ) : null}

        {phase === "paying" && !orderId ? <ActivityIndicator color={APP_LIME} style={{ marginTop: 16 }} /> : null}

        {phase === "paying" && orderId && mock ? (
          <View style={styles.done}>
            <Text style={styles.itemMeta}>
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
      </ScrollView>
      {lines.length > 0 && (phase === "review" || phase === "error") ? (
        <Pressable style={styles.payBar} onPress={() => void startPayment()}>
          <Text style={styles.payText}>Proceed to pay</Text>
          <Text style={styles.payText}>{rupee(toPay)}</Text>
        </Pressable>
      ) : null}
      <LocationMapPicker
        open={mapMode !== null}
        mode={mapMode || "auto"}
        label={place === "Add location" ? "" : place}
        lat={placeLat}
        lng={placeLng}
        onClose={() => setMapMode(null)}
        onSelect={(value) => {
          setPlace(value.label);
          setPlaceLat(value.lat);
          setPlaceLng(value.lng);
          void saveLocation({ label: value.label, lat: value.lat, lng: value.lng }).catch(() => undefined);
          setMapMode(null);
        }}
      />
    </SafeAreaView>
  );
}

function BillRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Text style={styles.billLabel}>{label}</Text>
      <Text style={[styles.billValue, strong ? styles.billStrong : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { color: APP_TEXT, flex: 1, ...rentalType(18, "800") },
  headerCount: { color: APP_TEXT_MUTED, ...rentalType(13, "700") },
  body: { padding: 16, paddingBottom: 28 },
  paneTitle: { color: APP_TEXT, marginBottom: 8, ...rentalType(16, "800") },
  placeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: APP_SURFACE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  placeText: { color: APP_TEXT, flex: 1, ...rentalType(14, "700") },
  placeActions: { flexDirection: "row", gap: 8, marginBottom: 18 },
  placeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.45)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  placeBtnText: { color: APP_LIME, ...rentalType(13, "800") },
  empty: { color: APP_TEXT_MUTED, marginBottom: 16, lineHeight: 20 },
  item: { flexDirection: "row", gap: 12, backgroundColor: APP_SURFACE, borderRadius: 14, padding: 10, marginBottom: 10 },
  photo: { width: 84, height: 84, borderRadius: 10, backgroundColor: "#173024" },
  itemBody: { flex: 1 },
  itemTitle: { color: APP_TEXT, ...rentalType(15, "800") },
  itemMeta: { color: APP_TEXT_MUTED, marginTop: 3, ...rentalType(12, "400") },
  itemFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  itemPrice: { color: APP_TEXT, ...rentalType(15, "800") },
  itemMrp: { color: APP_TEXT_MUTED, textDecorationLine: "line-through", marginTop: 2, ...rentalType(12, "400") },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: APP_LIME,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  stepGlyph: { color: APP_LIME, ...rentalType(18, "800") },
  stepCount: { color: APP_TEXT, minWidth: 12, textAlign: "center", ...rentalType(14, "800") },
  bill: { backgroundColor: APP_SURFACE, borderRadius: 14, padding: 12, marginTop: 6, marginBottom: 16 },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  billLabel: { color: APP_TEXT_MUTED, ...rentalType(13, "400") },
  billValue: { color: APP_TEXT, ...rentalType(13, "700") },
  billStrong: { color: APP_LIME, ...rentalType(16, "800") },
  rule: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 8 },
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
  methodLabel: { color: APP_TEXT, ...rentalType(14, "800") },
  error: { color: "#ffb4b4", marginTop: 8 },
  payBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: APP_LIME,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  payText: { color: APP_TEXT_ON_LIME, ...rentalType(16, "800") },
  done: { marginTop: 14, backgroundColor: APP_SURFACE, borderRadius: 14, padding: 14 },
  gateway: { height: 460, marginTop: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#111" },
  payBtn: {
    marginTop: 14,
    backgroundColor: APP_LIME,
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 12
  }
});
