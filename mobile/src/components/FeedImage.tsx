import { Image, type ImageProps } from "expo-image";
import React from "react";

type FeedImageProps = Omit<ImageProps, "recyclingKey"> & {
  recyclingKey?: string;
};

/**
 * Cached feed image with disk cache. Prefer this over RN Image for posters/avatars.
 */
export function FeedImage({ cachePolicy = "memory-disk", transition = 0, ...rest }: FeedImageProps) {
  return <Image cachePolicy={cachePolicy} transition={transition} {...rest} />;
}
