import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { APP_LIME } from "../theme/appColors";
import { verifyProviderPan } from "../services/api";
import { getProviderRegistrationDraft, updateProviderRegistrationDraft } from "../services/providerWorkflow";
import {
  PROVIDER_CARD,
  PROVIDER_MUTED,
  PROVIDER_TEXT,
  ProviderContinueButton,
  ProviderFormHeader,
  ProviderStepBar,
  providerFormStyles as pf
} from "./provider/providerFormUi";

function normalizePan(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function gstOk(value: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.trim().toUpperCase());
}

export function ProviderPanVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const { token } = useAuth();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const registrationType =
    route.params?.registrationType === "business" ? "business" : "individual";

  const [pan, setPan] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [match, setMatch] = useState<{ panName: string; aadhaarName: string; matched: boolean } | null>(null);
  const [gst, setGst] = useState("");

  useEffect(() => {
    void getProviderRegistrationDraft().then((draft) => {
      if (draft?.gstNumber) setGst(draft.gstNumber);
      if (draft?.panMatched && draft.panName) {
        setMatch({ panName: draft.panName, aadhaarName: draft.fullName || "", matched: true });
      }
    });
  }, []);

  const panOk = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
  const dobOk = /^\d{4}-\d{2}-\d{2}$/.test(dob) || /^\d{2}\/\d{2}\/\d{4}$/.test(dob);
  const formOk = panOk && fullName.trim().length > 2 && dobOk;

  const onVerify = async () => {
    if (!formOk || checking) return;
    if (!token) {
      setError("Please sign in again, then verify PAN.");
      return;
    }
    setChecking(true);
    setError("");
    setMatch(null);
    try {
      const result = await verifyProviderPan(token, { panNumber: pan, fullName: fullName.trim(), dob });
      setMatch({ panName: result.panName, aadhaarName: result.aadhaarName, matched: result.matched });
      await updateProviderRegistrationDraft({
        panNumber: result.pan,
        panName: result.panName,
        panMatched: result.matched,
        bankVerified: false
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify PAN.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={pf.screen} edges={["top", "bottom"]}>
      <ProviderFormHeader onBack={() => navigation.goBack()} />
      <ProviderStepBar currentStep={3} registrationType="business" />

      <ScrollView
        style={pf.scroll}
        contentContainerStyle={pf.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>PAN or GST</Text>
        <Text style={styles.sub}>Verify PAN, or enter a GST number. Bank details are not required.</Text>

        <Text style={pf.fieldLabel}>PAN Number</Text>
        <TextInput
          style={pf.input}
          value={pan}
          onChangeText={(value) => {
            setPan(normalizePan(value));
            setMatch(null);
            setError("");
          }}
          placeholder="ABCDE1234F"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="characters"
          maxLength={10}
        />
        <Text style={pf.fieldLabel}>Full Name</Text>
        <TextInput
          style={pf.input}
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            setMatch(null);
            setError("");
          }}
          placeholder="Name as on PAN"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="words"
        />
        <Text style={pf.fieldLabel}>DOB</Text>
        <TextInput
          style={pf.input}
          value={dob}
          onChangeText={(value) => {
            setDob(value);
            setMatch(null);
            setError("");
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={PROVIDER_MUTED}
        />

        <Pressable
          style={[styles.primaryBtn, (!formOk || checking) && styles.primaryBtnDisabled]}
          disabled={!formOk || checking}
          onPress={() => {
            void onVerify();
          }}
        >
          {checking ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[styles.primaryBtnText, !formOk && styles.primaryBtnTextDisabled]}>Submit</Text>
          )}
        </Pressable>

        {match ? (
          <View style={styles.resultCard}>
            <Ionicons
              name={match.matched ? "checkmark-circle" : "close-circle"}
              size={28}
              color={match.matched ? APP_LIME : "#ff8d8d"}
            />
            <Text style={styles.resultTitle}>{match.matched ? "Identity matched" : "Name does not match"}</Text>
            <Text style={styles.resultMeta}>PAN name</Text>
            <Text style={styles.resultLine}>{match.panName}</Text>
            <Text style={styles.resultMeta}>Aadhaar name</Text>
            <Text style={styles.resultLine}>{match.aadhaarName}</Text>
          </View>
        ) : null}

        <Text style={pf.fieldLabel}>GST Number</Text>
        <TextInput
          style={pf.input}
          value={gst}
          onChangeText={(value) => setGst(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))}
          placeholder="22AAAAA0000A1Z5"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="characters"
          maxLength={15}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ProviderContinueButton
        disabled={!match?.matched && !gstOk(gst)}
        onPress={() => {
          const nextGst = gst.trim().toUpperCase();
          if (nextGst && !gstOk(nextGst)) {
            setError("Enter a valid GST number, or leave it blank when PAN is verified.");
            return;
          }
          void updateProviderRegistrationDraft({ gstNumber: nextGst }).then(() => {
            navigation.navigate("ProviderVerification", { track, registrationType });
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { color: APP_LIME, fontSize: 28, fontWeight: "800", marginBottom: 6 },
  sub: { color: PROVIDER_MUTED, fontSize: 13, marginBottom: 18 },
  primaryBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 8,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  primaryBtnDisabled: { backgroundColor: PROVIDER_CARD },
  primaryBtnText: { color: "#000", fontSize: 14, fontWeight: "800" },
  primaryBtnTextDisabled: { color: PROVIDER_MUTED },
  resultCard: {
    backgroundColor: PROVIDER_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.28)",
    padding: 16,
    alignItems: "center",
    gap: 2
  },
  resultTitle: { color: PROVIDER_TEXT, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  resultMeta: { color: PROVIDER_MUTED, fontSize: 11, fontWeight: "700", marginTop: 6 },
  resultLine: { color: PROVIDER_TEXT, fontSize: 15, fontWeight: "700" },
  error: { color: "#ff8d8d", fontSize: 13, marginTop: 8 }
});
