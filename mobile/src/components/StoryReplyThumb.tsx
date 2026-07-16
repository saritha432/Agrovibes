import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { stripLegacyCloudinaryUrl } from "../utils/mediaUrls";
import { videoPlaybackUrl } from "../utils/videoPlaybackUrl";

function isLikelyVideoUrl(url: string | null | undefined) {
  const u = String(url || "")
    .toLowerCase()
    .split("?")[0];
  return /\.(mp4|mov|webm|m4v)$/i.test(u);
}

type Props = {
  imageUrl?: string | null;
  videoUrl?: string | null;
  previewUrl?: string | null;
  onPress?: () => void;
};

/** Small story preview square for DM quote rows (same size as reply thumbs). */
export function StoryReplyThumb({ imageUrl, videoUrl, previewUrl, onPress }: Props) {
  const image =
    stripLegacyCloudinaryUrl(imageUrl) ||
    (!isLikelyVideoUrl(previewUrl) ? stripLegacyCloudinaryUrl(previewUrl) : null);
  const video =
    stripLegacyCloudinaryUrl(videoUrl) ||
    (isLikelyVideoUrl(previewUrl) ? stripLegacyCloudinaryUrl(previewUrl) : null);
  const playback = video ? videoPlaybackUrl(video) : "";
  const videoRef = React.useRef<Video | null>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    setFrameReady(false);
  }, [playback]);

  const media = image ? (
    <Image source={{ uri: image }} style={styles.thumb} resizeMode="cover" />
  ) : playback ? (
    <View style={styles.thumb}>
      {!frameReady ? (
        <View style={[StyleSheet.absoluteFillObject, styles.fallback]}>
          <Ionicons name="play" size={14} color="rgba(255,255,255,0.5)" />
        </View>
      ) : null}
      <Video
        ref={videoRef}
        source={{ uri: playback }}
        style={[StyleSheet.absoluteFillObject, frameReady ? null : { opacity: 0 }]}
        resizeMode={ResizeMode.COVER}
        isMuted
        shouldPlay={false}
        isLooping={false}
        useNativeControls={false}
        onLoad={async () => {
          try {
            await videoRef.current?.setPositionAsync(350);
            await videoRef.current?.pauseAsync();
          } catch {
            // ignore
          }
          setFrameReady(true);
        }}
        onError={() => setFrameReady(false)}
      />
    </View>
  ) : (
    <View style={[styles.thumb, styles.fallback]}>
      <Ionicons name="ellipse-outline" size={14} color="rgba(255,255,255,0.45)" />
    </View>
  );

  if (!onPress) return media;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open story">
      {media}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    overflow: "hidden"
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111"
  }
});
