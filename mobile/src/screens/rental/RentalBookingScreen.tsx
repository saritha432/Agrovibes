import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BookingDateField } from "./BookingDateField";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { useAndroidNestedStackBack } from "../../navigation/useAndroidScreenBack";
import { useAuth } from "../../auth/AuthContext";
import { addCustomerBooking } from "../../services/providerWorkflow";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";
import { saveCustomerRentalBooking, uploadCustomerBookings } from "./customerRentalBookings";

export function RentalBookingScreen() {
  useAndroidNestedStackBack();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, token } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, "RentalBooking">>();
  const { listingId, title, category, location } = route.params;
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const requestBooking = async () => {
    const when = date.trim();
    if (when.length < 4) return;
    setSaving(true);
    try {
      await saveCustomerRentalBooking({
        listingId,
        title,
        category,
        location,
        date: when,
        note: note.trim()
      });
      await addCustomerBooking({
        listingId,
        listingTitle: title,
        customerName: user?.fullName?.trim() || "Customer",
        customerPhone: user?.phone?.trim() || "",
        bookingDate: when,
        startTime: "",
        endTime: "",
        duration: "",
        pickupLocation: location,
        notes: note.trim()
      });
      await uploadCustomerBookings(token);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={APP_TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Check booking</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {category} · {location}
        </Text>
        {saved ? (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={28} color={APP_LIME} />
            <Text style={styles.doneTitle}>Booking requested</Text>
            <Text style={styles.doneBody}>
              {title} is requested for {date.trim()} in {location}. You can track it from Rentals.
            </Text>
          </View>
        ) : (
          <>
            <BookingDateField value={date} onChange={setDate} />
            <Text style={styles.label}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Hours, field, or how you will use it"
              placeholderTextColor={APP_TEXT_MUTED}
              style={[styles.input, styles.note]}
              multiline
            />
            <Pressable
              style={[styles.button, date.trim().length < 4 || saving ? styles.buttonOff : null]}
              disabled={date.trim().length < 4 || saving}
              onPress={() => void requestBooking()}
            >
              <Text style={styles.buttonText}>{saving ? "Saving…" : "Request booking"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "800" },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  title: { color: APP_TEXT, fontSize: 24, fontWeight: "800" },
  meta: { color: APP_LIME, fontSize: 14, fontWeight: "700", marginTop: 6, marginBottom: 18 },
  label: { color: APP_TEXT, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: APP_SURFACE,
    color: APP_TEXT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14
  },
  note: { minHeight: 88, textAlignVertical: "top" },
  button: { backgroundColor: APP_LIME, borderRadius: 12, alignItems: "center", paddingVertical: 14, marginTop: 4 },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: APP_BLACK, fontSize: 15, fontWeight: "800" },
  done: { backgroundColor: APP_SURFACE, borderRadius: 14, padding: 16 },
  doneTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "800", marginTop: 8 },
  doneBody: { color: APP_TEXT_MUTED, fontSize: 14, lineHeight: 20, marginTop: 6 }
});
