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
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { changeMyPassword, fetchMyAccount } from "../../services/api";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";

const CARD = "#303132";
const DIVIDER = "rgba(255,255,255,0.1)";

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
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.inputWrap, focused ? styles.inputWrapFocused : null]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={APP_TEXT_MUTED}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        onFocus={onFocus}
        onBlur={onBlur}
        underlineColorAndroid="transparent"
        style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as const) : null]}
      />
      <Pressable
        style={styles.eyeBtn}
        onPress={() => setVisible((prev) => !prev)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
      >
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={APP_TEXT_MUTED} />
      </Pressable>
    </View>
  );
}

export function ChangePasswordContent() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { pop, close, navigateStack } = useAccountCenterSheetNav();
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
    void (async () => {
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

  const goBack = () => pop();

  const openForgotPassword = () => {
    close();
    requestAnimationFrame(() => navigateStack("ForgotPassword"));
  };

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
        close();
        navigation.reset({
          index: 0,
          routes: [{ name: "AuthChoice", params: { passwordResetSuccess: true } }]
        });
        return;
      }

      Alert.alert("Password updated", "Your password has been changed successfully.", [
        { text: "OK", onPress: goBack }
      ]);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.backBtn} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={24} color={APP_LIME} />
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
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

          <Pressable onPress={openForgotPassword} accessibilityRole="link">
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
            onPress={() => void submit()}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: APP_BLACK
  },
  flex: {
    flexShrink: 1
  },
  scroll: {
    flexGrow: 0
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
    paddingBottom: 12
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
  inputWrap: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: DIVIDER,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 8,
    overflow: "hidden"
  },
  inputWrapFocused: {
    borderColor: APP_LIME
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: "transparent"
  },
  eyeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
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
    paddingBottom: 8,
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
