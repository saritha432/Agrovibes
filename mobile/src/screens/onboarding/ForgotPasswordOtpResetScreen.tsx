import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { resetPasswordWithOtp, sendPhoneOtp } from "../../services/api";
import { useLanguage } from "../../localization/LanguageContext";

const GREEN = "#b9f530";
const BG = "#1d2126";
const CARD = "#252a30";
const BORDER = "#3a424c";

export function ForgotPasswordOtpResetScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ForgotPasswordOtp">>();
  const { t } = useLanguage();

  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");
  const [countdown, setCountdown] = React.useState(30);
  const [resending, setResending] = React.useState(false);

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const submit = async () => {
    if (loading) return;
    setErrorText("");

    const digits = code.replace(/\D/g, "").slice(0, 6);
    if (digits.length !== 6) {
      setErrorText("Enter a valid 6-digit OTP");
      return;
    }
    if (newPassword.length < 6) {
      setErrorText("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorText("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithOtp({
        phone: route.params.phone,
        code: digits,
        newPassword: newPassword.trim()
      });
      navigation.goBack();
    } catch (e: any) {
      setErrorText(e?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    setErrorText("");
    try {
      await sendPhoneOtp({ phone: route.params.phone });
      setCountdown(30);
    } catch (e: any) {
      setErrorText(e?.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>6 Digit Code</Text>
        <Text style={styles.subtitle}>
          Reset password for {route.params.phone}{"\n"}
          Use static OTP: 123456
        </Text>

        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="OTP"
          placeholderTextColor="#7f8b93"
          style={styles.input}
        />

        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder={t("newPassword")}
          placeholderTextColor="#7f8b93"
          secureTextEntry
          style={[styles.input, styles.spaced]}
        />

        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t("confirmPassword")}
          placeholderTextColor="#7f8b93"
          secureTextEntry
          style={[styles.input, styles.spaced]}
        />

        <Pressable style={[styles.primaryBtn, loading ? styles.disabled : null]} onPress={submit} disabled={loading}>
          <Text style={styles.primaryBtnText}>{loading ? "Resetting..." : t("resetPassword")}</Text>
        </Pressable>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={styles.resendRow}>
          <Text style={styles.hintText}>{countdown > 0 ? `Resend in ${countdown}s` : "Resend the code?"}</Text>
          <Pressable onPress={resendOtp} disabled={resending || countdown > 0}>
            <Text style={[styles.resendText, resending || countdown > 0 ? styles.disabledText : null]}>
              {resending ? "Sending..." : "Resend"}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.goBack()} style={styles.backPill}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 52 },
  card: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16
  },
  title: { color: GREEN, fontWeight: "900", fontSize: 22, marginBottom: 6 },
  subtitle: { color: "#909ba4", fontWeight: "600", fontSize: 12, marginBottom: 16 },
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
  spaced: { marginTop: 12 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  primaryBtnText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 },
  disabled: { opacity: 0.55 },
  errorText: { marginTop: 10, color: "#ff6b6b", fontSize: 12, fontWeight: "700" },
  resendRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hintText: { color: "#8b98a1", fontWeight: "700", fontSize: 11 },
  resendText: { color: GREEN, fontWeight: "900", fontSize: 11 },
  disabledText: { opacity: 0.6 },
  backPill: {
    marginTop: "auto",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#232930"
  },
  backText: { color: "#d8dde3", fontWeight: "700", fontSize: 12 }
});

