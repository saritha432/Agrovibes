import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage, type AppLanguage } from "../../localization/LanguageContext";
import { markLaunchSetupComplete } from "../../onboarding/launchSetup";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { authLogin, authRegister } from "../../services/api";
import { APP_BLACK, APP_LIME, APP_SURFACE } from "../../theme/appColors";

const GREEN = APP_LIME;
const BG = APP_BLACK;
const CARD = APP_SURFACE;
const BORDER = "#3a3a3a";

/** Match backend + register: last 10 digits for @phone.agrovibes (handles +91 / leading 0). */
function resolvePhoneEmailLocalPart(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

/** Try multiple identifier formats so users can login with just phone number. */
function buildLoginIdentifiers(raw: string): string[] {
  const base = raw.trim().toLowerCase();
  if (!base) return [];
  const candidates = [base];
  const digits = base.replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    candidates.push(last10);
    candidates.push(`+91${last10}`);
    candidates.push(`${last10}@phone.agrovibes`);
  }
  return [...new Set(candidates)];
}

export function AuthChoiceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AuthChoice">>();
  const { signIn } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const initialMode = route.params?.initialMode === "login" ? "login" : "register";
  const [mode, setMode] = React.useState<"register" | "login">(initialMode);
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");

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
          : await (async () => {
              const candidates = buildLoginIdentifiers(digits);
              let lastError: any = null;
              for (const identifierCandidate of candidates) {
                try {
                  return await authLogin({
                    identifier: identifierCandidate,
                    password: password.trim()
                  });
                } catch (error: any) {
                  lastError = error;
                  if (error?.status !== 401) throw error;
                }
              }
              throw lastError || new Error("Failed to login. Please try again.");
            })();
      await signIn(auth);
      if (mode === "login" && auth?.user?.id != null) {
        await markLaunchSetupComplete(auth.user.id);
      }
      navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
    } catch (error: any) {
      setErrorText(mode === "register" ? error?.message || "Failed to create account. Please try again." : error?.message || "Failed to login. Please try again.");
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

      <View style={styles.langRow}>
        {(["English", "Hindi", "Telugu"] as AppLanguage[]).map((lang) => (
          <Pressable
            key={lang}
            style={[styles.langChip, language === lang ? styles.langChipActive : null]}
            onPress={() => setLanguage(lang)}
          >
            <Text style={[styles.langChipText, language === lang ? styles.langChipTextActive : null]}>{lang}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.modeSegment}>
        <Pressable
          style={[styles.modeSegmentBtn, mode === "register" ? styles.modeSegmentBtnActive : null]}
          onPress={() => {
            setMode("register");
            setErrorText("");
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
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={mode === "login" ? t("loginMobilePlaceholder") : t("mobilePlaceholder")}
            placeholderTextColor="#7f8b93"
            style={[styles.input, styles.rowInput]}
            maxLength={10}
          />
        </View>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t("passwordPlaceholder")}
          placeholderTextColor="#7f8b93"
          style={[styles.input, styles.spaced]}
          secureTextEntry
        />
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
          {mode === "register" ? "Already registered users can switch to login." : "Use the same mobile number used while registering."}
        </Text>
      </View>
      {Platform.OS === "ios" ? <View style={styles.bottomHomeBar} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 48 },
  header: { marginBottom: 14 },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 14 },
  langChip: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: APP_SURFACE
  },
  langChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  langChipText: { color: "#9aa5ad", fontSize: 11, fontWeight: "800" },
  langChipTextActive: { color: "#1b1f23" },
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
