import React from "react";

let ExpoImage: typeof import("expo-image").Image | null = null;
try {
  ExpoImage = require("expo-image").Image;
} catch {
  ExpoImage = null;
}

import { Image as RNImage, type ImageProps as RNImageProps } from "react-native";

type FeedImageProps = {
  source?: RNImageProps["source"] | { uri?: string };
  style?: RNImageProps["style"];
  contentFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  recyclingKey?: string;
  cachePolicy?: string;
  transition?: number;
  [key: string]: unknown;
};

/**
 * Cached feed image with disk cache. Uses expo-image when native module is available,
 * falls back to RN Image (e.g. Expo Go / web) so the app doesn't crash.
 */
export function FeedImage({ cachePolicy = "memory-disk", transition = 0, contentFit, recyclingKey: _recyclingKey, ...rest }: FeedImageProps) {
  if (ExpoImage) {
    return <ExpoImage cachePolicy={cachePolicy as "memory-disk"} transition={transition} contentFit={contentFit} {...rest} />;
  }
  const resizeMode = contentFit === "contain" ? "contain" : "cover";
  return <RNImage resizeMode={resizeMode} {...(rest as RNImageProps)} />;
}
