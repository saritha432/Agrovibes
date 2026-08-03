import React from "react";
import { Image as RNImage, type ImageProps as RNImageProps } from "react-native";
import { hasExpoImageNative } from "../utils/hasExpoImageNative";

type ExpoImageComponent = typeof import("expo-image").Image;

function resolveExpoImage(): ExpoImageComponent | null {
  try {
    if (!hasExpoImageNative()) return null;
    return require("expo-image").Image as ExpoImageComponent;
  } catch {
    return null;
  }
}

const ExpoImage = resolveExpoImage();

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
 * falls back to RN Image (old dev builds / Expo Go) so the app doesn't crash.
 */
export function FeedImage({
  cachePolicy = "memory-disk",
  transition = 0,
  contentFit,
  recyclingKey: _recyclingKey,
  ...rest
}: FeedImageProps) {
  if (ExpoImage) {
    return (
      <ExpoImage
        cachePolicy={cachePolicy as "memory-disk"}
        transition={transition}
        contentFit={contentFit}
        {...rest}
      />
    );
  }
  const resizeMode = contentFit === "contain" ? "contain" : "cover";
  return <RNImage resizeMode={resizeMode} {...(rest as RNImageProps)} />;
}

export { hasExpoImageNative };
