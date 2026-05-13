import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { sendPhoneOtp } from "../../services/api";
import { useLanguage } from "../../localization/LanguageContext";

const GREEN = "#b9f530";
const BG = "#1d2126";
const CARD = "#252a30";
const BORDER = "#3a424c";

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const [phone, setPhone] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");

  const digits = phone.replace(/\D/g, "");

  const submit = async () => {
    if (loading) return;
    setErrorText("");
    if (digits.length < 10) {
      setErrorText("Enter a valid mobile number");
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp({ phone: phone.trim() });
      navigation.navigate("ForgotPasswordOtp", { phone: phone.trim() });
    } catch (e: any) {
      setErrorText(e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.label}>{t("forgotPassword")}</Text>
        <Text style={styles.subtag}>{t("forgotPasswordSubtitle")}</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={t("enterPhone")}
          placeholderTextColor="#7f8b93"
          style={styles.input}
          autoCapitalize="none"
        />

        <Pressable style={[styles.primaryBtn, loading ? styles.disabled : null]} onPress={submit} disabled={loading}>
          <Text style={styles.primaryBtnText}>{loading ? "Sending..." : t("sendOtp")}</Text>
        </Pressable>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
      </View>
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
  input: {
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
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12
  },
  primaryBtnText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 },
  disabled: { opacity: 0.55 },
  errorText: { marginTop: 10, color: "#ff6b6b", fontSize: 12, fontWeight: "700" }
});

