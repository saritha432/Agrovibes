import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../localization/LanguageContext";
import { markLaunchSetupComplete } from "../../onboarding/launchSetup";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { authLogin, authRegister, formatAuthError } from "../../services/api";
import { APP_BLACK, APP_LIME, APP_SURFACE } from "../../theme/appColors";

const GREEN = APP_LIME;
const BG = APP_BLACK;
const CARD = APP_SURFACE;
const BORDER = "#3a3a3a";

/** Digits only; autocomplete with +91 keeps the last 10 (local) digits. */
function sanitizeIndianMobileInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > 10) return digits.slice(-10);
  return digits.slice(0, 10);
}

/** Match backend + register: last 10 digits for @phone.agrovibes (handles +91 / leading 0). */
function resolvePhoneEmailLocalPart(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

export function AuthChoiceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AuthChoice">>();
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const initialMode = route.params?.initialMode === "login" ? "login" : "register";
  const [mode, setMode] = React.useState<"register" | "login">(initialMode);
  const [loginPhone, setLoginPhone] = React.useState(() => {
    const preset = route.params?.loginPhone;
    if (!preset) return "";
    const digits = preset.replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  });
  const [successText, setSuccessText] = React.useState(
    route.params?.passwordResetSuccess ? t("passwordResetSuccessMessage") : ""
  );
  const [loginPassword, setLoginPassword] = React.useState("");
  const [registerPhone, setRegisterPhone] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.initialMode === "login") setMode("login");
      if (route.params?.passwordResetSuccess) {
        setSuccessText(t("passwordResetSuccessMessage"));
        setMode("login");
      }
      const preset = route.params?.loginPhone;
      if (preset) {
        const digits = preset.replace(/\D/g, "");
        if (digits.length >= 10) setLoginPhone(digits.slice(-10));
      }
    }, [route.params?.initialMode, route.params?.loginPhone, route.params?.passwordResetSuccess, t])
  );

  const phone = mode === "login" ? loginPhone : registerPhone;
  const setPhoneRaw = mode === "login" ? setLoginPhone : setRegisterPhone;
  const password = mode === "login" ? loginPassword : registerPassword;
  const setPasswordRaw = mode === "login" ? setLoginPassword : setRegisterPassword;

  const onPhoneChange = (raw: string) => {
    setErrorText("");
    setPhoneRaw(sanitizeIndianMobileInput(raw));
  };

  const onPasswordChange = (raw: string) => {
    setErrorText("");
    setPasswordRaw(raw);
  };

  const submit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (password.trim().length < 6 || loadingSubmit) return;
    if (mode === "register" && (!fullName.trim() || !username.trim())) return;
    if (digits.length < 10) return;
    setLoadingSubmit(true);
    setErrorText("");
    try {
      const phoneLocal = resolvePhoneEmailLocalPart(digits);
      const syntheticEmail = `${phoneLocal}@phone.agrovibes`;
      const auth =
        mode === "register"
          ? await authRegister({
              email: syntheticEmail,
              password: password.trim(),
              fullName: fullName.trim(),
              role: "student",
              username: username.trim(),
              phone: `+91${phoneLocal}`
            })
          : await authLogin({
              identifier: syntheticEmail,
              password: password.trim()
            });
      await signIn(auth);
      if (mode === "login" && auth?.user?.id != null) {
        await markLaunchSetupComplete(auth.user.id);
      }
      navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
    } catch (error: unknown) {
      setErrorText(
        mode === "register"
          ? formatAuthError(error, "Failed to create account. Please try again.")
          : formatAuthError(error, "Failed to login. Please try again.")
      );
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.label}>{mode === "register" ? t("createAccount") : t("login")}</Text>
        <Text style={styles.subtag}>
          {mode === "register" ? t("createSubtitle") : t("loginSubtitle")}
        </Text>
      </View>


      <View style={styles.modeSegment}>
        <Pressable
          style={[styles.modeSegmentBtn, mode === "register" ? styles.modeSegmentBtnActive : null]}
          onPress={() => {
            setMode("register");
            setErrorText("");
            setSuccessText("");
          }}
        >
          <Text style={[styles.modeSegmentText, mode === "register" ? styles.modeSegmentTextActive : null]}>{t("getStarted")}</Text>
        </Pressable>
        <Pressable
          style={[styles.modeSegmentBtn, mode === "login" ? styles.modeSegmentBtnActive : null]}
          onPress={() => {
            setMode("login");
            setErrorText("");
          }}
        >
          <Text style={[styles.modeSegmentText, mode === "login" ? styles.modeSegmentTextActive : null]}>{t("login")}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {successText ? <Text style={styles.successBanner}>{successText}</Text> : null}
        {mode === "register" ? (
          <>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder={t("name")}
              placeholderTextColor="#7f8b93"
              style={styles.input}
            />
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder={t("username")}
              placeholderTextColor="#7f8b93"
              style={[styles.input, styles.spaced]}
              autoCapitalize="none"
            />
          </>
        ) : null}
        <View style={styles.row}>
          <View style={styles.countryTag}>
            <Text style={styles.countryText}>🇮🇳 +91</Text>
          </View>
          <TextInput
            value={phone}
            onChangeText={onPhoneChange}
            keyboardType="number-pad"
            placeholder={mode === "login" ? t("loginMobilePlaceholder") : t("mobilePlaceholder")}
            placeholderTextColor="#7f8b93"
            style={[styles.input, styles.rowInput]}
            maxLength={10}
            autoComplete="tel-national"
            textContentType="telephoneNumber"
          />
        </View>
        <View style={[styles.passwordRow, styles.spaced]}>
          <TextInput
            value={password}
            onChangeText={onPasswordChange}
            placeholder={t("passwordPlaceholder")}
            placeholderTextColor="#7f8b93"
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={styles.passwordEyeBtn}
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          >
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9aa5ad" />
          </Pressable>
        </View>
        <Pressable
          onPress={submit}
          style={[
            styles.primaryBtn,
            password.trim().length < 6 ||
            phone.replace(/\D/g, "").length < 10 ||
            (mode === "register" && (!fullName.trim() || !username.trim())) ||
            loadingSubmit
              ? styles.disabled
              : null
          ]}
        >
          <Text style={styles.primaryBtnText}>{loadingSubmit ? "Submitting..." : mode === "register" ? t("submit") : t("login")}</Text>
        </Pressable>

        {mode === "login" ? (
          <Pressable
            onPress={() => navigation.navigate("ForgotPassword")}
            style={styles.forgotPasswordLink}
          >
            <Text style={styles.forgotPasswordText}>{t("forgotPasswordLink")}</Text>
          </Pressable>
        ) : null}

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        <Text style={styles.helperText}>
          {mode === "register" ? t("registerHelper") : t("loginHelper")}
        </Text>
      </View>
      {Platform.OS === "ios" ? <View style={styles.bottomHomeBar} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 48 },
  header: { marginBottom: 14 },
  modeSegment: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: APP_SURFACE
  },
  modeSegmentBtn: { flex: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  modeSegmentBtnActive: { backgroundColor: GREEN },
  modeSegmentText: { color: "#9aa5ad", fontWeight: "800", fontSize: 13 },
  modeSegmentTextActive: { color: "#1b1f23" },
  label: { color: GREEN, fontWeight: "900", fontSize: 24, letterSpacing: -0.2 },
  subtag: { marginTop: 8, color: "#909ba4", fontWeight: "600", fontSize: 12 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16
  },
  countryTag: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: APP_SURFACE
  },
  countryText: { color: "#d6dde2", fontWeight: "700", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
    color: "#eef4f8",
    backgroundColor: APP_SURFACE
  },
  spaced: { marginTop: 10 },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: APP_SURFACE
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
  row: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 10 },
  rowInput: { flex: 1, minWidth: 0 },
  primaryBtn: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12
  },
  forgotPasswordLink: { marginTop: 10, alignSelf: "center" },
  forgotPasswordText: { color: "#8bc76f", fontWeight: "800", fontSize: 12 },
  disabled: { opacity: 0.55 },
  primaryBtnText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 },
  helperText: { marginTop: 10, color: "#8b98a1", fontSize: 11, fontWeight: "600" },
  errorText: { marginTop: 10, color: "#ff6b6b", fontSize: 12, fontWeight: "700" },
  successBanner: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: "rgba(198, 255, 0, 0.12)",
    color: GREEN,
    fontSize: 12,
    fontWeight: "700"
  },
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
