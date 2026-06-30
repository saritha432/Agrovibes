import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { APP_LIME } from "../../theme/appColors";

export function AccountCenterAddAction({
  label,
  onPress
}: {
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.button}
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
  label: {
    color: APP_LIME,
    fontSize: 15,
    fontWeight: "700"
  }
});
