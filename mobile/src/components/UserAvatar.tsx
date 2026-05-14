import React from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

type Props = {
  uri?: string | null;
  name: string;
  size: number;
  /** Defaults to `size / 2` (circle). Use e.g. 12 for rounded squares. */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Fallback circle / square background when there is no image */
  fallbackBackgroundColor?: string;
  initialsColor?: string;
};

export function UserAvatar({
  uri,
  name,
  size,
  borderRadius,
  style,
  textStyle,
  fallbackBackgroundColor = "#2a3139",
  initialsColor = "#d8ff37"
}: Props) {
  const r = borderRadius ?? size / 2;
  const trimmed = typeof uri === "string" ? uri.trim() : "";
  const initial = (String(name || "").trim().charAt(0) || "?").toUpperCase();
  const fontSize = Math.max(10, Math.round(size * 0.38));

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: trimmed ? "transparent" : fallbackBackgroundColor
        },
        style
      ]}
    >
      {trimmed ? (
        <Image source={{ uri: trimmed }} style={{ width: size, height: size, borderRadius: r }} resizeMode="cover" />
      ) : (
        <Text style={[styles.initials, { fontSize, color: initialsColor }, textStyle]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "800", textAlign: "center" }
});
