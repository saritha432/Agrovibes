import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { APP_LIME } from "../../theme/appColors";

export function AccountCenterAddAction({
  label,
  onPress,
  compact
}: {
  label: string;
  onPress?: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      style={[styles.button, compact ? styles.buttonCompact : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  buttonCompact: {
    marginBottom: 0,
    borderWidth: 0,
    minHeight: 52
  },
  label: {
    color: APP_LIME,
    fontSize: 15,
    fontWeight: "700"
  }
});
