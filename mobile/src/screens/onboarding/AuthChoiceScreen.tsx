import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { sendPhoneOtp } from "../../services/api";

const GREEN = "#b9f530";
const BG = "#1d2126";
const CARD = "#252a30";
const BORDER = "#3a424c";

export function AuthChoiceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.label}>Mobile Number</Text>
        <Text style={styles.subtag}>Enter your number to continue to OTP verification</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.countryTag}>
            <Text style={styles.countryText}>🇮🇳 +91</Text>
          </View>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Enter mobile number"
            placeholderTextColor="#7f8b93"
            style={styles.input}
          />
        </View>
        <Pressable
          onPress={goOtp}
          style={[styles.primaryBtn, phone.replace(/\D/g, "").length < 10 || loadingOtp ? styles.disabled : null]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#1b1f23" />
          <Text style={styles.primaryBtnText}>{loadingOtp ? "Sending..." : "Send OTP via SMS"}</Text>
        </Pressable>
        {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}
        <Text style={styles.helperText}>A verification code will be sent to this number.</Text>
      </View>
      {Platform.OS === "ios" ? <View style={styles.bottomHomeBar} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 52 },
  header: { marginBottom: 22 },
  label: { color: GREEN, fontWeight: "900", fontSize: 24, letterSpacing: -0.2 },
  subtag: { marginTop: 8, color: "#909ba4", fontWeight: "600", fontSize: 12 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16
  },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  countryTag: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#20262d"
  },
  countryText: { color: "#d6dde2", fontWeight: "700", fontSize: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
    color: "#eef4f8",
    backgroundColor: "#20262d"
  },
  primaryBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12
  },
  disabled: { opacity: 0.55 },
  primaryBtnText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 },
  helperText: { marginTop: 10, color: "#8b98a1", fontSize: 11, fontWeight: "600" },
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
