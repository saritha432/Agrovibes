import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform } from "react-native";
import { useAssetUri, type SvgModule } from "./market/shared/marketAssetUtils";

type Props = {
  module: SvgModule;
  size: number;
  color?: string;
  fallbackName?: keyof typeof Ionicons.glyphMap;
};

/** Renders bundled SVG assets on web (img) and native (SvgUri), with Ionicons fallback. */
export function SvgAssetIcon({ module, size, color = "#ffffff", fallbackName = "ellipse-outline" }: Props) {
  const { uri, failed, setFailed } = useAssetUri(module);

  if (failed || !uri) {
    return <Ionicons name={fallbackName} size={size} color={color} />;
  }

  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      alt: "",
      style: { width: size, height: size, display: "block", objectFit: "contain" },
      onError: () => setFailed(true)
    });
  }

  try {
    const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
    return <SvgUri uri={uri} width={size} height={size} onError={() => setFailed(true)} />;
  } catch {
    return <Ionicons name={fallbackName} size={size} color={color} />;
  }
}
