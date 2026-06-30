import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { APP_LIME } from "../../theme/appColors";

function profileInitial(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export function AccountCenterAvatar({ label, avatarUrl }: { label: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />;
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitial}>{profileInitial(label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4a4a4a",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitial: {
    color: APP_LIME,
    fontSize: 16,
    fontWeight: "700"
  }
});
