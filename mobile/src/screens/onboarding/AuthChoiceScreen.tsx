import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { onboardingTheme } from "../../onboarding/OnboardingLayout";
import { sendPhoneOtp } from "../../services/api";

const { GREEN, BORDER } = onboardingTheme;

function stableUserId(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 900000) + 100000;
}

export function AuthChoiceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signIn } = useAuth();
  const [phone, setPhone] = React.useState("");
  const [loadingOtp, setLoadingOtp] = React.useState(false);
  const [otpError, setOtpError] = React.useState("");

  const goOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || loadingOtp) return;
    setLoadingOtp(true);
    setOtpError("");
    try {
      const normalized = digits.length > 10 ? digits : `91${digits}`;
      const phoneForApi = `+${normalized}`;
      await sendPhoneOtp({ phone: phoneForApi });
      navigation.navigate("OtpVerify", { phone: phoneForApi });
    } catch (error: any) {
      setOtpError(error?.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoadingOtp(false);
    }
  };

  const stubSocial = async (provider: string) => {
    const email = `user.${provider.toLowerCase()}@agrovibes.app`;
    await signIn({
      token: `social-${provider.toLowerCase()}`,
      user: {
        id: stableUserId(email),
        email,
        fullName: `${provider} user`,
        role: "student"
      }
    });
    navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.logo}>Cropvibes</Text>
      <Text style={styles.tag}>Grow, learn, and trade together</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Mobile</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor="#9aa9a5"
          style={styles.input}
        />
        <Pressable
          onPress={goOtp}
          style={[styles.primaryBtn, phone.replace(/\D/g, "").length < 10 || loadingOtp ? styles.disabled : null]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>{loadingOtp ? "Sending OTP..." : "Continue with OTP"}</Text>
        </Pressable>
        {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}
        <Text style={styles.helperText}>You may receive SMS notification from us for verification.</Text>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <Pressable onPress={() => stubSocial("Google")} style={styles.outlineBtn}>
          <Ionicons name="logo-google" size={18} color="#22312d" />
          <Text style={styles.outlineBtnText}>Sign in with Google</Text>
        </Pressable>

        {Platform.OS === "ios" ? (
          <Pressable onPress={() => stubSocial("Apple")} style={styles.outlineBtn}>
            <Ionicons name="logo-apple" size={18} color="#22312d" />
            <Text style={styles.outlineBtnText}>Sign in with Apple</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => navigation.navigate("AuthEmail")} style={styles.linkRow}>
          <Ionicons name="mail-outline" size={16} color={GREEN} />
          <Text style={styles.linkText}>Use email & password instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4", paddingHorizontal: 16, paddingTop: 56 },
  logo: { fontSize: 32, fontWeight: "900", color: "#0f3d2e", textAlign: "center" },
  tag: { marginTop: 8, fontSize: 15, fontWeight: "600", color: "#5b6966", textAlign: "center" },
  card: {
    marginTop: 28,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16
  },
  sectionLabel: { fontWeight: "900", color: "#22312d", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontWeight: "700",
    color: "#111616",
    marginBottom: 12
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 14
  },
  disabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  divider: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontWeight: "700", color: "#8a9693", fontSize: 12 },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 10,
    backgroundColor: "#fafcfb"
  },
  outlineBtnText: { fontWeight: "900", color: "#22312d", fontSize: 14 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
  linkText: { fontWeight: "800", color: GREEN, fontSize: 14 },
  helperText: { marginTop: 8, color: "#7b8986", fontSize: 12, fontWeight: "600" },
  errorText: { marginTop: 8, color: "#b42318", fontSize: 12, fontWeight: "700" }
});
