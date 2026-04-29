import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../localization/LanguageContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { authLogin, authRegister } from "../../services/api";

const GREEN = "#b9f530";
const BG = "#1d2126";
const CARD = "#252a30";
const BORDER = "#3a424c";

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
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = React.useState<"register" | "login">("register");
  const [phone, setPhone] = React.useState("");
  const [loginIdentifier, setLoginIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");

  const submit = async () => {
    const digits = phone.replace(/\D/g, "");
    const normalizedLoginIdentifier = loginIdentifier.trim();
    if (password.trim().length < 6 || loadingSubmit) return;
    if (mode === "register" && (!fullName.trim() || !username.trim())) return;
    if (mode === "register" && digits.length < 10) return;
    if (mode === "login" && !normalizedLoginIdentifier) return;
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
              const candidates = buildLoginIdentifiers(normalizedLoginIdentifier);
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
      navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
    } catch (error: any) {
      setErrorText(mode === "register" ? error?.message || "Failed to create account. Please try again." : error?.message || "Failed to login. Please try again.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "register" ? "login" : "register"));
    setErrorText("");
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.label}>{mode === "register" ? t("createAccount") : t("login")}</Text>
        <Text style={styles.subtag}>
          {mode === "register" ? t("createSubtitle") : t("loginSubtitle")}
        </Text>
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
          {mode === "register" ? (
            <>
              <View style={styles.countryTag}>
                <Text style={styles.countryText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder={t("mobilePlaceholder")}
                placeholderTextColor="#7f8b93"
                style={styles.input}
              />
            </>
          ) : (
            <TextInput
              value={loginIdentifier}
              onChangeText={setLoginIdentifier}
              placeholder="Mobile, username, or 9876543210@phone.agrovibes"
              placeholderTextColor="#7f8b93"
              style={styles.input}
              autoCapitalize="none"
            />
          )}
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
            (mode === "register" && phone.replace(/\D/g, "").length < 10) ||
            (mode === "login" && !loginIdentifier.trim()) ||
            (mode === "register" && (!fullName.trim() || !username.trim())) ||
            loadingSubmit
              ? styles.disabled
              : null
          ]}
        >
          <Text style={styles.primaryBtnText}>{loadingSubmit ? "Submitting..." : mode === "register" ? t("submit") : t("login")}</Text>
        </Pressable>
        <Pressable onPress={toggleMode} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>{mode === "register" ? t("iHaveAccount") : t("createNewAccount")}</Text>
        </Pressable>
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
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
    color: "#eef4f8",
    backgroundColor: "#20262d"
  },
  spaced: { marginTop: 10 },
  row: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 10 },
  primaryBtn: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12
  },
  secondaryBtn: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#666f7a",
    paddingVertical: 11,
    backgroundColor: "#232930"
  },
  secondaryText: { color: "#d8dde3", fontWeight: "700", fontSize: 13 },
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
