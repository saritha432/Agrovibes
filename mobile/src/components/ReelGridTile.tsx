import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { HomePost } from "../services/api";
import { APP_LIME } from "../theme/appColors";
import { ContainedAppVideo } from "./ContainedAppVideo";
import { reelGridStillUri } from "../utils/reelGrid";

type ReelGridTileProps = {
  post: HomePost;
  width: number;
  height: number;
  backgroundColor: string;
  previewUri?: string | null;
  isPlaying?: boolean;
  /** When true, never mount inline video (e.g. fullscreen reel viewer is open). */
  suspendVideo?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onVideoError?: (postId: number) => void;
};

export function ReelGridTile({
  post,
  width,
  height,
  backgroundColor,
  previewUri,
  isPlaying = false,
  suspendVideo = false,
  onPress,
  onLongPress,
  onVideoError
}: ReelGridTileProps) {
  const stillUri = reelGridStillUri(post) || previewUri || null;
  const isVideo = !!String(post.videoUrl || "").trim();
  const showPlayingVideo = !suspendVideo && isPlaying && isVideo;

  return (
    <Pressable
      style={[styles.tile, { width, height, backgroundColor }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {showPlayingVideo ? (
        <ContainedAppVideo
          uri={post.videoUrl!}
          hlsUrl={post.hlsUrl}
          playbackUrl={post.playbackUrl}
          containerWidth={width}
          containerHeight={height}
          fit="cover"
          shouldPlay
          isLooping
          isMuted
          posterUri={stillUri || undefined}
          playbackKey={`grid-${post.id}`}
          onStatusUpdate={(status) => {
            if (!status.isLoaded && status.error) onVideoError?.(post.id);
          }}
        />
      ) : stillUri ? (
        <Image source={{ uri: stillUri }} style={styles.media} resizeMode="cover" />
      ) : isVideo && !suspendVideo ? (
        <View style={[styles.media, styles.placeholder, { backgroundColor }]} />
      ) : (
        <View style={[styles.media, styles.placeholder, { backgroundColor }]} />
      )}
      {isVideo ? (
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="videocam" size={20} color={APP_LIME} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: "hidden", position: "relative" },
  media: { width: "100%", height: "100%" },
  placeholder: {},
  playBadge: {
    position: "absolute",
    top: 8,
    right: 8
  }
});
