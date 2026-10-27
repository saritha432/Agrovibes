import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../auth/AuthContext";
import { submitListingForApproval } from "../../../services/providerWorkflow";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";

const RC_PATTERN = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

export function ProviderTractorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [hp, setHp] = useState("");
  const [rate, setRate] = useState("");
  const [rc, setRc] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const rcNumber = rc.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (name.trim().length < 2 || !RC_PATTERN.test(rcNumber)) {
      Alert.alert("Tractor details", "Enter the tractor name and a registration number such as TS09AB1234.");
      return;
    }
    setBusy(true);
    try {
      await submitListingForApproval({
        title: name.trim(),
        category: [hp.trim() ? `Tractor ${hp.trim()} HP` : "Tractor", rate.trim() ? `Rs ${rate.trim()}/day` : ""].filter(Boolean).join(" · "),
        channel: "Rental",
        rcNumber,
        token
      });
      Alert.alert("RC submitted", "The tractor and RC number were sent for review. This is not marked verified until admin checks the RC.", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert("Could not add tractor", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Add tractor</Text>
        <Text style={styles.sub}>Tractor details and RC number. The RC is submitted for review, not auto-approved.</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tractor name" placeholderTextColor={APP_TEXT_MUTED} />
        <TextInput style={styles.input} value={hp} onChangeText={setHp} placeholder="HP" placeholderTextColor={APP_TEXT_MUTED} keyboardType="number-pad" />
        <TextInput style={styles.input} value={rate} onChangeText={setRate} placeholder="Daily rate" placeholderTextColor={APP_TEXT_MUTED} keyboardType="number-pad" />
        <TextInput
          style={styles.input}
          value={rc}
          onChangeText={(value) => setRc(value.toUpperCase())}
          placeholder="RC number"
          placeholderTextColor={APP_TEXT_MUTED}
          autoCapitalize="characters"
        />
        <Pressable style={styles.button} disabled={busy} onPress={() => void save()}>
          <Text style={styles.buttonText}>{busy ? "Submitting…" : "Submit RC for review"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1a1a1a" },
  body: { padding: 16 },
  title: { color: APP_TEXT, fontSize: 28, fontWeight: "800" },
  sub: { color: APP_TEXT_MUTED, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  input: { backgroundColor: "#2b2c2e", color: APP_TEXT, borderRadius: 10, padding: 14, marginBottom: 10 },
  button: { backgroundColor: APP_LIME, borderRadius: 12, alignItems: "center", paddingVertical: 14, marginTop: 8 },
  buttonText: { color: "#111", fontWeight: "800" }
});
