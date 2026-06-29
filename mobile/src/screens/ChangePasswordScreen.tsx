import React, { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { changeMyPassword, fetchMyAccount } from "../services/api";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

function formatPasswordUpdatedPlaceholder(iso?: string | null) {
  if (!iso) return "Current password";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Current password";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `Current password (updated on ${day}/${month}/${year})`;
}

function isValidNewPassword(password: string) {
  if (password.length < 6) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!$%@#&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return false;
  return true;
}

function PasswordField({
  placeholder,
  value,
  onChangeText,
  focused,
  onFocus,
  onBlur
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={APP_TEXT_MUTED}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      onFocus={onFocus}
      onBlur={onBlur}
      style={[styles.input, focused ? styles.inputFocused : null]}
    />
  );
}

export function ChangePasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(false);
  const [focusedField, setFocusedField] = useState<"current" | "new" | "confirm" | null>(null);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const account = await fetchMyAccount(token);
        if (!active) return;
        setPasswordUpdatedAt(account.passwordUpdatedAt || null);
      } catch {
        // optional metadata
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const canSubmit = useMemo(() => {
    if (!currentPassword.trim() || !newPassword || !confirmPassword) return false;
    if (!isValidNewPassword(newPassword)) return false;
    if (newPassword !== confirmPassword) return false;
    return true;
  }, [confirmPassword, currentPassword, newPassword]);

  const submit = async () => {
    if (!token || submitting || !canSubmit) return;
    setErrorText("");
    setSubmitting(true);
    try {
      await changeMyPassword(token, {
        currentPassword,
        newPassword,
        logoutOtherDevices
      });

      if (logoutOtherDevices) {
        await signOut();
        navigation.reset({
          index: 0,
          routes: [{ name: "AuthChoice", params: { passwordResetSuccess: true } }]
        });
        return;
      }

      Alert.alert("Password updated", "Your password has been changed successfully.", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.grabber} />
      <Pressable
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={24} color={APP_LIME} />
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.description}>
            Your password must be at least 6 characters and should include a combination of numbers, letters and
            special characters (!$%).
          </Text>

          <View style={styles.form}>
            <PasswordField
              placeholder={formatPasswordUpdatedPlaceholder(passwordUpdatedAt)}
              value={currentPassword}
              onChangeText={(value) => {
                setErrorText("");
                setCurrentPassword(value);
              }}
              focused={focusedField === "current"}
              onFocus={() => setFocusedField("current")}
              onBlur={() => setFocusedField((prev) => (prev === "current" ? null : prev))}
            />
            <PasswordField
              placeholder="New password"
              value={newPassword}
              onChangeText={(value) => {
                setErrorText("");
                setNewPassword(value);
              }}
              focused={focusedField === "new"}
              onFocus={() => setFocusedField("new")}
              onBlur={() => setFocusedField((prev) => (prev === "new" ? null : prev))}
            />
            <PasswordField
              placeholder="Retype new password"
              value={confirmPassword}
              onChangeText={(value) => {
                setErrorText("");
                setConfirmPassword(value);
              }}
              focused={focusedField === "confirm"}
              onFocus={() => setFocusedField("confirm")}
              onBlur={() => setFocusedField((prev) => (prev === "confirm" ? null : prev))}
            />
          </View>

          <Pressable onPress={() => navigation.navigate("ForgotPassword")} accessibilityRole="link">
            <Text style={styles.forgotLink}>Forgotten Your Password?</Text>
          </Pressable>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setLogoutOtherDevices((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: logoutOtherDevices }}
          >
            <View style={[styles.checkbox, logoutOtherDevices ? styles.checkboxChecked : null]}>
              {logoutOtherDevices ? <Ionicons name="checkmark" size={14} color={APP_BLACK} /> : null}
            </View>
            <Text style={styles.checkboxText}>
              Log out of other devices. Choose this if someone else used your account.
            </Text>
          </Pressable>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.submitBtn, !canSubmit || submitting ? styles.submitBtnDisabled : null]}
            onPress={submit}
            disabled={!canSubmit || submitting}
            accessibilityRole="button"
            accessibilityLabel="Change Password"
          >
            {submitting ? (
              <ActivityIndicator color={APP_BLACK} />
            ) : (
              <Text style={[styles.submitBtnText, !canSubmit ? styles.submitBtnTextDisabled : null]}>
                Change Password
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BLACK
  },
  flex: {
    flex: 1
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#5a5a5a",
    marginTop: 6,
    marginBottom: 8
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  title: {
    color: APP_TEXT,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10
  },
  description: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20
  },
  form: {
    gap: 12,
    marginBottom: 16
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: APP_SURFACE,
    color: APP_TEXT,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "transparent"
  },
  inputFocused: {
    borderColor: APP_LIME
  },
  forgotLink: {
    color: APP_LIME,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 18
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: APP_TEXT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  checkboxChecked: {
    backgroundColor: APP_LIME,
    borderColor: APP_LIME
  },
  checkboxText: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 14,
    lineHeight: 20
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 13,
    marginTop: 14
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  submitBtnDisabled: {
    backgroundColor: "rgba(201, 255, 53, 0.18)"
  },
  submitBtnText: {
    color: APP_BLACK,
    fontSize: 16,
    fontWeight: "700"
  },
  submitBtnTextDisabled: {
    color: "rgba(240, 244, 248, 0.45)"
  }
});
