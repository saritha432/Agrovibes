import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { sendPhoneOtp, verifyPhoneOtp } from "../../services/api";

const GREEN = "#b9f530";
const BG = "#1d2126";
const CARD = "#252a30";
const BORDER = "#3a424c";

export function OtpVerifyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "OtpVerify">>();
  const { signIn } = useAuth();
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [countdown, setCountdown] = React.useState(30);
  const otpInputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const submit = async () => {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6 || loading) return;
    const phone = route.params.phone;
    setLoading(true);
    setError("");
    try {
      const auth = await verifyPhoneOtp({ phone, code: digits });
      await signIn({ token: auth.token, user: auth.user });
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (e: any) {
      setError(e?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    setError("");
    try {
      await sendPhoneOtp({ phone: route.params.phone });
      setCountdown(30);
    } catch (e: any) {
      setError(e?.message || "Failed to resend OTP.");
    } finally {
      setResending(false);
    }
  };

  const digitsOnly = code.replace(/\D/g, "").slice(0, 6);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>6 Digit Code</Text>
      <Text style={styles.subtitle}>Please enter the verification code sent to {route.params.phone}</Text>

      <Pressable onPress={() => navigation.goBack()} style={styles.backPill}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Pressable style={styles.codeRow} onPress={() => otpInputRef.current?.focus()}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`otp-${i}`} style={[styles.codeCell, digitsOnly[i] ? styles.codeCellFilled : null]}>
            <Text style={styles.codeDigit}>{digitsOnly[i] || ""}</Text>
          </View>
        ))}
      </Pressable>

      <TextInput
        ref={otpInputRef}
        value={digitsOnly}
        onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        style={styles.hiddenInput}
      />

      <Pressable onPress={submit} style={[styles.verifyBtn, digitsOnly.length !== 6 || loading ? styles.disabledBtn : null]}>
        <Text style={styles.verifyText}>{loading ? "Verifying..." : "Verify & Continue"}</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.resendRow}>
        <Text style={styles.hintText}>Resend the code?</Text>
        <Pressable onPress={resendOtp} disabled={resending || countdown > 0}>
          <Text style={[styles.resendText, resending || countdown > 0 ? styles.disabledText : null]}>
            {countdown > 0 ? `${countdown}s` : resending ? "Sending..." : "Resend"}
          </Text>
        </Pressable>
      </View>
      {Platform.OS === "ios" ? <View style={styles.bottomHomeBar} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 52 },
  title: { color: GREEN, fontWeight: "900", fontSize: 24, letterSpacing: -0.2 },
  subtitle: { marginTop: 8, color: "#909ba4", fontWeight: "600", fontSize: 12 },
  backPill: {
    marginTop: 16,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: CARD
  },
  backText: { color: "#c9d2d8", fontSize: 11, fontWeight: "700" },
  codeRow: { marginTop: 18, flexDirection: "row", gap: 8 },
  codeCell: {
    width: 44,
    height: 46,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center"
  },
  codeCellFilled: { borderColor: GREEN },
  codeDigit: { color: "#eef4f8", fontWeight: "900", fontSize: 18 },
  hiddenInput: { opacity: 0, height: 0, width: 0 },
  verifyBtn: {
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  disabledBtn: { opacity: 0.55 },
  verifyText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 },
  hintText: { color: "#8b98a1", fontWeight: "700" },
  resendRow: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resendText: { color: GREEN, fontWeight: "900" },
  disabledText: { opacity: 0.6 },
  errorText: { marginTop: 10, color: "#ff6b6b", fontSize: 12, fontWeight: "700" },
  bottomHomeBar: {
    marginTop: "auto",
    alignSelf: "center",
    width: 58,
    height: 3,
    borderRadius: 3,
    backgroundColor: GREEN,
    marginBottom: 12
  }
});
