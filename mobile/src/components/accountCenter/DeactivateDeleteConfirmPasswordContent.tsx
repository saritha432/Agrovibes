import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountCenterSubLayout } from "./AccountCenterSubLayout";
import { useAccountCenterSheetNav } from "./accountCenterSheetNav";
import {
  clearPendingDeactivateAction,
  getPendingDeactivateAction
} from "./accountCenterDeactivateFlow";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";
import { useAuth } from "../../auth/AuthContext";
import { deactivateMyAccount, deleteMyAccount } from "../../services/api";

export function DeactivateDeleteConfirmPasswordContent() {
  const { push, pop, close, navigateStack } = useAccountCenterSheetNav();
  const { token, updateUser, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const action = getPendingDeactivateAction() || "deactivate";
  const isDelete = action === "delete";

  const handleConfirm = async () => {
    if (!token || busy) return;
    if (!password.trim()) {
      Alert.alert("Password required", "Enter your password to continue.");
      return;
    }
    setBusy(true);
    try {
      if (isDelete) {
        await deleteMyAccount(token, password);
        clearPendingDeactivateAction();
        await signOut();
        close();
        requestAnimationFrame(() => navigateStack("InitialSetup"));
        return;
      }
      const result = await deactivateMyAccount(token, password);
      await updateUser({ accountStatus: result.user.accountStatus || "deactivated" });
      push("DeactivateDeleteSuccess");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update account status right now.";
      Alert.alert("Try again", message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountCenterSubLayout
      variant="sheet"
      onBack={pop}
      title={isDelete ? "Confirm Account Deletion" : "Confirm Password"}
      description={
        <Text style={styles.description}>
          {isDelete
            ? "Enter your password to permanently delete your account."
            : "Enter your password to deactivate your account."}
        </Text>
      }
      contentStyle={styles.content}
    >
      <View style={styles.inputWrap}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={APP_TEXT_MUTED}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
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

      <Pressable
        style={[styles.confirmBtn, busy && styles.confirmBtnDisabled]}
        onPress={() => void handleConfirm()}
        accessibilityRole="button"
        disabled={busy}
      >
        <Text style={styles.confirmText}>
          {busy ? "Please wait..." : isDelete ? "Delete Account" : "Deactivate Account"}
        </Text>
      </Pressable>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  content: {
    paddingBottom: 40
  },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#303132",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: APP_TEXT,
    fontSize: 15
  },
  eyeBtn: {
    padding: 4
  },
  confirmBtn: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  confirmBtnDisabled: {
    opacity: 0.7
  },
  confirmText: {
    color: "#222",
    fontSize: 15,
    fontWeight: "700"
  }
});
