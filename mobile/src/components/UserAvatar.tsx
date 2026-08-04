import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { FeedImage } from "./FeedImage";
import { stripLegacyCloudinaryUrl } from "../utils/mediaUrls";

const INITIAL_BG_PALETTE = [
  "#5B8DEF",
  "#E67E22",
  "#27AE60",
  "#9B59B6",
  "#E74C3C",
  "#1ABC9C",
  "#F39C12",
  "#3498DB",
  "#8E44AD",
  "#16A085"
] as const;

/** Stable color from a display name — used for letter avatars when there is no photo. */
export function avatarColorForName(name: string): string {
  const s = String(name || "").trim();
  if (!s) return INITIAL_BG_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return INITIAL_BG_PALETTE[hash % INITIAL_BG_PALETTE.length];
}

type Props = {
  uri?: string | null;
  name: string;
  size: number;
  /** Defaults to `size / 2` (circle). Use e.g. 12 for rounded squares. */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /**
   * Only used when `colorizeInitials` is false.
   * By default letter avatars use a stable color hashed from `name`.
   */
  fallbackBackgroundColor?: string;
  /** Only used when `colorizeInitials` is false. */
  initialsColor?: string;
  /**
   * When true (default), no-photo avatars use a stable color from `name` + white letter.
   * Set false only for rare brand/chrome cases that need a fixed color.
   */
  colorizeInitials?: boolean;
};

export function UserAvatar({
  uri,
  name,
  size,
  borderRadius,
  style,
  textStyle,
  fallbackBackgroundColor = "#404040",
  initialsColor = "#ffffff",
  colorizeInitials = true
}: Props) {
  const r = borderRadius ?? size / 2;
  const trimmed = stripLegacyCloudinaryUrl(uri) || "";
  const initial = (String(name || "").trim().charAt(0) || "?").toUpperCase();
  const fontSize = Math.max(10, Math.round(size * 0.38));
  const [imageFailed, setImageFailed] = useState(false);
  const hashedBg = useMemo(() => avatarColorForName(name), [name]);
  const bg = colorizeInitials ? hashedBg : fallbackBackgroundColor;
  const letterColor = colorizeInitials ? "#ffffff" : initialsColor;

  useEffect(() => {
    setImageFailed(false);
  }, [trimmed]);

  const showImage = Boolean(trimmed) && !imageFailed;

  return (
    <View
      style={[
        styles.wrap,
        style,
        {
          width: size,
          height: size,
          borderRadius: r,
          // Keep after `style` so callers can't override letter-avatar colors.
          backgroundColor: showImage ? "transparent" : bg,
          flexShrink: 0
        }
      ]}
    >
      {showImage ? (
        <FeedImage
          source={{ uri: trimmed }}
          style={{ width: size, height: size, borderRadius: r }}
          contentFit="cover"
          recyclingKey={trimmed}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize, color: letterColor }, textStyle]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "800", textAlign: "center" }
});
