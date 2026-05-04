import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { markLaunchSetupComplete } from "../onboarding/launchSetup";
import { authLogin, authRegister } from "../services/api";

type Mode = "login" | "register";

const GREEN = "#0a9f46";
const BORDER = "#dce3e1";

export function AuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { signIn } = useAuth();

  const [mode, setMode] = React.useState<Mode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<"student" | "instructor">("student");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload =
        mode === "login"
          ? await authLogin({ email, password })
          : await authRegister({ email, password, fullName, role });
      await signIn({ token: payload.token, user: payload.user as any });
      if (mode === "login" && (payload.user as any)?.id != null) {
        await markLaunchSetupComplete((payload.user as any).id);
      }
      navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.bottom} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#22312d" />
        </Pressable>
        <Text style={styles.title}>{mode === "login" ? "Sign in" : "Create account"}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.modeRow}>
          <Pressable onPress={() => setMode("login")} style={[styles.modePill, mode === "login" ? styles.modePillActive : null]}>
            <Text style={[styles.modeText, mode === "login" ? styles.modeTextActive : null]}>Login</Text>
          </Pressable>
          <Pressable onPress={() => setMode("register")} style={[styles.modePill, mode === "register" ? styles.modePillActive : null]}>
            <Text style={[styles.modeText, mode === "register" ? styles.modeTextActive : null]}>Register</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />

        <Text style={styles.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />

        {mode === "register" ? (
          <>
            <Text style={styles.label}>Full name</Text>
            <TextInput value={fullName} onChangeText={setFullName} style={styles.input} />

            <Text style={styles.label}>Account type</Text>
            <View style={styles.roleRow}>
              <Pressable onPress={() => setRole("student")} style={[styles.rolePill, role === "student" ? styles.rolePillActive : null]}>
                <Text style={[styles.roleText, role === "student" ? styles.roleTextActive : null]}>Student</Text>
              </Pressable>
              <Pressable onPress={() => setRole("instructor")} style={[styles.rolePill, role === "instructor" ? styles.rolePillActive : null]}>
                <Text style={[styles.roleText, role === "instructor" ? styles.roleTextActive : null]}>Instructor</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={18} color="#b42318" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable onPress={submit} style={[styles.btn, loading ? styles.btnDisabled : null]} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Please wait…" : mode === "login" ? "Login" : "Register"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  bottom: { paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  title: { fontWeight: "900", color: "#111616", fontSize: 18 },
  card: { margin: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 12 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modePill: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingVertical: 10, alignItems: "center" },
  modePillActive: { backgroundColor: "#eef8f1", borderColor: "#cde9d9" },
  modeText: { fontWeight: "900", color: "#5b6966" },
  modeTextActive: { color: GREEN },
  label: { marginTop: 10, fontWeight: "900", color: "#22312d" },
  input: { marginTop: 6, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "700", color: "#111616" },
  roleRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  rolePill: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingVertical: 10, alignItems: "center" },
  rolePillActive: { backgroundColor: "#111827", borderColor: "#111827" },
  roleText: { fontWeight: "900", color: "#5b6966" },
  roleTextActive: { color: "#fff" },
  errorRow: { marginTop: 12, flexDirection: "row", gap: 8, alignItems: "center" },
  errorText: { color: "#b42318", fontWeight: "800", flex: 1 },
  btn: { marginTop: 16, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 14 }
});

