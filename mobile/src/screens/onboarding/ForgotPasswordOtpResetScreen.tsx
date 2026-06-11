import React from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { resetToLoginAfterPasswordReset } from "../../navigation/navigationRef";
import { resetPasswordWithOtp, sendPhoneOtp } from "../../services/api";
import { useLanguage } from "../../localization/LanguageContext";
import { APP_LIME } from "../../theme/appColors";

const GREEN = APP_LIME;
const BG = "#262626";
const CARD = "#252a30";
const BORDER = "#3a424c";
const ERROR = "#ff6b6b";
const STATIC_OTP_HINT = "525252";

function normalizePhoneForApi(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return last10.length === 10 ? `+91${last10}` : phone.trim();
}

function phoneDigitsForLogin(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function goToLoginAfterReset(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  loginPhone: string
) {
  const params = {
    initialMode: "login" as const,
    passwordResetSuccess: true,
    loginPhone
  };
  if (resetToLoginAfterPasswordReset(loginPhone)) return;
  navigation.reset({
    index: 0,
    routes: [{ name: "AuthChoice", params }]
  });
}

export function ForgotPasswordOtpResetScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ForgotPasswordOtp">>();
  const { t } = useLanguage();
  const apiPhone = React.useMemo(() => normalizePhoneForApi(route.params.phone), [route.params.phone]);

  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");
  const [otpError, setOtpError] = React.useState("");
  const [newPasswordError, setNewPasswordError] = React.useState("");
  const [confirmPasswordError, setConfirmPasswordError] = React.useState("");
  const [countdown, setCountdown] = React.useState(30);
  const [resending, setResending] = React.useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = React.useState(false);
  const [pendingLoginPhone, setPendingLoginPhone] = React.useState("");

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const clearFieldErrors = () => {
    setErrorText("");
    setOtpError("");
    setNewPasswordError("");
    setConfirmPasswordError("");
  };

  const validate = () => {
    clearFieldErrors();

    const digits = code.replace(/\D/g, "").slice(0, 6);
    let valid = true;

    if (digits.length !== 6) {
      setOtpError("Enter a valid 6-digit OTP");
      valid = false;
    }
    if (!newPassword.trim()) {
      setNewPasswordError("New password is required");
      valid = false;
    } else if (newPassword.length < 6) {
      setNewPasswordError("Password must be at least 6 characters");
      valid = false;
    }
    if (!confirmPassword.trim()) {
      setConfirmPasswordError("Confirm password is required");
      valid = false;
    } else if (newPassword.length >= 6 && newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      valid = false;
    }

    return valid;
  };

  const submit = async () => {
    if (loading) return;
    if (!validate()) return;

    const digits = code.replace(/\D/g, "").slice(0, 6);
    setLoading(true);
    try {
      await resetPasswordWithOtp({
        phone: apiPhone,
        code: digits,
        newPassword: newPassword.trim()
      });
      setPendingLoginPhone(phoneDigitsForLogin(apiPhone));
      setShowSuccessPopup(true);
    } catch (e: any) {
      const message = String(e?.message || "Failed to reset password");
      if (/otp expired/i.test(message) && digits === STATIC_OTP_HINT) {
        setErrorText(
          "Static OTP was rejected by the server. Deploy the latest backend to Render, or set STATIC_OTP_CODE=525252 in Render env."
        );
      } else {
        setErrorText(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    clearFieldErrors();
    try {
      await sendPhoneOtp({ phone: apiPhone });
      setCountdown(30);
    } catch (e: any) {
      setErrorText(e?.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  const dismissSuccessPopup = () => {
    const loginPhone = pendingLoginPhone;
    setShowSuccessPopup(false);
    setPendingLoginPhone("");
    if (loginPhone) goToLoginAfterReset(navigation, loginPhone);
  };

  return (
    <View style={styles.screen}>
      <Modal
        visible={showSuccessPopup}
        transparent
        animationType="fade"
        onRequestClose={dismissSuccessPopup}
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            <View style={styles.popupIconWrap}>
              <Ionicons name="checkmark-circle" size={44} color={GREEN} />
            </View>
            <Text style={styles.popupTitle}>{t("passwordResetSuccessTitle")}</Text>
            <Text style={styles.popupMessage}>{t("passwordResetSuccessMessage")}</Text>
            <Pressable style={styles.popupBtn} onPress={dismissSuccessPopup} accessibilityRole="button">
              <Text style={styles.popupBtnText}>{t("ok")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.card}>
        <Text style={styles.title}>6 Digit Code</Text>
        <Text style={styles.subtitle}>
          Reset password for {route.params.phone}
          {"\n"}
          Use static OTP: {STATIC_OTP_HINT}
        </Text>

        <TextInput
          value={code}
          onChangeText={(v) => {
            clearFieldErrors();
            setCode(v.replace(/\D/g, "").slice(0, 6));
          }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="OTP"
          placeholderTextColor="#7f8b93"
          style={[styles.input, otpError ? styles.inputError : null]}
        />
        {otpError ? <Text style={styles.fieldError}>{otpError}</Text> : null}

        <View style={[styles.passwordRow, styles.spaced]}>
          <TextInput
            value={newPassword}
            onChangeText={(v) => {
              clearFieldErrors();
              setNewPassword(v);
            }}
            placeholder={t("newPassword")}
            placeholderTextColor="#7f8b93"
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.passwordInput, newPasswordError ? styles.inputErrorInline : null]}
          />
          <Pressable
            style={styles.passwordEyeBtn}
            onPress={() => setShowNewPassword((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showNewPassword ? "Hide password" : "Show password"}
          >
            <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9aa5ad" />
          </Pressable>
        </View>
        {newPasswordError ? <Text style={styles.fieldError}>{newPasswordError}</Text> : null}

        <View style={[styles.passwordRow, styles.spaced]}>
          <TextInput
            value={confirmPassword}
            onChangeText={(v) => {
              clearFieldErrors();
              setConfirmPassword(v);
            }}
            placeholder={t("confirmPassword")}
            placeholderTextColor="#7f8b93"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.passwordInput, confirmPasswordError ? styles.inputErrorInline : null]}
          />
          <Pressable
            style={styles.passwordEyeBtn}
            onPress={() => setShowConfirmPassword((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
          >
            <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9aa5ad" />
          </Pressable>
        </View>
        {confirmPasswordError ? <Text style={styles.fieldError}>{confirmPasswordError}</Text> : null}

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
  inputError: { borderColor: ERROR },
  inputErrorInline: { borderColor: ERROR },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: "#20262d"
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
    color: "#eef4f8"
  },
  passwordEyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  spaced: { marginTop: 12 },
  fieldError: { marginTop: 6, color: ERROR, fontSize: 11, fontWeight: "700" },
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
  errorText: { marginTop: 10, color: ERROR, fontSize: 12, fontWeight: "700" },
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
  backText: { color: "#d8dde3", fontWeight: "700", fontSize: 12 },
  popupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  popupCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: "center"
  },
  popupIconWrap: { marginBottom: 10 },
  popupTitle: {
    color: GREEN,
    fontWeight: "900",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8
  },
  popupMessage: {
    color: "#b8c2ca",
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18
  },
  popupBtn: {
    width: "100%",
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  popupBtnText: { color: "#1b1f23", fontWeight: "900", fontSize: 14 }
});
