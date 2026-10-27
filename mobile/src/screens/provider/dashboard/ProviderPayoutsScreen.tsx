import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../auth/AuthContext";
import { createProviderRazorpayAccount } from "../../../services/api";
import { getProviderRegistrationDraft, updateProviderRegistrationDraft } from "../../../services/providerWorkflow";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";

export function ProviderPayoutsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const link = async () => {
    if (!token) return;
    const draft = await getProviderRegistrationDraft();
    if (!draft?.bankVerified || !draft.accountNumber || !draft.ifsc || !draft.holderName) {
      Alert.alert("Bank account", "Verify the bank account, IFSC, and account holder before linking Razorpay.");
      navigation.navigate("ProviderBankDetails", { purpose: "payouts" });
      return;
    }
    const street = draft.street || draft.village;
    const city = draft.district || draft.village;
    if (!draft.email || !street || !city || !draft.state || postalCode.replace(/\D/g, "").length !== 6) {
      Alert.alert("Account details", "Email, address, and a 6-digit PIN code are required. Razorpay is not linked until it accepts them.");
      return;
    }
    setBusy(true);
    try {
      const result = await createProviderRazorpayAccount(token, {
        accountNumber: draft.accountNumber,
        ifsc: draft.ifsc,
        holderName: draft.holderName,
        email: draft.email,
        phone: draft.phone,
        businessName: draft.businessName || draft.fullName,
        street,
        city,
        state: draft.state,
        postalCode: postalCode.replace(/\D/g, "")
      });
      if (!result.linked || !result.accountId) {
        setNote(result.message || "Razorpay did not link an account.");
        return;
      }
      await updateProviderRegistrationDraft({ razorpayAccountId: result.accountId });
      Alert.alert("Razorpay linked", "This provider account can receive payouts.", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Razorpay is not ready.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.body}>
        <Text style={styles.title}>Receive payments</Text>
        <Text style={styles.sub}>
          Payouts use the verified bank account. Razorpay is linked only after it accepts that account.
        </Text>
        <TextInput
          style={styles.input}
          value={postalCode}
          onChangeText={setPostalCode}
          placeholder="PIN code"
          placeholderTextColor={APP_TEXT_MUTED}
          keyboardType="number-pad"
          maxLength={6}
        />
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Pressable style={styles.button} disabled={busy} onPress={() => void link()}>
          <Text style={styles.buttonText}>{busy ? "Contacting Razorpay…" : "Set up Razorpay account"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1a1a1a" },
  body: { padding: 16 },
  title: { color: APP_TEXT, fontSize: 28, fontWeight: "800" },
  sub: { color: APP_TEXT_MUTED, marginTop: 8, lineHeight: 20 },
  input: { backgroundColor: "#2b2c2e", color: APP_TEXT, borderRadius: 10, padding: 14, marginTop: 16 },
  note: { color: "#ffb4b4", marginTop: 14 },
  button: { backgroundColor: APP_LIME, borderRadius: 12, alignItems: "center", paddingVertical: 14, marginTop: 20 },
  buttonText: { color: "#111", fontWeight: "800" }
});
