import React, { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
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
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

function maskEmail(email?: string) {
  if (!email || !email.includes("@")) return "******@gmail.com";
  const [local, domain] = email.split("@");
  const maskedLocal = `${"*".repeat(Math.min(Math.max(local.length - 2, 4), 6))}${local.slice(-2)}`;
  return `${maskedLocal}@${domain}`;
}

export function EmailVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [showDualActions, setShowDualActions] = useState(false);

  const maskedEmail = useMemo(() => maskEmail(user?.email), [user?.email]);
  const canContinue = code.trim().length >= 4;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const resendEmail = () => {
    if (countdown > 0) return;
    setCountdown(8);
    setShowDualActions(false);
    setCode("");
    Alert.alert("Email sent", "A new verification code has been sent to your email.");
  };

  const continueFlow = () => {
    if (!canContinue) return;
    if (!showDualActions) {
      setShowDualActions(true);
      return;
    }
    Alert.alert("Email verified", "Two-factor authentication has been enabled.", [
      { text: "OK", onPress: () => navigation.pop(2) }
    ]);
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
          <Text style={styles.title}>Email Verification</Text>

          <View style={styles.illustration} />

          <Text style={styles.description}>
            Enter the code that we sent to {maskedEmail}
          </Text>

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="enter code"
            placeholderTextColor={APP_TEXT_MUTED}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, focused ? styles.inputFocused : null]}
          />

          <Text style={styles.countdownText}>
            {countdown > 0
              ? `we can't send a new email in 0:${String(countdown).padStart(2, "0")}`
              : "you can request a new email now"}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          {showDualActions ? (
            <View style={styles.dualActions}>
              <Pressable
                style={[styles.secondaryBtn, countdown > 0 ? styles.secondaryBtnDisabled : null]}
                onPress={resendEmail}
                disabled={countdown > 0}
                accessibilityRole="button"
                accessibilityLabel="Try Again"
              >
                <Text style={styles.secondaryBtnText}>Try Again</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, styles.dualPrimaryBtn, !canContinue ? styles.submitBtnDisabled : null]}
                onPress={continueFlow}
                disabled={!canContinue}
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                <Text style={[styles.submitBtnText, !canContinue ? styles.submitBtnTextDisabled : null]}>
                  Continue
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.submitBtn, !canContinue ? styles.submitBtnDisabled : null]}
              onPress={continueFlow}
              disabled={!canContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={[styles.submitBtnText, !canContinue ? styles.submitBtnTextDisabled : null]}>
                Continue
              </Text>
            </Pressable>
          )}
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
    marginBottom: 20
  },
  illustration: {
    height: 180,
    borderRadius: 12,
    backgroundColor: APP_SURFACE,
    marginBottom: 20
  },
  description: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 21,
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
    borderColor: "transparent",
    marginBottom: 12
  },
  inputFocused: {
    borderColor: APP_LIME
  },
  countdownText: {
    color: APP_LIME,
    fontSize: 14,
    fontWeight: "600"
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8
  },
  dualActions: {
    flexDirection: "row",
    gap: 12
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: APP_SURFACE,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryBtnDisabled: {
    opacity: 0.55
  },
  secondaryBtnText: {
    color: APP_TEXT,
    fontSize: 16,
    fontWeight: "700"
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  dualPrimaryBtn: {
    flex: 1
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
