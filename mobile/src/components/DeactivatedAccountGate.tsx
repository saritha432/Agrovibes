import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { activateMyAccount } from "../services/api";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

type Props = {
  featureLabel: string;
  children: React.ReactNode;
};

export function DeactivatedAccountGate({ featureLabel, children }: Props) {
  const { user, token, updateUser, refreshUser } = useAuth();
  const [activating, setActivating] = useState(false);

  const onActivateAccount = useCallback(async () => {
    if (!token || activating) return;
    setActivating(true);
    try {
      const result = await activateMyAccount(token);
      await updateUser({ accountStatus: result.user.accountStatus || "active" });
      await refreshUser();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not activate account right now.";
      Alert.alert("Try again", message);
    } finally {
      setActivating(false);
    }
  }, [activating, refreshUser, token, updateUser]);

  if (user?.accountStatus !== "deactivated") {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Account is deactivated</Text>
      <Text style={styles.subtitle}>Activate your account to use {featureLabel}.</Text>
      <Pressable
        style={[styles.btn, activating && styles.btnDisabled]}
        onPress={() => void onActivateAccount()}
        disabled={activating}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{activating ? "Activating..." : "Activate Account"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12
  },
  title: {
    color: APP_TEXT,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center"
  },
  subtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  btn: {
    marginTop: 8,
    minWidth: 200,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  btnDisabled: {
    opacity: 0.7
  },
  btnText: {
    color: "#222",
    fontSize: 15,
    fontWeight: "700"
  }
});
