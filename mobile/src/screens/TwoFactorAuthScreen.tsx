import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
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
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

export function TwoFactorAuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState(false);

  const canContinue = password.trim().length > 0;

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
          <Text style={styles.title}>Two-Factor Authentication</Text>
          <Text style={styles.description}>
            For your security, please re-enter your password to continue.
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Retype your password"
            placeholderTextColor={APP_TEXT_MUTED}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, focused ? styles.inputFocused : null]}
          />

          <Pressable onPress={() => navigation.navigate("ForgotPassword")} accessibilityRole="link">
            <Text style={styles.forgotLink}>Forgotten Your Password?</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.submitBtn, !canContinue ? styles.submitBtnDisabled : null]}
            onPress={() => navigation.navigate("EmailVerification")}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={[styles.submitBtnText, !canContinue ? styles.submitBtnTextDisabled : null]}>
              Continue
            </Text>
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
  input: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: APP_SURFACE,
    color: APP_TEXT,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 16
  },
  inputFocused: {
    borderColor: APP_LIME
  },
  forgotLink: {
    color: APP_LIME,
    fontSize: 14,
    fontWeight: "600"
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
