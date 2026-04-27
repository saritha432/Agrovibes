import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useAuth } from "../../auth/AuthContext";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { sendPhoneOtp, verifyPhoneOtp } from "../../services/api";

export function OtpVerifyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "OtpVerify">>();
  const { signIn } = useAuth();
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [countdown, setCountdown] = React.useState(30);

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
      if (auth.isNewUser) {
        navigation.reset({ index: 0, routes: [{ name: "PersonalInfo" }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
      }
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

  return (
    <OnboardingLayout
      title="Verify mobile"
      subtitle={`Enter the 6-digit code sent to ${route.params.phone}.`}
      primaryLabel={loading ? "Verifying..." : "Verify & continue"}
      onPrimary={submit}
      primaryDisabled={code.replace(/\D/g, "").length !== 6 || loading}
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.label}>OTP</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="••••••"
        placeholderTextColor="#c5cdca"
        style={styles.input}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.resendRow}>
        <Text style={styles.hintText}>Didn&apos;t receive code?</Text>
        <Pressable onPress={resendOtp} disabled={resending || countdown > 0}>
          <Text style={[styles.resendText, resending || countdown > 0 ? styles.disabledText : null]}>
            {countdown > 0 ? `Resend in ${countdown}s` : resending ? "Sending..." : "Resend OTP"}
          </Text>
        </Pressable>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "900", color: "#22312d", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#dce3e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 6,
    fontWeight: "800",
    color: "#111616",
    textAlign: "center"
  },
  hintText: { color: "#5b6966", fontWeight: "700" },
  resendRow: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resendText: { color: "#0a9f46", fontWeight: "900" },
  disabledText: { opacity: 0.6 },
  errorText: { marginTop: 8, color: "#b42318", fontSize: 12, fontWeight: "700" }
});
