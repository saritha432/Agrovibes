import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { FeedImage } from "./FeedImage";
import { APP_LIME } from "../theme/appColors";
import { stripLegacyCloudinaryUrl } from "../utils/mediaUrls";

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
  fallbackBackgroundColor = APP_LIME,
  initialsColor = "#1a2412"
}: Props) {
  const r = borderRadius ?? size / 2;
  const trimmed = stripLegacyCloudinaryUrl(uri) || "";
  const initial = (String(name || "").trim().charAt(0) || "?").toUpperCase();
  const fontSize = Math.max(10, Math.round(size * 0.38));
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [trimmed]);

  const showImage = Boolean(trimmed) && !imageFailed;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: showImage ? "transparent" : fallbackBackgroundColor
        },
        style
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
        <Text style={[styles.initials, { fontSize, color: initialsColor }, textStyle]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "800", textAlign: "center" }
});
