import React, { useState } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { authLogin, formatAuthError } from "../services/api";
import {
  clearPreviousActivity,
  setFutureActivityEnabled
} from "../utils/activityOffCropvibeStorage";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../theme/appColors";

export function ConfirmItsYouScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ConfirmItsYou">>();
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const title = route.params?.title || "Confirm It's You";
  const description =
    route.params?.description ||
    "For your security, please re-enter your password to continue.";
  const action = route.params?.action;
  const profileId = route.params?.profileId;

  const canContinue = password.trim().length > 0 && !submitting;

  const runAction = async () => {
    if (action === "clearOffCropvibeActivity") {
      await clearPreviousActivity();
      const profileNote = profileId ? ` for the ${profileId} profile` : "";
      Alert.alert("Activity cleared", `Previous off-cropvibe activity has been removed${profileNote}.`, [
        { text: "OK", onPress: () => navigation.navigate("ActivityOffCropvibe") }
      ]);
      return;
    }
    if (action === "managePartnerActivity") {
      await setFutureActivityEnabled(true);
      Alert.alert("Saved", "Future partner activity preferences have been updated.", [
        { text: "OK", onPress: () => navigation.navigate("ActivityOffCropvibe") }
      ]);
      return;
    }
    if (action === "disconnectFutureActivity") {
      await setFutureActivityEnabled(false);
      await clearPreviousActivity();
      Alert.alert("Disconnected", "Future off-cropvibe activity has been disconnected.", [
        { text: "OK", onPress: () => navigation.navigate("ActivityOffCropvibe") }
      ]);
      return;
    }
    navigation.goBack();
  };

  const submit = async () => {
    if (!user || !canContinue) return;
    setSubmitting(true);
    try {
      const identifier = user.phone || user.email || user.username || "";
      await authLogin({ identifier, password: password.trim() });
      await runAction();
    } catch (error: unknown) {
      Alert.alert("Incorrect password", formatAuthError(error, "Please check your password and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.grabber} />
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
        <Ionicons name="arrow-back" size={24} color={APP_LIME} />
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Retype new password"
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
            onPress={() => void submit()}
            disabled={!canContinue}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={APP_TEXT_ON_LIME} />
            ) : (
              <Text style={[styles.submitBtnText, !canContinue ? styles.submitBtnTextDisabled : null]}>Next</Text>
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
  flex: {
    flex: 1
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  title: {
    color: APP_TEXT,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10
  },
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: APP_SURFACE,
    color: APP_TEXT,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#3a3a3a"
  },
  inputFocused: {
    borderColor: APP_LIME
  },
  forgotLink: {
    color: APP_LIME,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  submitBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  submitBtnDisabled: {
    opacity: 0.45
  },
  submitBtnText: {
    color: APP_TEXT_ON_LIME,
    fontSize: 15,
    fontWeight: "700"
  },
  submitBtnTextDisabled: {
    color: APP_TEXT_ON_LIME
  }
});
