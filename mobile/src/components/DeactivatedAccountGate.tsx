import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { activateMyAccount } from "../services/api";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

export const DEACTIVATED_CHROME_OPACITY = 0.42;

export function useIsAccountDeactivated() {
  const { user } = useAuth();
  return user?.accountStatus === "deactivated";
}

export function DeactivatedChromeWrap({
  children,
  style,
  active = true
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When false, never apply the disabled chrome lock (e.g. public profile views). */
  active?: boolean;
}) {
  const isDeactivated = useIsAccountDeactivated();
  const locked = active && isDeactivated;
  if (!locked) {
    return style ? <View style={style}>{children}</View> : <>{children}</>;
  }
  return (
    <View style={[style, styles.disabledChrome]} pointerEvents="none" accessibilityState={{ disabled: true }}>
      {children}
    </View>
  );
}

export function useActivateAccount() {
  const { token, updateUser, refreshUser } = useAuth();
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

  return { activating, onActivateAccount };
}

type PlaceholderProps = {
  featureLabel: string;
  compact?: boolean;
};

export function DeactivatedContentPlaceholder({ featureLabel, compact }: PlaceholderProps) {
  const { activating, onActivateAccount } = useActivateAccount();

  return (
    <View style={[styles.placeholder, compact ? styles.placeholderCompact : null]}>
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
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 12
  },
  placeholderCompact: {
    paddingVertical: 28
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
  },
  disabledChrome: {
    opacity: DEACTIVATED_CHROME_OPACITY
  }
});
