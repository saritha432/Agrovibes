import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { fetchProviderDigilockerResult, startProviderDigilocker } from "../services/api";
import { getProviderRegistrationDraft, updateProviderRegistrationDraft } from "../services/providerWorkflow";

export function ProviderKycVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const { token } = useAuth();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const registrationType =
    route.params?.registrationType === "business" ? "business" : "individual";

  const [starting, setStarting] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [error, setError] = useState("");
  const [kycStatus, setKycStatus] = useState<"idle" | "pending" | "verified" | "failed">("idle");
  const [result, setResult] = useState<{ name: string; maskedAadhaar: string; dob: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void (async () => {
      const draft = await getProviderRegistrationDraft();
      if (draft?.digilockerVerified && draft.aadhaarName) {
        setKycStatus("verified");
        setResult({
          name: draft.aadhaarName,
          maskedAadhaar: draft.aadhaarMasked || "Verified",
          dob: ""
        });
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const readResult = async (activeSessionId: string) => {
    if (!token || !activeSessionId) return;
    try {
      const next = await fetchProviderDigilockerResult(token, activeSessionId);
      if (next.status === "failed") {
        stopPolling();
        setGatewayUrl("");
        setKycStatus("failed");
        setError(next.message || "DigiLocker verification failed.");
        return;
      }
      if (next.status !== "verified" || !next.name) {
        setKycStatus("pending");
        return;
      }
      stopPolling();
      setGatewayUrl("");
      setKycStatus("verified");
      setResult({
        name: next.name,
        maskedAadhaar: next.maskedAadhaar || "Verified",
        dob: next.dob || ""
      });
      await updateProviderRegistrationDraft({
        digilockerVerified: true,
        aadhaarName: next.name,
        aadhaarMasked: next.maskedAadhaar || "",
        panMatched: false,
        bankVerified: false
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read DigiLocker result.");
    }
  };

  const startLogin = async () => {
    if (starting || kycStatus === "verified") return;
    if (!token) {
      setError("Please sign in again, then continue with DigiLocker.");
      return;
    }
    setStarting(true);
    setError("");
    setResult(null);
    setKycStatus("idle");
    try {
      const draft = await getProviderRegistrationDraft();
      const started = await startProviderDigilocker(token, {
        fullName: draft?.fullName,
        phone: draft?.phone
      });
      setKycStatus("pending");
      setGatewayUrl(started.gatewayUrl);
      stopPolling();
      pollRef.current = setInterval(() => {
        void readResult(started.sessionId);
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start DigiLocker.");
    } finally {
      setStarting(false);
    }
  };

  const badge = kycStatus === "failed" ? "Failed" : "Pending";
  const aadhaarDone = Boolean(result);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Provider Verification</Text>
            <View style={[styles.badge, kycStatus === "failed" && styles.badgeFailed]}>
              <Text style={[styles.badgeText, kycStatus === "failed" && styles.badgeTextFailed]}>{badge}</Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <Text style={styles.stepTitle}>Aadhaar Verification</Text>
            <Text style={styles.stepCount}>Step 1 of 3</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, aadhaarDone && styles.trackFillDone]} />
          </View>

          <View style={styles.identityRow}>
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
            <Text style={styles.identityTitle}>Verify your identity</Text>
          </View>
          <Text style={styles.identitySub}>
            Securely verify your Aadhaar using DigiLocker to continue provider registration.
          </Text>

          <Pressable
            style={[styles.primaryBtn, (starting || aadhaarDone) && styles.primaryBtnBusy]}
            disabled={starting || aadhaarDone}
            onPress={() => {
              void startLogin();
            }}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {aadhaarDone ? "Aadhaar Verified" : "Verify with DigiLocker"}
              </Text>
            )}
          </Pressable>

          <View style={styles.outcomeRow}>
            <Ionicons
              name={aadhaarDone ? "checkmark-circle" : "ellipse-outline"}
              size={18}
              color={aadhaarDone ? GREEN : "#9aa0a6"}
            />
            <View style={styles.outcomeCopy}>
              <Text style={styles.outcomeText}>After successful verification: Aadhaar Verified</Text>
              {result ? (
                <Text style={styles.outcomeMeta}>
                  {result.name}
                  {result.maskedAadhaar ? ` · ${result.maskedAadhaar}` : ""}
                </Text>
              ) : null}
            </View>
          </View>

          <Pressable
            style={styles.outcomeRow}
            disabled={!aadhaarDone}
            onPress={() => {
              navigation.navigate("ProviderPanVerification", { track, registrationType });
            }}
          >
            <Ionicons name="ellipse-outline" size={18} color="#9aa0a6" />
            <Text style={[styles.outcomeText, aadhaarDone && styles.outcomeLink]}>
              Next: PAN and Bank Account Verification
            </Text>
          </Pressable>

          {kycStatus === "failed" ? (
            <Text style={styles.error}>{error || "DigiLocker did not share Aadhaar. You can try again."}</Text>
          ) : null}
          {error && kycStatus !== "failed" ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>

      <Modal visible={Boolean(gatewayUrl)} animationType="slide" onRequestClose={() => setGatewayUrl("")}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalBar}>
            <Pressable
              onPress={() => {
                setGatewayUrl("");
              }}
              hitSlop={12}
            >
              <Text style={styles.modalClose}>Close</Text>
            </Pressable>
            <Text style={styles.modalTitle}>DigiLocker</Text>
            <View style={{ width: 48 }} />
          </View>
          {gatewayUrl ? (
            <WebView
              source={{ uri: gatewayUrl }}
              style={styles.web}
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const GREEN = "#1B8A43";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  topBar: { paddingHorizontal: 12, paddingVertical: 8 },
  page: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e8eb",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  cardTitle: { color: "#1a1a1a", fontSize: 16, fontWeight: "700" },
  badge: {
    backgroundColor: "#f8e6d4",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  badgeFailed: { backgroundColor: "#fde2e2" },
  badgeText: { color: "#c56a1a", fontSize: 12, fontWeight: "700" },
  badgeTextFailed: { color: "#c24141" },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  stepTitle: { color: "#1a1a1a", fontSize: 15, fontWeight: "700" },
  stepCount: { color: "#8b9198", fontSize: 12 },
  track: { height: 4, borderRadius: 4, backgroundColor: "#e6e8eb", marginBottom: 16, overflow: "hidden" },
  trackFill: { width: "34%", height: 4, borderRadius: 4, backgroundColor: GREEN },
  trackFillDone: { width: "34%" },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  identityTitle: { color: "#1a1a1a", fontSize: 14, fontWeight: "700" },
  identitySub: { color: "#6b7280", fontSize: 13, lineHeight: 18, marginBottom: 16, marginLeft: 26 },
  primaryBtn: {
    backgroundColor: GREEN,
    borderRadius: 8,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  primaryBtnBusy: { opacity: 0.85 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  outcomeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  outcomeCopy: { flex: 1 },
  outcomeText: { color: "#3f3f46", fontSize: 13, lineHeight: 18, flex: 1 },
  outcomeLink: { color: GREEN, fontWeight: "700" },
  outcomeMeta: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  error: { color: "#c24141", fontSize: 13, marginTop: 4 },
  modal: { flex: 1, backgroundColor: "#111" },
  modalBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  modalTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  modalClose: { color: "#C9FF35", fontSize: 15, fontWeight: "700" },
  web: { flex: 1, backgroundColor: "#fff" }
});
